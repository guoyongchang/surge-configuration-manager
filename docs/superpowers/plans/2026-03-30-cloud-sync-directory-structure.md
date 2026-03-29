# 云同步目录结构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将云同步从单文件改为目录结构，推送/拉取 `manifest.json` + 5 个 section 文件。

**Architecture:** 在 `cloud_sync.rs` 中新增 `CloudSyncManifest` 结构和文件级别的 push/pull 方法，`commands.rs` 中的三个命令改为基于 manifest diff 工作。

**Tech Stack:** Rust (reqwest + serde_json + sha2), React 19, TypeScript, i18next

---

## 文件结构

```
src-tauri/src/
  cloud_sync.rs        # 新增 CloudSyncManifest + 文件级 push/pull
  commands.rs          # 修改 sync_to_cloud / sync_from_cloud / check_sync_conflict
  lib.rs               # (不改)
  models.rs            # (不改)
  store.rs             # (不改)

src/types/index.ts     # CloudSyncManifest TypeScript 类型
src/lib/api.ts         # (可能需要更新)
src/pages/Output.tsx   # (冲突展示改为 manifest diff)
src/locales/en/output.json  # (可能需要更新)
src/locales/zh/output.json  # (可能需要更新)
```

---

## Task 1: Rust — CloudSyncManifest 模型和 SHA 计算

**Files:**
- Modify: `src-tauri/src/cloud_sync.rs`

- [ ] **Step 1: 添加 CloudSyncManifest 结构体和方法**

在 `cloud_sync.rs` 顶部添加：

```rust
use sha2::{Sha256, Digest};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSyncManifest {
    pub version: u32,
    pub files: HashMap<String, ManifestFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFileEntry {
    pub sha: String,
}

impl CloudSyncManifest {
    pub fn new() -> Self {
        Self {
            version: 1,
            files: HashMap::new(),
        }
    }

    /// Compute SHA-256 hex of a JSON string
    pub fn compute_sha(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

impl Default for CloudSyncManifest {
    fn default() -> Self {
        Self::new()
    }
}
```

- [ ] **Step 2: 添加依赖 sha2 到 Cargo.toml**

检查 `src-tauri/Cargo.toml` 的 `[dependencies]` 是否已有 `sha2`。如果没有，添加：
```toml
sha2 = "0.10"
```

- [ ] **Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功（可能有 dead_code warning）

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/cloud_sync.rs src-tauri/Cargo.toml
git commit -m "feat(cloud-sync): add CloudSyncManifest struct and SHA computation"
```

---

## Task 2: Rust — 重写 sync_to_cloud 使用目录结构

**Files:**
- Modify: `src-tauri/src/cloud_sync.rs`
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: 在 CloudSyncClient 中添加构建本地 manifest 的方法**

在 `cloud_sync.rs` 的 `CloudSyncClient` impl 块末尾添加：

```rust
/// Build local manifest from current AppData sections
pub fn build_local_manifest(
    &self,
    subscriptions_json: &str,
    rules_remote_json: &str,
    rules_individual_json: &str,
    nodes_json: &str,
    output_config_json: &str,
) -> CloudSyncManifest {
    let mut manifest = CloudSyncManifest::new();
    manifest.files.insert(
        "subscriptions/data.json".to_string(),
        ManifestFileEntry {
            sha: CloudSyncManifest::compute_sha(subscriptions_json),
        },
    );
    manifest.files.insert(
        "rules/remote.json".to_string(),
        ManifestFileEntry {
            sha: CloudSyncManifest::compute_sha(rules_remote_json),
        },
    );
    manifest.files.insert(
        "rules/individual.json".to_string(),
        ManifestFileEntry {
            sha: CloudSyncManifest::compute_sha(rules_individual_json),
        },
    );
    manifest.files.insert(
        "nodes/data.json".to_string(),
        ManifestFileEntry {
            sha: CloudSyncManifest::compute_sha(nodes_json),
        },
    );
    manifest.files.insert(
        "output/config.json".to_string(),
        ManifestFileEntry {
            sha: CloudSyncManifest::compute_sha(output_config_json),
        },
    );
    manifest
}

