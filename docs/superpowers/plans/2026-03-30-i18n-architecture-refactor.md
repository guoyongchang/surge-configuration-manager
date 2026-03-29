# i18n 架构重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 7 个 namespace 文件合并为 `en.json` / `zh.json` 各一个，移除 `useTranslation("ns")` 参数，更新所有 `t()` 调用 key 前缀。

**Architecture:** 每个原有 namespace 的 key 加上文件名做前缀（例如 `subscriptions.page.title` → `subscriptions_page_title`），避免 key 名冲突。共享的 `common` keys 去掉前缀（因为所有组件都会用到）。i18n 初始化改为单文件默认 namespace。

**Tech Stack:** i18next, react-i18next

---

## 文件结构

合并后的目标文件：
- `src/locales/en.json` — 所有英文翻译，key 前缀代表原 namespace
- `src/locales/zh.json` — 所有中文翻译
- `src/i18n.ts` — 简化为单文件加载，移除 namespace 列表

待删除：
- `src/locales/en/` 目录（7 个文件）
- `src/locales/zh/` 目录（7 个文件）

---

## Task 1: 创建合并后的 `en.json`

**文件:**
- Create: `src/locales/en.json`

Key 前缀映射规则：
- `common.*` → 保持不变（全局共享）
- `subscriptions.*` → `subscriptions_` 前缀
- `rules.*` → `rules_` 前缀
- `extraNodes.*` → `extraNodes_` 前缀
- `output.*` → `output_` 前缀
- `settings.*` → `settings_` 前缀
- `hosts.*` → `hosts_` 前缀

注意：`settings.json` 中有些 key 本身不含 `page.` 前缀（如 `general.sectionTitle`、`cloudSync.sectionTitle`），直接保留。

- [ ] **Step 1: Write merged en.json**

合并内容（完整 key 列表）：

