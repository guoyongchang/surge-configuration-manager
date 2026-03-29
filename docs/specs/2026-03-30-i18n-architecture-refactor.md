# i18n 架构重构

## 背景
当前 i18n 采用 namespace 分离设计（common、subscriptions、rules、hosts、output、settings 等独立文件），导致检测脚本无法准确追踪 `t("key")` 调用与实际 namespace 的对应关系，尤其是 Dialog 等跨文件组件会产生大量误报。改用单一语言文件可以彻底消除这个检测难题，同时减少冗余。

## 范围
### 包含
- 合并所有 namespace 到单个 `en.json` 和 `zh.json`
- 更新 `i18n.ts` 初始化逻辑，从单文件加载
- 简化所有 `useTranslation()` 调用，移除 namespace 参数
- 更新检测脚本为简单的 key 存在性检查（删除 Stage 2 namespace 匹配检查）
- 保留现有所有翻译文本内容不动
- CI 和 pre-commit hook 验证通过

### 不包含
- 新增或修改翻译文本内容
- 改变翻译 key 的命名结构
- 改变 UI 组件的文案

## 验收标准
- [ ] AC-01: 应用正常运行，所有现有 UI 文字显示与重构前一致
- [ ] AC-02: 检测脚本简化为单一检查：`t("key")` 在对应语言文件中存在，所有 key 无缺失
- [ ] AC-03: CI 和 pre-commit hook 验证通过
- [ ] AC-04: TypeScript 编译通过，无 namespace 相关类型错误
- [ ] AC-05: `npx tsc --noEmit && node scripts/check-i18n.mjs && pnpm lint` 全部通过

## 技术备注
- i18n.ts 改为 `useTranslation()` 无参数调用，默认使用单语言文件
- 所有现有翻译内容迁移到 `src/locales/en.json` 和 `src/locales/zh.json`
- 检测脚本只做 Stage 1 检查（key 是否在文件中有定义）