/// Find which files differ between local and cloud manifests
pub fn diff_manifests(
    &self,
    local: &CloudSyncManifest,
    cloud: Option<&CloudSyncManifest>,
) -> Vec<&str> {
    let mut changed = Vec::new();
    let cloud = cloud.unwrap_or_local;

    for (path, local_entry) in &local.files {
        if let Some(cloud_entry) = cloud.files.get(path) {
            if local_entry.sha != cloud_entry.sha {
                changed.push(path.as_str());
            }
        } else {
            changed.push(path.as_str());
        }
    }

    // Also check for files in cloud but not in local
    for path in cloud.files.keys() {
        if !local.files.contains_key(path) {
            changed.push(path.as_str());
        }
    }

    changed
}
```

- [ ] **Step 2: 重写 sync_to_cloud 命令**

替换 `commands.rs` 中的 `sync_to_cloud` 函数体，改为基于 manifest 的目录推送：

```rust
#[tauri::command]
pub async fn sync_to_cloud(
    store: State<'_, Store>,
) -> Result<CloudSyncState, String> {
    let settings = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.clone()
    };

    if !settings.enabled || settings.github_pat.is_none() || settings.repo_url.is_none() {
        return Err("Cloud sync not configured".to_string());
    }

    let client = crate::cloud_sync::CloudSyncClient::new(&settings).map_err(|e| e.to_string())?;

    // Serialize each section
    let (subscriptions_json, rules_remote_json, rules_individual_json, nodes_json, output_config_json) = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        let subscriptions_json = serde_json::to_string(&data.subscriptions).map_err(|e| e.to_string())?;
        let rules_remote_json = serde_json::to_string(&data.remote_rule_sets).map_err(|e| e.to_string())?;
        let rules_individual_json = serde_json::to_string(&data.individual_rules).map_err(|e| e.to_string())?;
        let nodes_json = serde_json::to_string(&data.extra_nodes).map_err(|e| e.to_string())?;
        let output_config_json = serde_json::to_string(&data.output_config).map_err(|e| e.to_string())?;
        (subscriptions_json, rules_remote_json, rules_individual_json, nodes_json, output_config_json)
    };

    // Build local manifest
    let local_manifest = client.build_local_manifest(
        &subscriptions_json,
        &rules_remote_json,
        &rules_individual_json,
        &nodes_json,
        &output_config_json,
    );

    // Get cloud manifest (if exists)
    let cloud_manifest: Option<CloudSyncManifest> = match client.get_file_content("manifest.json").await {
        Ok(content) => serde_json::from_str(&content).ok(),
        Err(_) => None,
    };

    // Find changed files
    let changed_paths = client.diff_manifests(&local_manifest, cloud_manifest.as_ref());

    // Push each changed file
    let file_contents: HashMap<&str, &str> = [
        ("subscriptions/data.json", subscriptions_json.as_str()),
        ("rules/remote.json", rules_remote_json.as_str()),
        ("rules/individual.json", rules_individual_json.as_str()),
        ("nodes/data.json", nodes_json.as_str()),
        ("output/config.json", output_config_json.as_str()),
    ].into_iter().collect();

    let local_manifest_json = serde_json::to_string(&local_manifest).map_err(|e| e.to_string())?;

    for path in changed_paths {
        let content = file_contents.get(path).unwrap_or(&"");
        let cloud_manifest_ref = cloud_manifest.as_ref();
        let sha = cloud_manifest_ref
            .and_then(|m| m.files.get(path))
            .map(|e| e.sha.clone());
        client.put_file(path, content, sha).await?;
    }

    // Push manifest
    let manifest_sha = cloud_manifest.as_ref().and_then(|m| m.files.get("manifest.json")).map(|e| e.sha.clone());
    client.put_file("manifest.json", &local_manifest_json, manifest_sha).await?;

    // Update last_synced_at
    let now = chrono::Utc::now();
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.last_synced_at = Some(now);
    }
    store.save()?;

    Ok(CloudSyncState {
        is_configured: true,
        last_synced_at: Some(now),
        status: "idle".to_string(),
    })
}
```

注意：需要添加 `use std::collections::HashMap;` 在文件顶部。

- [ ] **Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/cloud_sync.rs src-tauri/src/commands.rs
git commit -m "feat(cloud-sync): rewrite sync_to_cloud to use directory structure with manifest"
```