```json
{
  "nav": {
    "subscriptions": "Subscriptions",
    "rules": "Rules",
    "extraNodes": "Extra Nodes",
    "output": "Output",
    "settings": "Settings",
    "httpListen": "General",
    "mitm": "MITM",
    "hosts": "Hosts",
    "urlRewrites": "URL Rewrite",
    "cloudSync": "Cloud Sync"
  },
  "actions": {
    "add": "Add",
    "cancel": "Cancel",
    "save": "Save",
    "remove": "Remove",
    "delete": "Delete",
    "refresh": "Refresh",
    "import": "Import",
    "enable": "Enable",
    "disable": "Disable",
    "edit": "Edit",
    "generateConfig": "Generate Config"
  },
  "status": {
    "loading": "Loading...",
    "saved": "Saved!",
    "never": "Never",
    "justNow": "Just now",
    "enabled": "Enabled",
    "disabled": "Disabled"
  },
  "confirm": {
    "cannotUndo": "This action cannot be undone."
  },
  "subscriptions_page_title": "Subscriptions",
  "subscriptions_page_emptyTitle": "Add New Source",
  "subscriptions_page_emptyHint": "Connect a Surge subscription URL to manage proxy nodes.",
  "subscriptions_page_removeTitle": "Remove subscription?",
  "subscriptions_page_removeDesc": "\"{{name}}\" and all its cached data will be removed.",
  "subscriptions_dialog_triggerLabel": "Add Subscription",
  "subscriptions_dialog_addTitle": "Add Subscription",
  "subscriptions_dialog_fromUrl": "From URL",
  "subscriptions_dialog_fromFile": "From File",
  "subscriptions_dialog_nameLabel": "Name",
  "subscriptions_dialog_namePlaceholder": "e.g. ImmTelecom",
  "subscriptions_dialog_urlLabel": "Subscription URL",
  "subscriptions_dialog_urlPlaceholder": "https://...",
  "subscriptions_dialog_fileLabel": "File Path",
  "subscriptions_dialog_filePlaceholder": "Select a .conf file...",
  "subscriptions_dialog_filePickerTitle": "Select Surge Config File",
  "subscriptions_card_primary": "Primary",
  "subscriptions_card_local": "Local",
  "subscriptions_card_url": "URL",
  "subscriptions_card_nodesCount": "{{count}} nodes",
  "subscriptions_card_setPrimary": "Set as Primary",
  "subscriptions_card_refreshNow": "Refresh Now",
  "subscriptions_card_remove": "Remove",
  "subscriptions_card_primaryInfo": "Primary subscription — contributes Proxy Groups and Rules to the generated config",
  "subscriptions_card_secondaryInfo": "Secondary — nodes only (Proxy Groups and Rules are excluded)",
  "subscriptions_card_refreshError": "Last refresh failed — using previously cached content",
  "subscriptions_card_lastRefreshed": "Last Refreshed",
  "subscriptions_card_source": "Source",
  "subscriptions_card_interval": "Interval",
  "subscriptions_card_status": "Status",
  "subscriptions_card_localFile": "Local File",
  "subscriptions_card_expires": "Expires {{date}}",
  "subscriptions_timeAgo_minsAgo": "{{count}}m ago",
  "subscriptions_timeAgo_hoursAgo": "{{count}}h ago",
  "subscriptions_timeAgo_daysAgo": "{{count}}d ago",
  "rules_page_title": "Rules",
  "rules_page_ruleSetsTitle": "Remote Rule Sets",
  "rules_page_individualTitle": "Individual Rules",
  "rules_page_emptyRuleSets": "No remote rule sets yet.",
  "rules_page_emptyIndividual": "No individual rules yet.",
  "rules_page_fromSubscriptions": "From Subscriptions",
  "rules_page_removeRuleSetTitle": "Remove rule set?",
  "rules_page_removeRuleSetDesc": "\"{{name}}\" will be permanently removed.",
  "rules_page_removeRuleTitle": "Remove rule?",
  "rules_page_removeRuleDesc": "{{type}}, {{value}} will be permanently removed.",
  "rules_page_batchDeleteRulesTitle": "Delete {{count}} rule?",
  "rules_page_batchDeleteRuleSetsTitle": "Delete {{count}} rule set?",
  "rules_page_batchDeleteRulesTitle_plural": "Delete {{count}} rules?",
  "rules_page_batchDeleteRuleSetsTitle_plural": "Delete {{count}} rule sets?",
  "rules_addRuleSet_trigger": "Add Rule Set",
  "rules_addRuleSet_title": "Add Remote Rule Set",
  "rules_addRuleSet_nameLabel": "Name",
  "rules_addRuleSet_namePlaceholder": "e.g. AI Services",
  "rules_addRuleSet_urlLabel": "Rule List URL",
  "rules_addRuleSet_urlPlaceholder": "https://raw.githubusercontent.com/...",
  "rules_addRuleSet_policyLabel": "Policy",
  "rules_addRule_trigger": "Add Individual Rule",
  "rules_addRule_title": "Add Individual Rule",
  "rules_addRule_typeLabel": "Type",
  "rules_addRule_valueLabel": "Value",
  "rules_addRule_policyLabel": "Policy",
  "rules_addRule_commentLabel": "Comment (optional)",
  "rules_batchImport_trigger": "Batch Import",
  "rules_batchImport_title": "Batch Import Rules",
  "rules_batchImport_rulesLabel": "Rules (one per line)",
  "rules_batchImport_defaultTypeLabel": "Default Type",
  "rules_batchImport_defaultPolicyLabel": "Default Policy",
  "rules_batchImport_valid": "{{count}} valid",
  "rules_batchImport_invalid": "{{count}} invalid",
  "rules_batchImport_importRules": "Import {{count}} Rules",
  "rules_batchImport_importBtn": "Import",
  "rules_policyPicker_placeholder": "Select policy…",
  "rules_policyPicker_searchPlaceholder": "Search policy or node…",
  "rules_policyPicker_noResults": "No results",
  "extraNodes_page_title": "Extra Nodes",
  "extraNodes_page_subtitle": "Manually add proxy nodes that aren't part of a subscription.",
  "extraNodes_page_selectedCount": "{{count}} selected",
  "extraNodes_page_deleteTitle": "Delete {{count}} node?",
  "extraNodes_page_deleteTitle_plural": "Delete {{count}} nodes?",
  "extraNodes_page_deselectAll": "Deselect All",
  "extraNodes_page_selectAll": "Select All",
  "extraNodes_page_empty": "No Extra Nodes",
  "extraNodes_page_emptyHint": "Add a custom proxy node with optional refresh URL.",
  "extraNodes_page_removeTitle": "Remove node?",
  "extraNodes_page_removeDesc": "\"{{name}}\" will be permanently removed.",
  "extraNodes_dialog_trigger": "Add Node",
  "extraNodes_dialog_title": "Add Node",
  "extraNodes_tabs_single": "Single",
  "extraNodes_tabs_batch": "Batch",
  "extraNodes_single_protocol": "Protocol",
  "extraNodes_single_name": "Node Name",
  "extraNodes_single_server": "Server",
  "extraNodes_single_port": "Port",
  "extraNodes_single_username": "Username",
  "extraNodes_single_password": "Password",
  "extraNodes_single_encryptMethod": "Encrypt Method",
  "extraNodes_single_skipVerify": "Skip Cert Verify",
  "extraNodes_single_refreshUrl": "Refresh URL",
  "extraNodes_single_optional": "optional",
  "extraNodes_single_disabled": "Disabled",
  "extraNodes_single_yes": "Yes",
  "extraNodes_single_no": "No",
  "extraNodes_batch_socks5Tab": "SOCKS5",
  "extraNodes_batch_rawTab": "Raw Lines",
  "extraNodes_batch_nodeList": "Node List",
  "extraNodes_batch_nodeListHint": "Format: user:pass@host:port, one per line",
  "extraNodes_batch_refreshTemplate": "Refresh URL Template",
  "extraNodes_batch_refreshTemplateHint": "{{placeholder}} is replaced with the username (without -sesstime-XX)",
  "extraNodes_batch_surgeLines": "Surge Node Lines",
  "extraNodes_batch_surgeLinesHint": "Paste full Surge proxy lines, one per line. All protocols supported:",
  "extraNodes_batch_surgeLinesPlaceholder": "NodeName = protocol, server, port, params...",
  "extraNodes_batch_valid": "{{count}} valid",
  "extraNodes_batch_invalid": "{{count}} invalid",
  "extraNodes_batch_willAdd": "Will add {{count}} nodes",
  "extraNodes_batch_importCount": "Import {{count}}",
  "extraNodes_batch_importBtn": "Import",
  "extraNodes_batch_addCount": "Add {{count}}",
  "extraNodes_batch_addBtn": "Add",
  "extraNodes_test_testing": "Testing…",
  "extraNodes_test_failed": "Failed",
  "extraNodes_test_clean": "Clean",
  "extraNodes_test_hosting": "Hosting",
  "extraNodes_test_proxy": "Proxy",
  "output_page_title": "Build Configuration",
  "output_page_subtitle": "Define your template logic and file destinations for the final Surge profile.",
  "output_page_outputPathLabel": "Output Path",
  "output_page_outputFilenameLabel": "Output Filename",
  "output_page_outputFilenameHint": "This file is overwritten on every generate. Backups are stored separately in the app data folder.",
  "output_page_regenerateLabel": "Regenerate on refresh",
  "output_page_regenerateHint": "Automatically rebuild on local file change",
  "output_page_minifyLabel": "Minify Output",
  "output_page_minifyHint": "Remove comments and whitespace",
  "output_page_previewBtn": "Preview Config",
  "output_page_generateBtn": "Generate Config",
  "output_page_generatingBtn": "Generating...",
  "output_page_statusLabel": "Status:",
  "output_page_statusReady": "Ready",
  "output_page_lastBuildLabel": "Last Build:",
  "output_page_yesterday": "Yesterday",
  "output_page_buildHistoryTitle": "Build History",
  "output_page_clearAllBtn": "Clear All",
  "output_page_noBuilds": "No builds yet. Click Generate to create your first config.",
  "output_page_noChange": "No change",
  "output_page_selectOutputDir": "Select Output Directory",
  "output_page_previewTitle": "Config Preview",
  "output_page_noPreviewData": "No config data. Add subscriptions and rules first.",
  "output_page_historyVersionsBtn": "History Versions",
  "output_page_historyVersionsTitle": "Backup History",
  "output_page_noBackups": "No backup files found.",
  "output_page_backupPreview": "Diff vs Current",
  "output_page_diffHint": "red = removed from backup · green = added in current · left: backup · right: current",
  "output_page_rollback": "Rollback",
  "output_page_rollbackConfirm": "Restore this version to the Surge profile directory?",
  "output_page_rollbackSuccess": "Rollback successful",
  "output_page_rollbackFailed": "Rollback failed",
  "output_page_backupCreated": "Created",
  "output_page_backupSize": "Size",
  "output_page_rollbackConfirmTitle": "Confirm Rollback",
  "output_page_cancel": "Cancel",
  "settings_page_title": "Settings",
  "settings_page_subtitle": "Manage app configuration and preferences",
  "settings_page_selectedCount": "{{count}} selected",
  "settings_page_selectAll": "Select All",
  "settings_page_deselectAll": "Deselect All",
  "settings_page_empty": "No items",
  "settings_page_emptyHint": "Add items to see them here",
  "settings_page_deleteTitle": "Delete {{count}} items",
  "settings_page_removeTitle": "Remove",
  "settings_page_removeDesc": "Remove this item?",
  "settings_general_sectionTitle": "General",
  "settings_general_httpListenLabel": "HTTP Listen",
  "settings_general_httpListenHint": "Local HTTP proxy address and port",
  "settings_general_socks5ListenLabel": "SOCKS5 Listen",
  "settings_general_socks5ListenHint": "Local SOCKS5 proxy address and port",
  "settings_general_extraLinesLabel": "Extra [General] Lines",
  "settings_general_extraLinesHint": "Additional key=value entries for the [General] section, one per line.",
  "settings_general_saveBtn": "Save General",
  "settings_httpListen_breadcrumb": "Dashboard / General",
  "settings_httpListen_title": "General",
  "settings_mitm_sectionTitle": "MITM",
  "settings_mitm_title": "MITM",
  "settings_mitm_breadcrumb": "Dashboard / MITM",
  "settings_mitm_label": "[MITM] Section Content",
  "settings_mitm_hint": "Raw content of the [MITM] section. Typically contains hostname = *.example.com and other MITM settings.",
  "settings_host_sectionTitle": "Host",
  "settings_host_label": "[Host] Section Content",
  "settings_host_hint": "DNS mapping rules. Maps domain names to IP addresses or other domains.",
  "settings_urlRewrite_sectionTitle": "URL Rewrite",
  "settings_urlRewrite_name": "URL Rewrite",
  "settings_urlRewrite_subtitle": "Manage HTTP URL rewrite rules",
  "settings_urlRewrite_label": "[URL Rewrite] Section Content",
  "settings_urlRewrite_hint": "HTTP URL rewrite rules. Format: regex replacement type (302 / 307 / reject / header).",
  "settings_urlRewrite_pattern": "Pattern (Regex)",
  "settings_urlRewrite_replacement": "Replacement",
  "settings_urlRewrite_redirectType": "Redirect Type",
  "settings_cloudSync_sectionTitle": "Cloud Sync",
  "settings_cloudSync_enableLabel": "Enable Cloud Sync",
  "settings_cloudSync_enableHint": "Sync configuration to a GitHub private repository",
  "settings_cloudSync_patLabel": "GitHub Personal Access Token",
  "settings_cloudSync_patHint": "Requires 'repo' scope. Create at GitHub → Settings → Developer settings → Personal access tokens",
  "settings_cloudSync_repoUrlLabel": "Repository",
  "settings_cloudSync_repoUrlHint": "Format: owner/repo-name (the repository must already exist)",
  "settings_cloudSync_autoSyncLabel": "Auto-sync after Generate",
  "settings_cloudSync_autoSyncHint": "Automatically push to cloud after generating configuration",
  "settings_cloudSync_lastSynced": "Last synced",
  "settings_cloudSync_saveBtn": "Save Settings",
  "settings_cloudSync_syncNow": "Sync Now",
  "settings_cloudSync_conflictTitle": "Sync Conflict Detected",
  "settings_cloudSync_conflictHint": "Both local and cloud have changes. Choose which version to keep:",
  "settings_cloudSync_keepLocal": "Keep Local",
  "settings_cloudSync_keepCloud": "Keep Cloud",
  "settings_dialog_trigger": "Add",
  "settings_dialog_title": "Add",
  "settings_dialog_addTitle": "Add {{name}}",
  "settings_dialog_add": "Add",
  "settings_tabs_single": "Single",
  "settings_tabs_batch": "Batch",
  "settings_batch_title": "Batch Add",
  "settings_batch_hint": "Enter one per line",
  "settings_batch_hintUrlRewrite": "Enter one rewrite per line: pattern replacement type",
  "settings_batch_willAdd": "will be added",
  "settings_batch_addCount": "Add {{count}}",
  "settings_batch_add": "Add",
  "settings_edit_title": "Edit",
  "settings_edit_enabled": "Enabled",
  "settings_edit_save": "Save",
  "settings_actions_cancel": "Cancel",
  "settings_saveSectionsBtn": "Save MITM / Host / URL Rewrite",
  "hosts_page_title": "Hosts",
  "hosts_page_subtitle": "Manage DNS mappings for Surge",
  "hosts_page_selectedCount": "{{count}} selected",
  "hosts_page_selectAll": "Select All",
  "hosts_page_deselectAll": "Deselect All",
  "hosts_page_empty": "No hosts configured",
  "hosts_page_emptyHint": "Add hosts to map domains to IP addresses",
  "hosts_page_deleteTitle": "Delete {{count}} hosts",
  "hosts_page_removeTitle": "Remove Host",
  "hosts_page_removeDesc": "Remove {{domain}} from hosts?",
  "hosts_dialog_trigger": "Add Host",
  "hosts_dialog_title": "Add Host",
  "hosts_tabs_single": "Single",
  "hosts_tabs_batch": "Batch",
  "hosts_single_domain": "Domain",
  "hosts_single_ip": "IP Address",
  "hosts_batch_title": "Batch Add Hosts",
  "hosts_batch_hint": "Enter one host per line in format: domain = ip",
  "hosts_batch_willAdd": "will be added",
  "hosts_batch_addCount": "Add {{count}}",
  "hosts_batch_add": "Add",
  "hosts_edit_title": "Edit Host",
  "hosts_edit_enabled": "Enabled",
  "hosts_edit_save": "Save",
  "hosts_status_enabled": "Enabled",
  "hosts_status_disabled": "Disabled",
  "hosts_actions_enable": "Enable",
  "hosts_actions_disable": "Disable",
  "hosts_actions_edit": "Edit",
  "hosts_actions_delete": "Delete"
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json'))" && echo "Valid JSON"`
Expected: Valid JSON

