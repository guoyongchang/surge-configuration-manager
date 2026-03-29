# Surge 配置管理器

macOS 原生桌面应用，可视化管理 Surge 代理配置文件。

![Surge Configuration Manager](docs/screenshots/01-subscriptions.png)

## 功能特性

### 订阅管理

- 支持从远程 URL 导入订阅
- 支持导入本地 `.conf` 配置文件
- 自动刷新并获取最新节点
- 智能过期保护，刷新失败时保留原配置
- 自动提取并显示流量使用情况

### 规则管理

- 管理远程 RULE-SET 规则集
- 添加、编辑、删除个别路由规则
- 拖拽调整规则优先级
- 支持多种规则类型（DOMAIN、DOMAIN-SUFFIX、URL-REGEX 等）

### 额外节点（重点功能）

添加不属于任何订阅的自定义代理节点：

- 支持 SOCKS5、HTTP/HTTPS 协议
- 支持用户名密码认证
- 适合私人代理、工作专用节点、游戏加速器等场景

### 输出配置

- 合并所有配置生成最终 `.conf` 文件
- 实时预览配置内容
- 查看与上次生成的差异
- 一键写入 Surge 配置目录

### 高级设置

| 模块 | 功能 |
|------|------|
| HTTP 监听 | 配置本地 HTTP 代理服务 |
| MITM | HTTPS 流量解密（需 CA 证书） |
| HOST | 自定义 DNS 解析规则 |
| URL Rewrite | URL 重写和请求拦截 |

### 云同步（重点功能）

将配置同步到 GitHub Gist，实现多设备同步：

- 使用 GitHub Personal Access Token 连接
- 自动同步所有配置
- 支持多设备间无缝切换
- 重装系统后可快速恢复

![云同步](docs/screenshots/10-cloud-sync.png)

## 界面预览

| 功能 | 截图 |
|------|------|
| 订阅管理 | ![](docs/screenshots/01-subscriptions.png) |
| 规则管理 | ![](docs/screenshots/02-rules.png) |
| 额外节点 | ![](docs/screenshots/03-extranodes.png) |
| 输出配置 | ![](docs/screenshots/04-output.png) |
| 云同步 | ![](docs/screenshots/10-cloud-sync.png) |

## 系统要求

- macOS 10.15 (Catalina) 或更高版本
- [Surge](https://nssurge.com/) 已安装（用于使用生成的配置文件）

## 安装

### 从源码构建

```bash
# 克隆项目
git clone https://github.com/your-repo/surge-configuration-manager.git
cd surge-configuration-manager

# 安装依赖
pnpm install

# 开发模式运行
pnpm tauri dev

# 构建发布版本
pnpm tauri build
```

### 下载预编译版本

前往 [Releases](https://github.com/your-repo/surge-configuration-manager/releases) 页面下载最新版本。

## 使用说明

### 添加订阅

1. 打开「订阅管理」页面
2. 点击「添加订阅」
3. 选择 URL 或本地文件方式
4. 填写订阅信息并确认

### 添加自定义节点

1. 打开「额外节点」页面
2. 点击「添加节点」
3. 填写节点信息（名称、类型、地址、端口、认证信息）
4. 点击确认保存

### 启用云同步

1. 前往 GitHub 生成 Personal Access Token（需勾选 `gist` 权限）
2. 打开「云同步」页面
3. 点击「添加令牌」并粘贴 Token
4. 选择要同步的内容，点击「同步」

### 生成配置文件

1. 完成所有配置后，打开「输出」页面
2. 点击「预览」查看生成的配置
3. 确认无误后点击「写入配置」
4. 在 Surge 中重新加载配置文件

## 技术栈

- **前端**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4
- **后端**: Rust + Tauri 2.x
- **UI 组件**: shadcn/ui (radix-nova)
- **图标**: Lucide React

## 项目结构

```
src/                      # React 前端源码
  pages/                  # 页面组件
    Subscriptions.tsx     # 订阅管理
    Rules.tsx             # 规则管理
    ExtraNodes.tsx        # 额外节点
    Output.tsx            # 输出配置
    Settings.tsx          # 设置主页
    HttpListenPage.tsx    # HTTP 监听
    MitmPage.tsx          # MITM
    HostPage.tsx          # HOST
    UrlRewritePage.tsx    # URL Rewrite
    CloudSyncPage.tsx     # 云同步
  components/             # React 组件
  lib/                   # API 封装和工具函数
  types/                 # TypeScript 类型定义

src-tauri/               # Rust 后端源码
  src/
    commands.rs          # Tauri 命令处理
    models.rs            # 数据模型
    store.rs             # 数据持久化
    subscription.rs      # 订阅解析
    generator.rs         # 配置生成
```

## 开发

```bash
# 类型检查
npx tsc --noEmit

# Rust 检查
cd src-tauri && cargo check

# 运行测试
cd src-tauri && cargo test

# 代码格式检查
cd src-tauri && cargo fmt -- --check
cd src-tauri && cargo clippy -- -D warnings
```

## 文档

详细用户指南请查看 [docs/user-guide-2026-03-30.md](docs/user-guide-2026-03-30.md)。

## License

（待定）