---

## Task 3: Rust — 重写 sync_from_cloud 使用目录结构

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: 重写 sync_from_cloud 命令**

替换 `commands.rs` 中的 `sync_from_cloud` 函数体：

```rust
#[tauri::command]
pub async fn sync_from_cloud(
    store: State<'_, Store>,
) -> Result<(), String> {
    let settings = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.clone()
    };

    if !settings.enabled || settings.github_pat.is_none() || settings.repo_url.is_none() {
        return Err("Cloud sync not configured".to_string());
    }

    let client = crate::cloud_sync::CloudSyncClient::new(&settings).map_err(|e| e.to_string())?;

    // Get cloud manifest
    let cloud_manifest_json = client.get_file_content("manifest.json").await?;
    let cloud_manifest: CloudSyncManifest = serde_json::from_str(&cloud_manifest_json)
        .map_err(|e| format!("Invalid cloud manifest: {}", e))?;

    // Fetch and parse each file
    let subscriptions: Vec<Subscription> = if cloud_manifest.files.contains_key("subscriptions/data.json") {
        let content = client.get_file_content("subscriptions/data.json").await?;
        serde_json::from_str(&content).map_err(|e| format!("Invalid subscriptions: {}", e))?
    } else {
        Vec::new()
    };

    let remote_rule_sets: Vec<RemoteRuleSet> = if cloud_manifest.files.contains_key("rules/remote.json") {
        let content = client.get_file_content("rules/remote.json").await?;
        serde_json::from_str(&content).map_err(|e| format!("Invalid remote rules: {}", e))?
    } else {
        Vec::new()
    };

    let individual_rules: Vec<IndividualRule> = if cloud_manifest.files.contains_key("rules/individual.json") {
        let content = client.get_file_content("rules/individual.json").await?;
        serde_json::from_str(&content).map_err(|e| format!("Invalid individual rules: {}", e))?
    } else {
        Vec::new()
    };

    let extra_nodes: Vec<ExtraNode> = if cloud_manifest.files.contains_key("nodes/data.json") {
        let content = client.get_file_content("nodes/data.json").await?;
        serde_json::from_str(&content).map_err(|e| format!("Invalid nodes: {}", e))?
    } else {
        Vec::new()
    };

    let output_config: OutputConfig = if cloud_manifest.files.contains_key("output/config.json") {
        let content = client.get_file_content("output/config.json").await?;
        serde_json::from_str(&content).map_err(|e| format!("Invalid output config: {}", e))?
    } else {
        OutputConfig::default()
    };

    // Update local store
    {
        let mut data = store.data.lock().map_err(|e| e.to_string())?;
        data.subscriptions = subscriptions;
        data.remote_rule_sets = remote_rule_sets;
        data.individual_rules = individual_rules;
        data.extra_nodes = extra_nodes;
        data.output_config = output_config;
    }
    store.save()?;

    Ok(())
}
```

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat(cloud-sync): rewrite sync_from_cloud to use directory structure"
```

---

## Task 4: Rust — 重写 check_sync_conflict 使用 manifest

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: 重写 check_sync_conflict 命令**

替换现有的 `check_sync_conflict` 函数体。冲突信息改为返回两者的 manifest JSON 对比：

```rust
#[tauri::command]
pub async fn check_sync_conflict(
    store: State<'_, Store>,
) -> Result<Option<SyncConflictInfo>, String> {
    let settings = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.clone()
    };

    if !settings.enabled || settings.github_pat.is_none() || settings.repo_url.is_none() {
        return Ok(None);
    }

    let client = crate::cloud_sync::CloudSyncClient::new(&settings).map_err(|e| e.to_string())?;

    // Build local manifest
    let (subscriptions_json, rules_remote_json, rules_individual_json, nodes_json, output_config_json) = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        let subscriptions_json = serde_json::to_string(&data.subscriptions).map_err(|e| e.to_string())?;
        let rules_remote_json = serde_json::to_string(&data.remote_rule_sets).map_err(|e| e.to_string())?;
        let rules_individual_json = serde_json::to_string(&data.individual_rules).map_err(|e| e.to_string())?;
        let nodes_json = serde_json::to_string(&data.extra_nodes).map_err(|e| e.to_string())?;
        let output_config_json = serde_json::to_string(&data.output_config).map_err(|e| e.to_string())?;
        (subscriptions_json, rules_remote_json, rules_individual_json, nodes_json, output_config_json)
    };

    let local_manifest = client.build_local_manifest(
        &subscriptions_json,
        &rules_remote_json,
        &rules_individual_json,
        &nodes_json,
        &output_config_json,
    );

    // Get cloud manifest
    let cloud_manifest_json = match client.get_file_content("manifest.json").await {
        Ok(content) => content,
        Err(_) => return Ok(None), // No cloud data = no conflict
    };

    let cloud_manifest: CloudSyncManifest = match serde_json::from_str(&cloud_manifest_json) {
        Ok(m) => m,
        Err(_) => return Ok(None),
    };

    let local_manifest_json = serde_json::to_string(&local_manifest).map_err(|e| e.to_string())?;

    // Compute local manifest SHA
    let local_sha = CloudSyncManifest::compute_sha(&local_manifest_json);
    let cloud_sha = CloudSyncManifest::compute_sha(&cloud_manifest_json);

    if local_sha != cloud_sha {
        Ok(Some(SyncConflictInfo {
            local_sha: Some(local_sha),
            cloud_sha,
            local_content: local_manifest_json,
            cloud_content: cloud_manifest_json,
        }))
    } else {
        Ok(None)
    }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat(cloud-sync): rewrite check_sync_conflict to compare manifests"