- [ ] **Step 3: Commit**

```bash
git add src/locales/en.json
git commit -m "feat(i18n): create merged en.json locale file"
```

---

## Task 2: 创建合并后的 `zh.json`

**文件:**
- Create: `src/locales/zh.json`

- [ ] **Step 1: Write merged zh.json**（使用对应的中文内容，遵循 en.json 相同的 key 结构）

```json
{
  "nav": {
    "subscriptions": "订阅",
    "rules": "规则",
    "extraNodes": "额外节点",
    "output": "输出",
    "settings": "设置",
    "httpListen": "通用",
    "mitm": "MITM",
    "hosts": "HOST",
    "urlRewrites": "URL 重写",
    "cloudSync": "云同步"
  },
  "actions": {
    "add": "添加",
    "cancel": "取消",
    "save": "保存",
    "remove": "删除",
    "delete": "删除",
    "refresh": "刷新",
    "import": "导入",
    "enable": "启用",
    "disable": "禁用",
    "edit": "编辑",
    "generateConfig": "生成配置"
  },
  "status": {
    "loading": "加载中…",
    "saved": "已保存！",
    "never": "从未",
    "justNow": "刚刚",
    "enabled": "已启用",
    "disabled": "已禁用"
  },
  "confirm": {
    "cannotUndo": "此操作无法撤销。"
  },
  "subscriptions_page_title": "订阅",
  "subscriptions_page_emptyTitle": "添加新来源",
  "subscriptions_page_emptyHint": "连接 Surge 订阅 URL 以管理代理节点。",
  "subscriptions_page_removeTitle": "删除订阅？",
  "subscriptions_page_removeDesc": "\"{{name}}\" 及其所有缓存数据将被删除。",
  "subscriptions_dialog_triggerLabel": "添加订阅",
  "subscriptions_dialog_addTitle": "添加订阅",
  "subscriptions_dialog_fromUrl": "从 URL 导入",
  "subscriptions_dialog_fromFile": "从文件导入",
  "subscriptions_dialog_nameLabel": "名称",
  "subscriptions_dialog_namePlaceholder": "例如：ImmTelecom",
  "subscriptions_dialog_urlLabel": "订阅 URL",
  "subscriptions_dialog_urlPlaceholder": "https://...",
  "subscriptions_dialog_fileLabel": "文件路径",
  "subscriptions_dialog_filePlaceholder": "选择 .conf 文件...",
  "subscriptions_dialog_filePickerTitle": "选择 Surge 配置文件",
  "subscriptions_card_primary": "主订阅",
  "subscriptions_card_local": "本地",
  "subscriptions_card_url": "URL",
  "subscriptions_card_nodesCount": "{{count}} 个节点",
  "subscriptions_card_setPrimary": "设为主订阅",
  "subscriptions_card_refreshNow": "立即刷新",
  "subscriptions_card_remove": "删除",
  "subscriptions_card_primaryInfo": "主订阅 — 代理组和规则将写入生成的配置文件",
  "subscriptions_card_secondaryInfo": "副订阅 — 仅包含节点（代理组和规则不会写入）",
  "subscriptions_card_refreshError": "上次刷新失败 — 使用上次缓存的内容",
  "subscriptions_card_lastRefreshed": "最近刷新",
  "subscriptions_card_source": "来源",
  "subscriptions_card_interval": "间隔",
  "subscriptions_card_status": "状态",
  "subscriptions_card_localFile": "本地文件",
  "subscriptions_card_expires": "到期：{{date}}",
  "subscriptions_timeAgo_minsAgo": "{{count}} 分钟前",
  "subscriptions_timeAgo_hoursAgo": "{{count}} 小时前",
  "subscriptions_timeAgo_daysAgo": "{{count}} 天前",
  "rules_page_title": "规则",
  "rules_page_ruleSetsTitle": "远程规则集",
  "rules_page_individualTitle": "单条规则",
  "rules_page_emptyRuleSets": "暂无远程规则集。",
  "rules_page_emptyIndividual": "暂无单条规则。",
  "rules_page_fromSubscriptions": "来自订阅",
  "rules_page_removeRuleSetTitle": "删除规则集？",
  "rules_page_removeRuleSetDesc": "\"{{name}}\" 将被永久删除。",
  "rules_page_removeRuleTitle": "删除规则？",
  "rules_page_removeRuleDesc": "{{type}}, {{value}} 将被永久删除。",
  "rules_page_batchDeleteRulesTitle": "删除 {{count}} 条规则？",
  "rules_page_batchDeleteRuleSetsTitle": "删除 {{count}} 个规则集？",
  "rules_addRuleSet_trigger": "添加规则集",
  "rules_addRuleSet_title": "添加远程规则集",
  "rules_addRuleSet_nameLabel": "名称",
  "rules_addRuleSet_namePlaceholder": "例如：AI Services",
  "rules_addRuleSet_urlLabel": "规则列表 URL",
  "rules_addRuleSet_urlPlaceholder": "https://raw.githubusercontent.com/...",
  "rules_addRuleSet_policyLabel": "策略",
  "rules_addRule_trigger": "添加单条规则",
  "rules_addRule_title": "添加单条规则",
  "rules_addRule_typeLabel": "类型",
  "rules_addRule_valueLabel": "值",
  "rules_addRule_policyLabel": "策略",
  "rules_addRule_commentLabel": "备注（可选）",
  "rules_batchImport_trigger": "批量导入",
  "rules_batchImport_title": "批量导入规则",
  "rules_batchImport_rulesLabel": "规则（每行一条）",
  "rules_batchImport_defaultTypeLabel": "默认类型",
  "rules_batchImport_defaultPolicyLabel": "默认策略",
  "rules_batchImport_valid": "{{count}} 条有效",
  "rules_batchImport_invalid": "{{count}} 条无效",
  "rules_batchImport_importRules": "导入 {{count}} 条规则",
  "rules_batchImport_importBtn": "导入",
  "rules_policyPicker_placeholder": "选择策略…",
  "rules_policyPicker_searchPlaceholder": "搜索策略或节点…",
  "rules_policyPicker_noResults": "无结果",
  "extraNodes_page_title": "额外节点",
  "extraNodes_page_subtitle": "手动添加不属于任何订阅的代理节点。",
  "extraNodes_page_selectedCount": "已选 {{count}} 个",
  "extraNodes_page_deleteTitle": "删除 {{count}} 个节点？",
  "extraNodes_page_deselectAll": "取消全选",
  "extraNodes_page_selectAll": "全选",
  "extraNodes_page_empty": "暂无额外节点",
  "extraNodes_page_emptyHint": "添加自定义代理节点，支持可选的刷新 URL。",
  "extraNodes_page_removeTitle": "删除节点？",
  "extraNodes_page_removeDesc": "\"{{name}}\" 将被永久删除。",
  "extraNodes_dialog_trigger": "添加节点",
  "extraNodes_dialog_title": "添加节点",
  "extraNodes_tabs_single": "逐个添加",
  "extraNodes_tabs_batch": "批量添加",
  "extraNodes_single_protocol": "协议",
  "extraNodes_single_name": "节点名称",
  "extraNodes_single_server": "服务器",
  "extraNodes_single_port": "端口",
  "extraNodes_single_username": "用户名",
  "extraNodes_single_password": "密码",
  "extraNodes_single_encryptMethod": "加密方式",
  "extraNodes_single_skipVerify": "跳过证书验证",
  "extraNodes_single_refreshUrl": "Refresh URL",
  "extraNodes_single_optional": "可选",
  "extraNodes_single_disabled": "不启用",
  "extraNodes_single_yes": "是",
  "extraNodes_single_no": "否",
  "extraNodes_batch_socks5Tab": "SOCKS5",
  "extraNodes_batch_rawTab": "原始行",
  "extraNodes_batch_nodeList": "节点列表",
  "extraNodes_batch_nodeListHint": "格式：user:pass@host:port，每行一个",
  "extraNodes_batch_refreshTemplate": "Refresh URL 模板",
  "extraNodes_batch_refreshTemplateHint": "{{placeholder}} 替换为用户名（去掉 -sesstime-XX）",
  "extraNodes_batch_surgeLines": "Surge 节点行",
  "extraNodes_batch_surgeLinesHint": "粘贴完整的 Surge 代理行，每行一个节点，支持所有协议：",
  "extraNodes_batch_surgeLinesPlaceholder": "节点名 = 协议, 服务器, 端口, 参数...",
  "extraNodes_batch_valid": "{{count}} 有效",
  "extraNodes_batch_invalid": "{{count}} 无效",
  "extraNodes_batch_willAdd": "将添加 {{count}} 个节点",
  "extraNodes_batch_importCount": "导入 {{count}} 个",
  "extraNodes_batch_importBtn": "导入",
  "extraNodes_batch_addCount": "添加 {{count}} 个",
  "extraNodes_batch_addBtn": "添加",
  "extraNodes_test_testing": "测试中…",
  "extraNodes_test_failed": "失败",
  "extraNodes_test_clean": "纯净",
  "extraNodes_test_hosting": "托管",
  "extraNodes_test_proxy": "代理",
  "output_page_title": "生成配置",
  "output_page_subtitle": "定义最终 Surge 配置文件的模板逻辑和输出路径。",
  "output_page_outputPathLabel": "输出路径",
  "output_page_outputFilenameLabel": "输出文件名",
  "output_page_outputFilenameHint": "每次生成都会覆盖此文件。备份文件单独存放在应用数据目录中。",
  "output_page_regenerateLabel": "刷新后自动重新生成",
  "output_page_regenerateHint": "本地文件变更后自动重新构建",
  "output_page_minifyLabel": "压缩输出",
  "output_page_minifyHint": "删除注释和空白字符",
  "output_page_previewBtn": "预览配置",
  "output_page_generateBtn": "生成配置",
  "output_page_generatingBtn": "生成中…",
  "output_page_statusLabel": "状态：",
  "output_page_statusReady": "就绪",
  "output_page_lastBuildLabel": "上次构建：",
  "output_page_yesterday": "昨天",
  "output_page_buildHistoryTitle": "构建历史",
  "output_page_clearAllBtn": "清空",
  "output_page_noBuilds": "暂无构建记录。点击\"生成配置\"创建第一个配置文件。",
  "output_page_noChange": "无变化",
  "output_page_selectOutputDir": "选择输出目录",
  "output_page_previewTitle": "配置预览",
  "output_page_noPreviewData": "暂无配置数据，请先添加订阅和规则。",
  "output_page_historyVersionsBtn": "历史版本",
  "output_page_historyVersionsTitle": "备份历史",
  "output_page_noBackups": "暂无备份文件。",
  "output_page_backupPreview": "与当前版本对比",
  "output_page_diffHint": "红色 = 备份中删除 · 绿色 = 当前新增 · 左=备份版本 · 右=当前版本",
  "output_page_rollback": "回退",
  "output_page_rollbackConfirm": "确定要恢复此版本到 Surge 配置目录吗？",
  "output_page_rollbackSuccess": "回退成功",
  "output_page_rollbackFailed": "回退失败",
  "output_page_backupCreated": "创建时间",
  "output_page_backupSize": "大小",
  "output_page_rollbackConfirmTitle": "确认回退",
  "output_page_cancel": "取消",
  "settings_page_title": "设置",
  "settings_page_subtitle": "管理应用配置和偏好设置",
  "settings_page_selectedCount": "已选择 {{count}} 项",
  "settings_page_selectAll": "全选",
  "settings_page_deselectAll": "取消全选",
  "settings_page_empty": "暂无内容",
  "settings_page_emptyHint": "添加内容后在此显示",
  "settings_page_deleteTitle": "删除 {{count}} 项",
  "settings_page_removeTitle": "删除",
  "settings_page_removeDesc": "确定删除此条？",
  "settings_general_sectionTitle": "通用",
  "settings_general_httpListenLabel": "HTTP 监听",
  "settings_general_httpListenHint": "本地 HTTP 代理地址和端口",
  "settings_general_socks5ListenLabel": "SOCKS5 监听",
  "settings_general_socks5ListenHint": "本地 SOCKS5 代理地址和端口",
  "settings_general_extraLinesLabel": "额外 [General] 配置行",
  "settings_general_extraLinesHint": "[General] 区块的额外 key=value 配置，每行一条。",
  "settings_general_saveBtn": "保存通用设置",
  "settings_httpListen_breadcrumb": "首页 / 通用",
  "settings_httpListen_title": "通用",
  "settings_mitm_sectionTitle": "MITM",
  "settings_mitm_title": "MITM",
  "settings_mitm_breadcrumb": "首页 / MITM",
  "settings_mitm_label": "[MITM] 区块内容",
  "settings_mitm_hint": "[MITM] 区块的原始内容，通常包含 hostname = *.example.com 等 MITM 设置。",
  "settings_host_sectionTitle": "Host",
  "settings_host_label": "[Host] 区块内容",
  "settings_host_hint": "DNS 映射规则，将域名映射到 IP 地址或其他域名。",
  "settings_urlRewrite_sectionTitle": "URL Rewrite",
  "settings_urlRewrite_name": "URL 重写",
  "settings_urlRewrite_subtitle": "管理 HTTP URL 重写规则",
  "settings_urlRewrite_label": "[URL Rewrite] 区块内容",
  "settings_urlRewrite_hint": "HTTP URL 重写规则，格式：正则表达式 替换内容 类型（302 / 307 / reject / header）。",
  "settings_urlRewrite_pattern": "匹配模式（正则）",
  "settings_urlRewrite_replacement": "替换内容",
  "settings_urlRewrite_redirectType": "重定向类型",
  "settings_cloudSync_sectionTitle": "云同步",
  "settings_cloudSync_enableLabel": "启用云同步",
  "settings_cloudSync_enableHint": "将配置同步到 GitHub 私有仓库",
  "settings_cloudSync_patLabel": "GitHub 个人访问令牌",
  "settings_cloudSync_patHint": "需要 'repo' 权限。在 GitHub → Settings → Developer settings → Personal access tokens 创建",
  "settings_cloudSync_repoUrlLabel": "仓库地址",
  "settings_cloudSync_repoUrlHint": "格式：owner/repo-name（仓库必须已存在）",
  "settings_cloudSync_autoSyncLabel": "生成后自动同步",
  "settings_cloudSync_autoSyncHint": "生成配置后自动推送到云端",
  "settings_cloudSync_lastSynced": "上次同步",
  "settings_cloudSync_saveBtn": "保存设置",
  "settings_cloudSync_syncNow": "立即同步",
  "settings_cloudSync_conflictTitle": "检测到同步冲突",
  "settings_cloudSync_conflictHint": "本地和云端都有变更。请选择保留哪个版本：",
  "settings_cloudSync_keepLocal": "保留本地",
  "settings_cloudSync_keepCloud": "保留云端",
  "settings_dialog_trigger": "添加",
  "settings_dialog_title": "添加",
  "settings_dialog_addTitle": "添加{{name}}",
  "settings_dialog_add": "添加",
  "settings_tabs_single": "单个",
  "settings_tabs_batch": "批量",
  "settings_batch_title": "批量添加",
  "settings_batch_hint": "每行一条",
  "settings_batch_hintUrlRewrite": "每行一条，格式：匹配模式 替换内容 类型",
  "settings_batch_willAdd": "将被添加",
  "settings_batch_addCount": "添加 {{count}} 个",
  "settings_batch_add": "添加",
  "settings_edit_title": "编辑",
  "settings_edit_enabled": "启用",
  "settings_edit_save": "保存",
  "settings_actions_cancel": "取消",
  "settings_saveSectionsBtn": "保存 MITM / Host / URL Rewrite",
  "hosts_page_title": "HOST",
  "hosts_page_subtitle": "管理 Surge 的 DNS 映射",
  "hosts_page_selectedCount": "已选择 {{count}} 项",
  "hosts_page_selectAll": "全选",
  "hosts_page_deselectAll": "取消全选",
  "hosts_page_empty": "暂无 HOST 配置",
  "hosts_page_emptyHint": "添加 HOST 将域名映射到 IP 地址",
  "hosts_page_deleteTitle": "删除 {{count}} 个 HOST",
  "hosts_page_removeTitle": "删除 HOST",
  "hosts_page_removeDesc": "确定删除 {{domain}}？",
  "hosts_dialog_trigger": "添加 HOST",
  "hosts_dialog_title": "添加 HOST",
  "hosts_tabs_single": "单个",
  "hosts_tabs_batch": "批量",
  "hosts_single_domain": "域名",
  "hosts_single_ip": "IP 地址",
  "hosts_batch_title": "批量添加 HOST",
  "hosts_batch_hint": "每行一个，格式：域名 = IP",
  "hosts_batch_willAdd": "将被添加",
  "hosts_batch_addCount": "添加 {{count}} 个",
  "hosts_batch_add": "添加",
  "hosts_edit_title": "编辑 HOST",
  "hosts_edit_enabled": "启用",
  "hosts_edit_save": "保存",
  "hosts_status_enabled": "已启用",
  "hosts_status_disabled": "已禁用",
  "hosts_actions_enable": "启用",
  "hosts_actions_disable": "禁用",
  "hosts_actions_edit": "编辑",
  "hosts_actions_delete": "删除"
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/zh.json'))" && echo "Valid JSON"`
Expected: Valid JSON

