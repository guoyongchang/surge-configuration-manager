# 云同步目录结构设计

## 背景

将云同步从单文件（`scm_data.json`）改为目录结构，符合 spec 要求的 `subscriptions/`、`rules/`、`nodes/`、`output/` 组织方式。

## 目录结构

```
manifest.json              — 版本清单（含每个文件的 SHA）
subscriptions/data.json    — Vec<Subscription>
rules/remote.json         — Vec<RemoteRuleSet>
rules/individual.json      — Vec<IndividualRule>
nodes/data.json            — Vec<ExtraNode>
output/config.json         — OutputConfig
```

> 注：`build_history` 不同步，Host/URL Rewrite/MITM 等 extra sections 暂不包含在同步范围内。

## manifest.json 格式

```json
{
  "version": 1,
  "files": {
    "subscriptions/data.json": { "sha": "abc123..." },
    "rules/remote.json": { "sha": "def456..." },
    "rules/individual.json": { "sha": "ghi789..." },
    "nodes/data.json": { "sha": "jkl012..." },
    "output/config.json": { "sha": "mno345..." }
  }
}
```

SHA 用于检测文件是否变化，不存储文件内容本身。

## 推送流程（sync_to_cloud）

1. 构造本地 `manifest.json`（计算每个 section 文件的 SHA）
2. 获取云端 `manifest.json`（如果存在）
3. 对比本地 vs 云端 manifest，找出有变化的文件
4. 对每个变化的文件执行 `PUT /repos/{owner}/{repo}/contents/{path}`（带上 SHA 实现更新）
5. 最后推送 `manifest.json`

> 注：首次推送（云端无 manifest）时，直接推送所有文件 + manifest。

## 拉取流程（sync_from_cloud）

1. 获取云端 `manifest.json`
2. 对比本地 manifest，找出云端有变化的文件
3. 对每个变化的文件执行 `GET /repos/{owner}/{repo}/contents/{path}`，解析内容
4. 更新本地数据并保存
5. 保存新的本地 manifest

## 冲突检测（check_sync_conflict）

1. 获取云端 `manifest.json`
2. 计算本地 manifest
3. 对比两者的 SHA，不一致则判定有冲突
4. 返回冲突信息（local_content/cloud_content 改为返回各自的 manifest JSON）

## 不包含

- 旧 `scm_data.json` 的兼容或迁移
- `build_history` 同步
- Host/URL Rewrite/MITM sections 同步

## 验收标准

- [ ] AC-02: 手动点击"同步"按钮，将本地数据以目录结构推送到 GitHub
- [ ] AC-04: 从云端拉取目录结构数据并覆盖本地
- [ ] AC-05: 检测到云端与本地版本不一致时，显示两版本供用户选择
- [ ] AC-06: 用户确认冲突解决方案后，完成同步并更新时间戳