```

---

## Task 5: TypeScript — 更新类型

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 添加 CloudSyncManifest 类型**

在 `index.ts` 末尾添加：

```typescript
export interface CloudSyncManifestFileEntry {
  sha: string;
}

export interface CloudSyncManifest {
  version: number;
  files: Record<string, CloudSyncManifestFileEntry>;
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(cloud-sync): add CloudSyncManifest TypeScript type"
```

---

## Task 6: 前端 — 验证和测试

**Files:**
- (no file changes — verification only)

- [ ] **Step 1: 验证 Rust 编译和测试**

Run: `cd src-tauri && cargo test`
Expected: 所有测试通过

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交全部变更**

```bash
git add -A && git commit -m "feat: implement directory-based cloud sync structure"
```

---

## Self-Review Checklist

1. **Spec coverage**:
   - manifest.json 推送/拉取 ✅ (Task 2, 3)
   - 目录结构（5 个 section 文件）✅ (Task 2)
   - 冲突检测（manifest SHA 对比）✅ (Task 4)
   - 不包含 build_history ✅
   - 不包含旧 scm_data.json 兼容 ✅

2. **Placeholder scan**: 无 TBD/TODO，未完成的步骤

3. **Type consistency**: `CloudSyncManifest` 在 Rust (`cloud_sync.rs`) 和 TypeScript (`types/index.ts`) 都有定义，字段一致