- [ ] **Step 3: Commit**

```bash
git add src/locales/zh.json
git commit -m "feat(i18n): create merged zh.json locale file"
```

---

## Task 3: 更新 `src/i18n.ts`

**文件:**
- Modify: `src/i18n.ts`

- [ ] **Step 1: Write simplified i18n.ts**

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zh from "./locales/zh.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    fallbackLng: "en",
    load: "languageOnly",
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "scm_language",
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
```

- [ ] **Step 2: Verify it loads**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/i18n.ts
git commit -m "feat(i18n): simplify i18n.ts to use single locale files"
```

---

## Task 4: 更新所有 `useTranslation()` 调用

**文件:**
- Modify: `src/pages/Subscriptions.tsx`
- Modify: `src/pages/Rules.tsx`
- Modify: `src/pages/ExtraNodes.tsx`
- Modify: `src/pages/HostPage.tsx`
- Modify: `src/pages/UrlRewritePage.tsx`
- Modify: `src/pages/Output.tsx`
- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/CloudSyncPage.tsx`
- Modify: `src/pages/HttpListenPage.tsx`
- Modify: `src/pages/MitmPage.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/CloudSyncConflictDialog.tsx`

所有 `useTranslation("xxx")` 改为 `useTranslation()`，去掉 namespace 参数。

所有 `t("key")` 调用需要更新 key 前缀：
- `t("page.xxx")` 在 Subscriptions → `t("subscriptions_page_xxx")`
- `t("page.xxx")` 在 Rules → `t("rules_page_xxx")`
- `t("page.xxx")` 在 ExtraNodes → `t("extraNodes_page_xxx")`
- `t("page.xxx")` 在 Hosts → `t("hosts_page_xxx")`
- `t("page.xxx")` 在 Output → `t("output_page_xxx")`
- `t("page.xxx")` 在 Settings/UrlRewrite/HttpListen/Mitm/CloudSync → `t("settings_page_xxx")`
- `t("dialog.xxx")` 等也同理

注意：`tc()` 调用（来自 `common` namespace）改为 `t()`，且 key 不变（因为 `common.*` keys 无前缀）。

- [ ] **Step 1: Update Subscriptions.tsx**
- [ ] **Step 2: Update Rules.tsx**
- [ ] **Step 3: Update ExtraNodes.tsx**
- [ ] **Step 4: Update HostPage.tsx**
- [ ] **Step 5: Update UrlRewritePage.tsx**
- [ ] **Step 6: Update Output.tsx**
- [ ] **Step 7: Update Settings.tsx**
- [ ] **Step 8: Update CloudSyncPage.tsx**
- [ ] **Step 9: Update HttpListenPage.tsx**
- [ ] **Step 10: Update MitmPage.tsx**
- [ ] **Step 11: Update Sidebar.tsx**
- [ ] **Step 12: Update ConfirmDialog.tsx**
- [ ] **Step 13: Update CloudSyncConflictDialog.tsx**
- [ ] **Step 14: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 15: Commit**

```bash
git add src/pages/ src/components/
git commit -m "feat(i18n): update all useTranslation() calls to single namespace"
```

---

## Task 5: 简化检测脚本

**文件:**
- Modify: `scripts/check-i18n.mjs`

删除 Stage 2，只保留 Stage 1（key 存在性检查）。简化逻辑：扫描所有 `t("xxx")` 调用，验证 key 存在于 `en.json` 或 `zh.json`。

- [ ] **Step 1: Write simplified check-i18n.mjs**

```javascript
#!/usr/bin/env node
/**
 * check-i18n.mjs
 *
 * Validates that every t() key used in source files exists in the locale files.
 *
 * Run: node scripts/check-i18n.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, "../src");
const LOCALES_DIR = join(__dirname, "../src/locales");

function loadLocales() {
  const en = JSON.parse(readFileSync(join(LOCALES_DIR, "en.json"), "utf-8"));
  const zh = JSON.parse(readFileSync(join(LOCALES_DIR, "zh.json"), "utf-8"));
  return { en, zh };
}

function flattenObject(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

function extractKeysFromFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const tCallRegex = /\bt\s*\(\s*(["'`])([^"'`\\]+?)\1\s*(?:,|\))/g;
  const results = [];
  let match;
  while ((match = tCallRegex.exec(content)) !== null) {
    const key = match[2];
    if (!key) continue;
    if (key.includes("/") || key.startsWith("@")) continue;
    results.push(key);
  }
  return results;
}

function scanSource(dir) {
  const allKeys = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "components/ui"].includes(entry.name)) continue;
      allKeys.push(...scanSource(fullPath));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      allKeys.push(...extractKeysFromFile(fullPath));
    }
  }
  return allKeys;
}

function validate() {
  const { en, zh } = loadLocales();
  const enFlat = flattenObject(en);
  const zhFlat = flattenObject(zh);
  const sourceKeys = scanSource(SRC_DIR);

  const allKeys = new Set([...Object.keys(enFlat), ...Object.keys(zhFlat)]);
  let hasErrors = false;

  for (const key of sourceKeys) {
    if (!allKeys.has(key)) {
      console.error(`❌ Missing key: '${key}' — not found in any locale file`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("\n💥 i18n validation failed — missing keys above");
    process.exit(1);
  } else {
    console.log(`✅ All ${sourceKeys.length} i18n keys are valid (checked against en.json + zh.json)`);
    process.exit(0);
  }
}

validate();
```

- [ ] **Step 2: Run the script**

Run: `node scripts/check-i18n.mjs`
Expected: ✅ All i18n keys are valid

- [ ] **Step 3: Commit**

```bash
git add scripts/check-i18n.mjs
git commit -m "feat(i18n): simplify check-i18n to single key-existence check"
```

---

## Task 6: 删除旧的 locale 目录

**文件:**
- Delete: `src/locales/en/` 目录（7 个文件）
- Delete: `src/locales/zh/` 目录（7 个文件）

- [ ] **Step 1: Delete old locale directories**

```bash
rm -rf src/locales/en src/locales/zh
git add -A
git commit -m "feat(i18n): remove old namespace locale directories"
```

---

## Task 7: 最终验证

- [ ] **Step 1: Run full verification**

Run: `npx tsc --noEmit && node scripts/check-i18n.mjs && pnpm lint`
Expected: All pass

- [ ] **Step 2: Final commit if needed**

---

## 验收标准回顾

- [ ] AC-01: 应用正常运行，所有现有 UI 文字显示与重构前一致
- [ ] AC-02: 检测脚本简化为单一检查：`t("key")` 在对应语言文件中存在，所有 key 无缺失
- [ ] AC-03: CI 和 pre-commit hook 验证通过
- [ ] AC-04: TypeScript 编译通过，无 namespace 相关类型错误
- [ ] AC-05: `npx tsc --noEmit && node scripts/check-i18n.mjs && pnpm lint` 全部通过
