# Test Harness & Architecture Constraints Design

**Date**: 2026-03-29
**Project**: Surge Configuration Manager (SCM)
**Status**: Approved

---

## 背景

当前痛点：
- **A（需求遗漏）**：AI 执行需求时遗漏细节，事后才发现
- **B（验证不可靠）**：AI 声称完成但实际有 bug，依赖人工检查

目标：建立一套让 AI 能客观验证自身工作的框架，优先解决用户流程完整性验证。

---

## 整体架构

```
需求输入层  ->  AI 工作流层  ->  自动化验证层  ->  CI 门禁层
```

---

## 第一层：需求输入规范

### 文件位置
所有功能需求写入 `docs/specs/YYYY-MM-DD-<feature>.md`

### 强制模板格式

```markdown
# [功能名称]

## 背景
一句话说明为什么需要这个功能。

## 范围
### 包含
- 具体要实现的东西

### 不包含（明确排除）
- 本次不做的东西

## 验收标准
每条必须是可验证的断言，格式：AC-XX: [动词] + [可观测结果]

- [ ] AC-01: 用户点击"添加"后，列表新增一条记录
- [ ] AC-02: 输入为空时，提交按钮禁用
- [ ] AC-03: 刷新失败时，旧数据保留，状态显示 Error
- [ ] AC-04: `pnpm test` 全部通过

## 技术备注（可选）
需要 AI 注意的实现约束。
```

### AI 执行时的强制工作流

1. **拆解**：读取 spec，将每条 AC 转换为具体子任务，明确列出
2. **执行**：每个子任务完成后立即运行相关测试，不等到最后
3. **验收**：逐条 AC 核查，每条必须有**证据**（测试输出 / 命令结果），不能只声称"已完成"
4. **完成条件**：`pnpm test` 全绿 + 所有 AC 有证据，才能提交

---

## 第二层：架构约束（严格模式）

### 层次划分

```
UI Layer
  src/pages/**  src/components/**
  职责：渲染、用户交互
  只能 import -> service, types, ui-lib

Service Layer
  src/lib/api.ts  src/hooks/**
  职责：业务逻辑、IPC 调用、状态管理
  只能 import -> types

Types Layer
  src/types/**
  职责：共享类型定义
  不能 import 任何内部模块

UI Library（特殊，不受约束）
  src/components/ui/**  (shadcn 生成)
  不能被 service 层引用
```

### 工具：`eslint-plugin-boundaries`

集成进 ESLint，开发时 IDE 实时报错，CI lint job 自动捕获。

**核心规则：**
- UI 层禁止直接 `import { invoke } from '@tauri-apps/api/core'`，必须通过 `src/lib/api.ts`
- Service 层不能 import pages 或 components
- Types 层不能 import 任何内部代码
- shadcn `ui/` 只能被 UI 层使用，不能被 service 层引用

**违规示例：**
```ts
// 在组件里直接调用 Tauri -> ESLint 报错，CI 失败
import { invoke } from '@tauri-apps/api/core'
// [boundaries] Direct Tauri API usage forbidden in UI layer. Use src/lib/api.ts instead.
```

### 新增 `src/types/` 目录

提取当前散落在各页面的类型定义：

```
src/types/
  subscription.ts   <- Subscription, SubSource
  rules.ts          <- RemoteRuleSet, IndividualRule
  nodes.ts          <- ExtraNode
  output.ts         <- OutputConfig, BuildRecord
  index.ts          <- 统一导出
```

---

## 第三层：自动化验证

### Phase 2：Vitest + Mock Tauri IPC（核心）

在纯 Node 环境测试整条用户操作链路，无需启动真实 App。

**测试链路：**
```
用户操作（点击按钮）-> React 组件逻辑 -> src/lib/api.ts
  -> [mock] invoke() 返回预设数据 -> 界面状态更新 -> 断言结果
```

**目录结构：**
```
src/
  test/
    setup.ts              <- 全局 mock @tauri-apps/api
    fixtures/
      subscriptions.ts    <- 测试数据
      rules.ts
  __tests__/
    pages/
      Subscriptions.test.tsx
      Rules.test.tsx
      ExtraNodes.test.tsx
      Output.test.tsx
    lib/
      api.test.ts
```

**全局 Mock 示例：**
```ts
// src/test/setup.ts
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))
```

**每个页面测试必须覆盖：**
- 初始加载 -> 列表正确渲染
- 添加操作 -> invoke 被正确调用 + 列表更新
- 删除操作 -> confirm 对话框 -> invoke 调用 + 条目消失
- 错误状态 -> invoke 抛出错误 -> 错误提示显示

### Phase 3：Playwright E2E（精选核心路径）

仅保护 4 条关键用户流程，不追求覆盖率：

| 编号 | 路径 | 验证点 |
|------|------|--------|
| E2E-01 | 添加订阅 -> 刷新 -> 查看节点数 | 完整数据流 |
| E2E-02 | 添加规则 -> 拖拽排序 -> 保存 | 顺序持久化 |
| E2E-03 | 生成配置 -> 预览输出内容 | 核心业务逻辑 |
| E2E-04 | 语言切换（中/英） | i18n 正确性 |

E2E 仅在 **merge 到 main 时**触发，不阻塞日常开发。

---

## 第四层：CI 门禁

```yaml
jobs:
  lint-and-test:          # 每次 push 触发
    steps:
      - tsc --noEmit
      - eslint            # 含 boundaries 架构约束规则
      - cargo fmt --check
      - cargo clippy -- -D warnings
      - cargo test
      - pnpm test         # 新增 Vitest

  build-check:            # lint-and-test 通过后
    steps:
      - pnpm build
      - cargo build --release

  e2e:                    # 仅 merge to main 时触发
    steps:
      - pnpm test:e2e     # 新增 Playwright
```

---

## 实施阶段

### Phase 1（工作流层）
- [ ] 创建 `docs/specs/` 目录和需求模板
- [ ] 更新 `CLAUDE.md`：写入架构约束规则 + AI 工作流强制要求

### Phase 2（核心验证层）
- [ ] 安装 Vitest + React Testing Library + @testing-library/user-event
- [ ] 安装 eslint-plugin-boundaries，配置层次规则
- [ ] 创建 `src/types/` 目录，迁移现有类型定义
- [ ] 编写全局 Tauri mock（`src/test/setup.ts`）
- [ ] 编写 4 个页面的测试套件
- [ ] 更新 CI：加入 `pnpm test` 和 ESLint boundaries

### Phase 3（E2E）
- [ ] 安装 Playwright + tauri-driver
- [ ] 编写 4 条核心 E2E 路径
- [ ] 更新 CI：加入 e2e job（仅 main merge 触发）

---

## CLAUDE.md 新增约束

### 架构层次规则（强制，违反则 CI 失败）

1. UI 层（pages/components）禁止直接调用 `@tauri-apps/api`，必须通过 `src/lib/api.ts`
2. Service 层（lib/hooks）不能 import UI 层任何模块
3. Types 层（src/types）不能 import 任何内部模块
4. 新增类型定义必须放在 `src/types/`，不能散落在页面文件中
5. shadcn 生成的 `src/components/ui/` 不能被 service 层引用

### 需求执行规则（强制，每次实现功能必须遵守）

1. 执行需求前必须确认 spec 文件存在且含有验收标准（AC-XX 格式）
2. 将每条 AC 转换为具体子任务后再开始实现
3. 每条 AC 完成后必须提供可验证的证据（测试输出或命令结果）
4. 提交前必须运行 `pnpm test`，全绿才能声明完成
5. 禁止在没有测试证据的情况下声称"已完成"
