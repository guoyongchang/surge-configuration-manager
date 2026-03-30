# 云同步闭环优化

## 背景
当前"从云端恢复"和"立即同步"操作缺乏冲突检测和数据差异展示，用户可能在不知情的情况下丢失数据。恢复操作无确认、时间戳不更新、无并发保护，且同步范围不完整。需要将整个云同步流程形成闭环，确保数据安全和用户体验。

## 范围
### 包含
- CloudSyncPage "Sync Now" 前置冲突检测：推送前检查差异，有冲突弹出对话框
- CloudSyncPage "Restore from Cloud" 前置冲突检测：恢复前检查差异，有冲突弹出对话框
- "Restore from Cloud" 增加确认对话框：提醒本地数据将被覆盖
- 冲突对话框优化：展示实际变更的文件列表和具体数据差异（而非 manifest SHA）
- 恢复后更新 `last_synced_at`：修复时间戳不更新的 bug
- 同步操作并发保护：同步进行中按钮置灰，防止重复触发
- 同步部分失败回滚机制：推送过程中某文件失败时确保云端数据一致性
- 扩大同步范围：纳入 `general_settings`、`disabled_sub_rule_keys`、`mitm_section`
- 后端 Rust 单元测试：cloud_sync 模块核心逻辑测试覆盖
- 前端组件测试：CloudSyncPage、CloudSyncConflictDialog 测试覆盖

### 不包含
- PAT 验证 / 连通性测试（保存设置时不验证 PAT 有效性）

## 验收标准
- [ ] AC-01: 在 CloudSyncPage 点击"Sync Now"，若本地与云端存在差异，弹出冲突对话框展示具体变更的文件列表和数据差异；若无差异则直接同步成功
- [ ] AC-02: 在 CloudSyncPage 点击"Restore from Cloud"，先弹出确认对话框提醒"本地数据将被覆盖"；确认后再检查冲突，若有差异展示冲突对话框让用户选择
- [ ] AC-03: 冲突对话框展示每个变更文件的名称和具体数据内容 diff（而非 manifest SHA），用户可选择"保留本地"或"保留云端"
- [ ] AC-04: "Restore from Cloud" 完成后，`last_synced_at` 正确更新为当前时间
- [ ] AC-05: 同步进行中，"Sync Now" 和 "Restore from Cloud" 按钮置灰不可点击，防止并发触发
- [ ] AC-06: `sync_to_cloud` 推送多个文件时，若中间某文件失败，已推送成功的文件回滚（或采用其他策略确保云端数据一致性）
- [ ] AC-07: `general_settings`、`disabled_sub_rule_keys`、`mitm_section` 三项数据纳入同步范围，云端可见对应文件且 manifest 包含其 SHA
- [ ] AC-08: `cloud_sync.rs` 新增 Rust 单元测试，覆盖 manifest 构建、diff 计算、冲突检测等核心逻辑
- [ ] AC-09: CloudSyncPage 和 CloudSyncConflictDialog 新增前端测试，覆盖冲突检测流程、按钮状态、对话框交互
- [ ] AC-10: `pnpm test` 通过

## 技术备注
- 同步文件从 7 个扩展到 10 个（新增 `general_settings/data.json`、`disabled_sub_rule_keys/data.json`、`mitm_section/data.json`）
- 冲突检测需后端返回文件级别的变更详情（哪些文件变更 + 各文件内容），供前端 diff 展示
- 并发保护可使用前端 `isSyncing` 状态锁 + 后端 Mutex 互斥锁双重保障
- 回滚策略建议：推送前记录云端原始内容，失败时按序回退已推送文件
- `sync_from_cloud` 命令需增加 `last_synced_at` 更新逻辑
