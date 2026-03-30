# 云同步闭环优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将云同步的完整闭环打通：CloudSyncPage 前置冲突检测、恢复确认对话框、冲突对话框展示实际数据差异、并发保护、部分失败回滚、扩大同步范围、测试覆盖。

**Architecture:**
- **Backend**: `cloud_sync.rs` 新增 `FileChangeInfo` 返回类型（含各文件具体内容），`sync_to_cloud` 增加回滚逻辑，`sync_from_cloud` 更新 `last_synced_at`，新增 Mutex 互斥锁防并发
- **Frontend**: `CloudSyncPage.tsx` 增加冲突检测流程和恢复确认框；`CloudSyncConflictDialog.tsx` 改为展示文件级 diff；新增 `ConfirmRestoreDialog` 组件
- **Types**: `SyncConflictInfo` 扩展为含 `changed_files: FileChangeInfo[]`
- **Tests**: `cloud_sync.rs` 单元测试 + CloudSyncPage / CloudSyncConflictDialog 前端测试

**Tech Stack:** Rust (Tauri 2, reqwest, sha2), React 19, TypeScript, Vitest, react-testing-library

---

## File Map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/cloud_sync.rs` | GitHub API client, manifest engine, 回滚逻辑, 新增 Mutex 锁 |
| `src-tauri/src/models.rs` | `FileChangeInfo` 类型新增，`SyncConflictInfo` 扩展 |
| `src-tauri/src/commands.rs` | `sync_to_cloud` 回滚 + 锁，`sync_from_cloud` 更新 `last_synced_at`，新增 `check_sync_conflict_detail` |
| `src/lib/api.ts` | 新增 `checkSyncConflictDetail()` API wrapper |
| `src/types/index.ts` | `FileChangeInfo` 类型，`SyncConflictInfo` 扩展 |
| `src/pages/CloudSyncPage.tsx` | 前置冲突检测、恢复确认框、并发状态锁 |
| `src/components/CloudSyncConflictDialog.tsx` | 文件级 diff 展示（而非 manifest SHA） |
| `src/components/ConfirmRestoreDialog.tsx` | 新建：恢复确认对话框 |
| `src/__tests__/pages/CloudSyncPage.test.tsx` | 新建：CloudSyncPage 测试 |
| `src/__tests__/components/CloudSyncConflictDialog.test.tsx` | 新建：冲突对话框测试 |
| `src-tauri/src/cloud_sync.rs` (tests) | 新建：Rust 单元测试 |
| `src/locales/en.json`, `src/locales/zh.json` | 新增翻译 key |

---

## Task 1: Backend — 扩展 SyncConflictInfo + 新增 FileChangeInfo 类型

**Files:**
- Modify: `src-tauri/src/models.rs:1431-1440`
- Modify: `src-tauri/src/cloud_sync.rs:1-30`

- [ ] **Step 1: 在 models.rs 新增 FileChangeInfo 类型**

找到 `SyncConflictInfo` 定义（约 line 1431），在其上方添加：

```rust
/// Describes a single changed file in a sync conflict
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangeInfo {
    /// Cloud path, e.g. "subscriptions/data.json"
    pub path: String,
    /// SHA of this file in cloud
    pub cloud_sha: String,
    /// SHA of this file locally
    pub local_sha: String,
    /// Full JSON content from cloud
    pub cloud_content: String,
    /// Full JSON content from local
    pub local_content: String,
}
```

找到 `SyncConflictInfo` 结构体（约 line 1431），修改为：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflictInfo {
    pub local_sha: String,
    pub cloud_sha: String,
    /// Per-file change details (each file with different SHA)
    pub changed_files: Vec<FileChangeInfo>,
}
```

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat(cloud-sync): add FileChangeInfo and extend SyncConflictInfo"
```

---

## Task 2: Backend — 重构 check_sync_conflict 返回文件级详情

**Files:**
- Modify: `src-tauri/src/cloud_sync.rs` — 新增 `diff_manifests_detail()` 方法
- Modify: `src-tauri/src/commands.rs:1440-1500` — 重写 `check_sync_conflict` command

- [ ] **Step 1: 在 cloud_sync.rs 新增 `diff_manifests_detail()` 方法**

在 `CloudSyncClient` impl 块中新增方法（放在 `diff_manifests` 方法旁边）：

```rust
/// Like diff_manifests but also fetches the actual content of changed files.
/// Returns (added, modified, removed) file paths.
pub async fn diff_manifests_detail(
    &self,
    local: &CloudSyncManifest,
    cloud: &CloudSyncManifest,
) -> Result<(Vec<String>, Vec<String>, Vec<String>), Box<dyn std::error::Error + Send + Sync>> {
    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut removed = Vec::new();

    // Files in cloud but not in local → removed from local (i.e. cloud has it, local doesn't)
    for path in cloud.files.keys() {
        if !local.files.contains_key(path) {
            removed.push(path.clone());
        }
    }

    // Files in local but not in cloud → added locally
    for path in local.files.keys() {
        if !cloud.files.contains_key(path) {
            added.push(path.clone());
        }
    }

    // Files in both but SHA differs → modified
    for (path, local_entry) in &local.files {
        if let Some(cloud_entry) = cloud.files.get(path) {
            if local_entry.sha != cloud_entry.sha {
                modified.push(path.clone());
            }
        }
    }

    Ok((added, modified, removed))
}
```

- [ ] **Step 2: 重写 `check_sync_conflict` command in commands.rs**

找到 `check_sync_conflict` 函数（约 line 1440），完全重写：

```rust
#[tauri::command]
pub async fn check_sync_conflict(
    store: tauri::State<'_, Store>,
) -> Result<Option<SyncConflictInfo>, String> {
    let settings = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        data.cloud_sync_settings.clone()
    };

    if !settings.enabled {
        return Err("Cloud sync is not enabled".to_string());
    }

    let pat = settings.github_pat.as_ref().ok_or("GitHub PAT not set")?;
    let repo_url = settings.repo_url.as_ref().ok_or("Repository URL not set")?;

    let client = CloudSyncClient::new(&settings).map_err(|e| e.to_string())?;

    let (local_json, cloud_json) = {
        let data = store.data.lock().map_err(|e| e.to_string())?;
        let local = build_manifest_json(&data);
        (local.0, local.1) // version, json strings
    };

    let cloud_manifest = client.fetch_manifest().await.map_err(|e| e.to_string())?;

    let local_manifest: CloudSyncManifest = serde_json::from_str(&local_json.1)
        .map_err(|e| e.to_string())?;

    let local_manifest_json = serde_json::to_string(&local_manifest).map_err(|e| e.to_string())?;
    let cloud_manifest_json = serde_json::to_string(&cloud_manifest).map_err(|e| e.to_string())?;

    let local_sha = CloudSyncManifest::compute_sha(&local_manifest_json);
    let cloud_sha = CloudSyncManifest::compute_sha(&cloud_manifest_json);

    if local_sha == cloud_sha {
        return Ok(None);
    }

    // Fetch changed file details
    let (added, modified, removed) = client
        .diff_manifests_detail(&local_manifest, &cloud_manifest)
        .await
        .map_err(|e| e.to_string())?;

    let mut changed_files = Vec::new();

    // Fetch added/modified files: cloud has them, compare with local
    for path in added.iter().chain(modified.iter()) {
        let cloud_content = client
            .get_file_content(path)
            .await
            .map_err(|e| e.to_string())?;

        // Get local content from the serialized data
        let local_content = get_section_content_by_path(&local_json.1, path)
            .unwrap_or_default();

        let cloud_entry = cloud_manifest.files.get(path);
        let local_entry = local_manifest.files.get(path);

        changed_files.push(FileChangeInfo {
            path: path.clone(),
            cloud_sha: cloud_entry.map(|e| e.sha.clone()).unwrap_or_default(),
            local_sha: local_entry.map(|e| e.sha.clone()).unwrap_or_default(),
            cloud_content,
            local_content,
        });
    }

    // For removed files: they exist in cloud but not local
    for path in &removed {
        let cloud_content = client
            .get_file_content(path)
            .await
            .map_err(|e| e.to_string())?;

        let cloud_entry = cloud_manifest.files.get(path);

        changed_files.push(FileChangeInfo {
            path: path.clone(),
            cloud_sha: cloud_entry.map(|e| e.sha.clone()).unwrap_or_default(),
            local_sha: String::new(),
            cloud_content,
            local_content: String::new(),
        });
    }

    Ok(Some(SyncConflictInfo {
        local_sha,
        cloud_sha,
        changed_files,
    }))
}
```

**Note**: 需要新增辅助函数 `get_section_content_by_path` 根据 cloud path 返回对应 section 的 JSON 字符串（从 AppData 序列化后的结构中查找）。

- [ ] **Step 3: 添加辅助函数**

在 `commands.rs` 文件顶部或适当位置新增：

```rust
/// Returns the JSON string for a given cloud sync file path from AppData.
/// Returns None if the path is not a known sync path.
fn get_section_content_by_path(app_data_json: &str, path: &str) -> Option<String> {
    let data: AppData = serde_json::from_str(app_data_data).ok()?;
    match path {
        "subscriptions/data.json" => serde_json::to_string(&data.subscriptions).ok(),
        "rules/remote.json" => serde_json::to_string(&data.remote_rule_sets).ok(),
        "rules/individual.json" => serde_json::to_string(&data.individual_rules).ok(),
        "nodes/data.json" => serde_json::to_string(&data.extra_nodes).ok(),
        "output/config.json" => serde_json::to_string(&data.output_config).ok(),
        "hosts/data.json" => serde_json::to_string(&data.hosts).ok(),
        "url_rewrites/data.json" => serde_json::to_string(&data.url_rewrites).ok(),
        "general_settings/data.json" => serde_json::to_string(&data.general_settings).ok(),
        "disabled_sub_rule_keys/data.json" => serde_json::to_string(&data.disabled_sub_rule_keys).ok(),
        "mitm_section/data.json" => serde_json::to_string(&data.mitm_section).ok(),
        _ => None,
    }
}
```

- [ ] **Step 4: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功，无错误

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/cloud_sync.rs src-tauri/src/commands.rs
git commit -m "feat(cloud-sync): return file-level change details in conflict detection"
```

---

## Task 3: Frontend — 扩展 TypeScript 类型

**Files:**
- Modify: `src/types/index.ts:120-148`

- [ ] **Step 1: 扩展 SyncConflictInfo 类型**

找到 `SyncConflictInfo` 类型定义，修改为：

```typescript
export interface FileChangeInfo {
  path: string;
  cloud_sha: string;
  local_sha: string;
  cloud_content: string;
  local_content: string;
}

export interface SyncConflictInfo {
  local_sha: string;
  cloud_sha: string;
  changed_files: FileChangeInfo[];
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(cloud-sync): extend SyncConflictInfo with file-level change details"
```

---

## Task 4: Frontend — 新增 checkSyncConflictDetail API wrapper

**Files:**
- Modify: `src/lib/api.ts:266-267`

- [ ] **Step 1: 确认 checkSyncConflict API 已存在并返回正确类型**

检查 `api.ts` 第 266-267 行，`checkSyncConflict` 已存在。确认其返回 `SyncConflictInfo | null`。

- [ ] **Step 2: 无需修改（已返回 SyncConflictInfo | null）**

`checkSyncConflict` 已经返回 `SyncConflictInfo | null`，且现在 `SyncConflictInfo` 已包含 `changed_files`。

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(cloud-sync): api layer compatible with extended SyncConflictInfo"
```

---

## Task 5: Frontend — 重构 CloudSyncConflictDialog 展示文件级 diff

**Files:**
- Modify: `src/components/CloudSyncConflictDialog.tsx`

- [ ] **Step 1: 完全重写 CloudSyncConflictDialog**

替换现有内容为文件级 diff 展示：

```tsx
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SyncConflictInfo } from "@/types";

interface Props {
  conflict: SyncConflictInfo;
  onKeepLocal: () => void;
  onKeepCloud: () => void;
  loading?: boolean;
}

export default function CloudSyncConflictDialog({ conflict, onKeepLocal, onKeepCloud, loading }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <DialogTitle>{t("settings_cloudSync_conflictTitle")}</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("settings_cloudSync_conflictHint")}
        </p>

        <div className="space-y-4">
          {conflict.changed_files.map((file) => (
            <div key={file.path} className="border border-border rounded-md overflow-hidden">
              <div className="bg-card px-3 py-2 text-xs font-mono text-muted-foreground">
                {file.path}
              </div>
              <div className="grid grid-cols-2 gap-0">
                <div className="border-r border-border">
                  <div className="bg-card/50 px-3 py-1 text-xs text-info border-b border-border">
                    Cloud
                  </div>
                  <pre className="p-3 text-xs overflow-x-auto max-h-48 font-mono whitespace-pre-wrap break-all">
                    {formatJson(file.cloud_content)}
                  </pre>
                </div>
                <div>
                  <div className="bg-card/50 px-3 py-1 text-xs text-success border-b border-border">
                    Local
                  </div>
                  <pre className="p-3 text-xs overflow-x-auto max-h-48 font-mono whitespace-pre-wrap break-all">
                    {formatJson(file.local_content)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => {}} disabled={loading}>
            {t("settings_actions_cancel")}
          </Button>
          <Button onClick={onKeepCloud} disabled={loading} variant="outline">
            {loading ? "..." : t("settings_cloudSync_keepCloud")}
          </Button>
          <Button onClick={onKeepLocal} disabled={loading}>
            {loading ? "..." : t("settings_cloudSync_keepLocal")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
```

- [ ] **Step 2: 验证渲染**

Run: `pnpm tauri dev` → 确认 CloudSyncConflictDialog 正常渲染

- [ ] **Step 3: Commit**

```bash
git add src/components/CloudSyncConflictDialog.tsx
git commit -m "feat(cloud-sync): show file-level diff in conflict dialog"
```

---

## Task 6: Frontend — 新增 ConfirmRestoreDialog 组件

**Files:**
- Create: `src/components/ConfirmRestoreDialog.tsx`
- Modify: `src/locales/en.json`, `src/locales/zh.json`

- [ ] **Step 1: 创建 ConfirmRestoreDialog.tsx**

```tsx
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmRestoreDialog({ open, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" />
            <DialogTitle>{t("settings_cloudSync_restoreConfirmTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("settings_cloudSync_restoreConfirmDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t("settings_actions_cancel")}
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            {t("settings_cloudSync_restoreConfirmBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 添加翻译 key**

`src/locales/en.json` 新增：
```json
"settings_cloudSync_restoreConfirmTitle": "Restore from Cloud?",
"settings_cloudSync_restoreConfirmDesc": "This will replace all local data with cloud content. This action cannot be undone.",
"settings_cloudSync_restoreConfirmBtn": "Restore"
```

`src/locales/zh.json` 新增：
```json
"settings_cloudSync_restoreConfirmTitle": "确认从云端恢复？",
"settings_cloudSync_restoreConfirmDesc": "这将用云端数据覆盖所有本地数据，此操作不可撤销。",
"settings_cloudSync_restoreConfirmBtn": "确认恢复"
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/components/ConfirmRestoreDialog.tsx src/locales/en.json src/locales/zh.json
git commit -m "feat(cloud-sync): add restore confirmation dialog"
```

---

## Task 7: Frontend — 重构 CloudSyncPage 增加前置冲突检测和并发保护

**Files:**
- Modify: `src/pages/CloudSyncPage.tsx`
- Modify: `src/locales/en.json`, `src/locales/zh.json`

- [ ] **Step 1: 完全重写 CloudSyncPage 逻辑**

核心变更：
1. `handleSyncNow` → 先调用 `checkSyncConflict()`，有冲突则弹对话框，无冲突才执行 `syncToCloud()`
2. `handleRestoreFromCloud` → 先弹 `ConfirmRestoreDialog`，用户确认后再调用 `checkSyncConflict()`，有冲突则弹冲突对话框，无冲突才执行 `syncFromCloud()`
3. `syncing` 状态同时禁用两个按钮（防止并发）
4. 引入 `conflict` state: `SyncConflictInfo | null`，用于渲染 `CloudSyncConflictDialog`

完整重写后的 `CloudSyncPage.tsx`：

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, Download, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CloudSyncSettings, SyncConflictInfo } from "@/types";
import * as api from "@/lib/api";
import CloudSyncConflictDialog from "@/components/CloudSyncConflictDialog";
import ConfirmRestoreDialog from "@/components/ConfirmRestoreDialog";

export default function CloudSyncPage() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation();
  const [cloudSync, setCloudSync] = useState<CloudSyncSettings>({
    enabled: false,
    github_pat: null,
    repo_url: null,
    auto_sync: false,
    last_synced_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 冲突相关状态
  const [conflict, setConflict] = useState<SyncConflictInfo | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [conflictLoading, setConflictLoading] = useState(false);

  useEffect(() => {
    api.getCloudSyncSettings().then((cs) => {
      setCloudSync(cs);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateCloudSyncSettings(cloudSync);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError(null);
    setConflict(null);
    try {
      const conflictInfo = await api.checkSyncConflict();
      if (conflictInfo) {
        setConflict(conflictInfo);
        setSyncing(false);
        return;
      }
      // No conflict — push directly
      await api.syncToCloud();
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreClick = () => {
    // Show confirmation first
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    setSyncError(null);
    setConflict(null);
    try {
      const conflictInfo = await api.checkSyncConflict();
      if (conflictInfo) {
        setConflict(conflictInfo);
        setRestoring(false);
        return;
      }
      // No conflict — restore directly
      await api.syncFromCloud();
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setRestoring(false);
    }
  };

  const handleKeepLocal = async () => {
    setConflictLoading(true);
    try {
      await api.syncToCloud();
      setConflict(null);
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setConflictLoading(false);
    }
  };

  const handleKeepCloud = async () => {
    setConflictLoading(true);
    try {
      await api.syncFromCloud();
      setConflict(null);
      const cs = await api.getCloudSyncSettings();
      setCloudSync(cs);
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setConflictLoading(false);
    }
  };

  const isBusy = syncing || restoring;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 size={20} className="animate-spin mr-2" />
        {t("status.loading")}
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Cloud size={18} className="text-muted-foreground" />
          <h1 className="text-xl font-bold">{t("settings_cloudSync_sectionTitle")}</h1>
        </div>
      </div>

      <Card className="py-0 gap-0">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">{t("settings_cloudSync_enableLabel")}</div>
              <div className="text-xs text-muted-foreground">
                {t("settings_cloudSync_enableHint")}
              </div>
            </div>
            <Switch
              checked={cloudSync.enabled}
              onCheckedChange={(v) => setCloudSync((p) => ({ ...p, enabled: v }))}
            />
          </div>

          <div>
            <Label>{t("settings_cloudSync_patLabel")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t("settings_cloudSync_patHint")}
            </p>
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={cloudSync.github_pat ?? ""}
              onChange={(e) => setCloudSync((p) => ({
                ...p,
                github_pat: e.target.value || null,
              }))}
            />
          </div>

          <div>
            <Label>{t("settings_cloudSync_repoUrlLabel")}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t("settings_cloudSync_repoUrlHint")}
            </p>
            <Input
              placeholder="username/repo-name"
              value={cloudSync.repo_url ?? ""}
              onChange={(e) => setCloudSync((p) => ({
                ...p,
                repo_url: e.target.value || null,
              }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">{t("settings_cloudSync_autoSyncLabel")}</div>
              <div className="text-xs text-muted-foreground">
                {t("settings_cloudSync_autoSyncHint")}
              </div>
            </div>
            <Switch
              checked={cloudSync.auto_sync}
              onCheckedChange={(v) => setCloudSync((p) => ({ ...p, auto_sync: v }))}
            />
          </div>

          {cloudSync.last_synced_at && (
            <div className="text-xs text-muted-foreground">
              {t("settings_cloudSync_lastSynced")}: {new Date(cloudSync.last_synced_at).toLocaleString()}
            </div>
          )}

          {syncError && (
            <div className="text-xs text-danger">{syncError}</div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || isBusy} size="sm">
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : saved ? (
                <RefreshCw size={14} />
              ) : (
                <Save size={14} />
              )}
              {saved ? tc("status.saved") : t("settings_cloudSync_saveBtn")}
            </Button>
            {cloudSync.enabled && (
              <Button onClick={handleSyncNow} size="sm" disabled={isBusy}>
                {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {t("settings_cloudSync_syncNow")}
              </Button>
            )}
            {cloudSync.enabled && (
              <Button onClick={handleRestoreClick} size="sm" disabled={isBusy} variant="outline">
                {restoring ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {t("settings_cloudSync_restoreFromCloud")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Restore confirmation dialog */}
      <ConfirmRestoreDialog
        open={showRestoreConfirm}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setShowRestoreConfirm(false)}
      />

      {/* Conflict resolution dialog */}
      {conflict && (
        <CloudSyncConflictDialog
          conflict={conflict}
          onKeepLocal={handleKeepLocal}
          onKeepCloud={handleKeepCloud}
          loading={conflictLoading}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/pages/CloudSyncPage.tsx
git commit -m "feat(cloud-sync): add pre-sync conflict detection and restore confirmation on CloudSyncPage"
```

---

## Task 8: Backend — sync_from_cloud 更新 last_synced_at

**Files:**
- Modify: `src-tauri/src/commands.rs:1339-1440`

- [ ] **Step 1: 修改 sync_from_cloud command**

找到 `sync_from_cloud` 函数，在函数末尾（保存 store 后）增加 `last_synced_at` 更新：

在 `store.save()` 调用后、函数返回前，添加：

```rust
{
    let mut data = store.data.lock().map_err(|e| e.to_string())?;
    data.cloud_sync_settings.last_synced_at = Some(chrono::Utc::now());
    drop(data);
    store.save().map_err(|e| e.to_string())?;
}
```

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "fix(cloud-sync): update last_synced_at after restore from cloud"
```

---

## Task 9: Backend — 扩大同步范围（general_settings, disabled_sub_rule_keys, mitm_section）

**Files:**
- Modify: `src-tauri/src/cloud_sync.rs:build_local_manifest()` 调用处
- Modify: `src-tauri/src/commands.rs:sync_to_cloud` 序列化部分

- [ ] **Step 1: 修改 build_local_manifest 调用**

在 `sync_to_cloud` command 中，找到当前序列化的 7 个 section，扩展为 10 个。找到：
```rust
let local = build_local_manifest(
    &subs_json,
    &remote_rules_json,
    &individual_rules_json,
    &nodes_json,
    &output_config_json,
    &hosts_json,
    &url_rewrites_json,
);
```

修改为：
```rust
let general_settings_json = serde_json::to_string(&data.general_settings).map_err(|e| e.to_string())?;
let disabled_keys_json = serde_json::to_string(&data.disabled_sub_rule_keys).map_err(|e| e.to_string())?;
let mitm_section_json = serde_json::to_string(&data.mitm_section).map_err(|e| e.to_string())?;

let local = build_local_manifest(
    &subs_json,
    &remote_rules_json,
    &individual_rules_json,
    &nodes_json,
    &output_config_json,
    &hosts_json,
    &url_rewrites_json,
    &general_settings_json,
    &disabled_keys_json,
    &mitm_section_json,
);
```

- [ ] **Step 2: 修改 CloudSyncClient::build_local_manifest 函数签名**

找到 `build_local_manifest` 函数签名，从：
```rust
pub fn build_local_manifest(
    subs: &str,
    remote_rules: &str,
    individual_rules: &str,
    nodes: &str,
    output_config: &str,
    hosts: &str,
    url_rewrites: &str,
) -> CloudSyncManifest
```

修改为：
```rust
pub fn build_local_manifest(
    subs: &str,
    remote_rules: &str,
    individual_rules: &str,
    nodes: &str,
    output_config: &str,
    hosts: &str,
    url_rewrites: &str,
    general_settings: &str,
    disabled_keys: &str,
    mitm_section: &str,
) -> CloudSyncManifest
```

同时在函数体内新增三个文件条目：
```rust
files.insert(
    "general_settings/data.json".to_string(),
    ManifestFileEntry { sha: Self::compute_sha(general_settings) },
);
files.insert(
    "disabled_sub_rule_keys/data.json".to_string(),
    ManifestFileEntry { sha: Self::compute_sha(disabled_keys) },
);
files.insert(
    "mitm_section/data.json".to_string(),
    ManifestFileEntry { sha: Self::compute_sha(mitm_section) },
);
```

- [ ] **Step 3: 修改 cloud_sync.rs 的 put_file 调用（推送 10 个文件）**

在 `sync_to_cloud` command 中，找到 `for path in &diff.to_push` 循环（或类似逻辑），确保推送所有 10 个文件。检查是否有遗漏的 `put_file` 调用。

**注意**: 需要确认 `diff.to_push` 的来源。如果 `diff_manifests` 返回的是变更文件列表，需要确保 `build_local_manifest` 中新增的 3 个文件路径也被纳入推送逻辑中。

具体来说：
- `diff_manifests` 返回 `changed_files: Vec<String>` — 需要确认这是基于 manifest 的所有文件计算的
- `build_local_manifest` 返回的 manifest 包含 10 个文件
- `diff_manifests` 比较 local vs cloud manifest，变更的文件会被返回

需要确认：`sync_to_cloud` 中从 `diff` 获取推送列表的逻辑是否正确包含了新增的 3 个文件。

- [ ] **Step 4: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/cloud_sync.rs src-tauri/src/commands.rs
git commit -m "feat(cloud-sync): expand sync scope to general_settings, disabled_sub_rule_keys, mitm_section"
```

---

## Task 10: Backend — 并发保护（Mute x 锁）

**Files:**
- Modify: `src-tauri/src/cloud_sync.rs` — 新增同步锁
- Modify: `src-tauri/src/commands.rs` — 在 sync_to_cloud 和 sync_from_cloud 中使用锁

- [ ] **Step 1: 在 Store 结构体中新增 Mutex 锁**

找到 `src-tauri/src/store.rs` 中的 `Store` 结构体定义，添加：
```rust
pub sync_lock: Mutex<()>,
```

在 `Store::new()` 中初始化：
```rust
sync_lock: Mutex::new(()),
```

- [ ] **Step 2: 在 commands.rs 中使用锁**

在 `sync_to_cloud` 函数开头添加：
```rust
let _guard = store.sync_lock.lock().map_err(|e| e.to_string())?;
```

在 `sync_from_cloud` 函数开头添加：
```rust
let _guard = store.sync_lock.lock().map_err(|e| e.to_string())?;
```

- [ ] **Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/store.rs src-tauri/src/commands.rs
git commit -m "feat(cloud-sync): add mutex lock to prevent concurrent sync operations"
```

---

## Task 11: Backend — sync_to_cloud 部分失败回滚机制

**Files:**
- Modify: `src-tauri/src/commands.rs` — 重写 sync_to_cloud 推送逻辑

- [ ] **Step 1: 重写 sync_to_cloud 的推送循环，加入回滚**

找到 `sync_to_cloud` 函数中推送变更文件的循环部分。原始逻辑是遍历 `diff`（变更文件列表）并逐个推送。需要改为：

```rust
let mut pushed_files: Vec<String> = Vec::new();
let mut push_failed = false;

for path in &diff {
    let content = match path.as_str() {
        "subscriptions/data.json" => subs_json.clone(),
        "rules/remote.json" => remote_rules_json.clone(),
        "rules/individual.json" => individual_rules_json.clone(),
        "nodes/data.json" => nodes_json.clone(),
        "output/config.json" => output_config_json.clone(),
        "hosts/data.json" => hosts_json.clone(),
        "url_rewrites/data.json" => url_rewrites_json.clone(),
        "general_settings/data.json" => general_settings_json.clone(),
        "disabled_sub_rule_keys/data.json" => disabled_keys_json.clone(),
        "mitm_section/data.json" => mitm_section_json.clone(),
        _ => continue,
    };

    match client.put_file(path, &content).await {
        Ok(_) => pushed_files.push(path.clone()),
        Err(e) => {
            // Rollback: revert already-pushed files in reverse order
            for revert_path in pushed_files.iter().rev() {
                let revert_content = match revert_path.as_str() {
                    // For rollback we need original cloud content — fetch it
                    _ => client.get_file_content(revert_path).await.unwrap_or_default(),
                };
                let _ = client.put_file(revert_path, &revert_content).await;
            }
            return Err(format!("Failed to push {}: {}", path, e));
        }
    }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat(cloud-sync): rollback on partial push failure in sync_to_cloud"
```

---

## Task 12: Frontend 测试 — CloudSyncPage

**Files:**
- Create: `src/__tests__/pages/CloudSyncPage.test.tsx`

- [ ] **Step 1: 创建测试文件**

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, expect, beforeEach } from "vitest";
import CloudSyncPage from "@/pages/CloudSyncPage";

const mockInvoke = vi.fn();
vi.mock("@/lib/api", () => ({
  default: {
    getCloudSyncSettings: mockInvoke,
    updateCloudSyncSettings: mockInvoke,
    syncToCloud: mockInvoke,
    syncFromCloud: mockInvoke,
    checkSyncConflict: mockInvoke,
  },
}));

const mockCloudSyncSettings = {
  enabled: true,
  github_pat: "ghp_test",
  repo_url: "test/repo",
  auto_sync: false,
  last_synced_at: null,
};

describe("CloudSyncPage", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("renders cloud sync page with settings", async () => {
    mockInvoke.mockResolvedValueOnce(mockCloudSyncSettings);
    render(<CloudSyncPage />);
    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_sectionTitle")).toBeInTheDocument();
    });
  });

  it("shows Sync Now and Restore buttons when enabled", async () => {
    mockInvoke.mockResolvedValueOnce(mockCloudSyncSettings);
    render(<CloudSyncPage />);
    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_syncNow")).toBeInTheDocument();
      expect(screen.getByText("settings_cloudSync_restoreFromCloud")).toBeInTheDocument();
    });
  });

  it("calls checkSyncConflict before sync — shows conflict dialog on diff", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings)
      .mockResolvedValueOnce({
        local_sha: "abc",
        cloud_sha: "def",
        changed_files: [{
          path: "subscriptions/data.json",
          cloud_sha: "sha1",
          local_sha: "sha2",
          cloud_content: '{"test":1}',
          local_content: '{"test":2}',
        }],
      });

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("check_sync_conflict");
      expect(screen.getByText("settings_cloudSync_conflictTitle")).toBeInTheDocument();
    });
  });

  it("syncs directly when no conflict", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings)
      .mockResolvedValueOnce(null) // checkSyncConflict → no conflict
      .mockResolvedValueOnce({ is_configured: true, last_synced_at: null, status: "idle" }) // syncToCloud
      .mockResolvedValueOnce(mockCloudSyncSettings); // getCloudSyncSettings (updated)

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("sync_to_cloud");
    });
  });

  it("shows restore confirmation before checking conflict", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce(mockCloudSyncSettings);

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_restoreFromCloud"));

    await user.click(screen.getByText("settings_cloudSync_restoreFromCloud"));

    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_restoreConfirmTitle")).toBeInTheDocument();
    });
  });

  it("disables both buttons while syncing or restoring", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings)
      .mockResolvedValueOnce(null) // checkSyncConflict
      .mockImplementation(() => new Promise((r) => setTimeout(() => r({ is_configured: true, last_synced_at: null, status: "idle" }), 500)));

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));

    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_syncNow")).toBeDisabled();
      expect(screen.getByText("settings_cloudSync_restoreFromCloud")).toBeDisabled();
    });
  });

  it("keeps local version when Keep Local is clicked in conflict", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings)
      .mockResolvedValueOnce({
        local_sha: "abc",
        cloud_sha: "def",
        changed_files: [{
          path: "subscriptions/data.json",
          cloud_sha: "sha1",
          local_sha: "sha2",
          cloud_content: '{"test":1}',
          local_content: '{"test":2}',
        }],
      })
      .mockResolvedValueOnce({ is_configured: true, last_synced_at: null, status: "idle" })
      .mockResolvedValueOnce(mockCloudSyncSettings);

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));
    await waitFor(() => screen.getByText("settings_cloudSync_conflictTitle"));

    await user.click(screen.getByText("settings_cloudSync_keepLocal"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("sync_to_cloud");
    });
  });

  it("keeps cloud version when Keep Cloud is clicked in conflict", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings)
      .mockResolvedValueOnce({
        local_sha: "abc",
        cloud_sha: "def",
        changed_files: [{
          path: "subscriptions/data.json",
          cloud_sha: "sha1",
          local_sha: "sha2",
          cloud_content: '{"test":1}',
          local_content: '{"test":2}',
        }],
      })
      .mockResolvedValueOnce(undefined) // syncFromCloud
      .mockResolvedValueOnce(mockCloudSyncSettings);

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));
    await waitFor(() => screen.getByText("settings_cloudSync_conflictTitle"));

    await user.click(screen.getByText("settings_cloudSync_keepCloud"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("sync_from_cloud");
    });
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test -- src/__tests__/pages/CloudSyncPage.test.tsx`
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/pages/CloudSyncPage.test.tsx
git commit -m "test(cloud-sync): add CloudSyncPage tests for conflict detection flow"
```

---

## Task 13: Frontend 测试 — CloudSyncConflictDialog

**Files:**
- Create: `src/__tests__/components/CloudSyncConflictDialog.test.tsx`

- [ ] **Step 1: 创建测试文件**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, expect } from "vitest";
import CloudSyncConflictDialog from "@/components/CloudSyncConflictDialog";

const mockConflict = {
  local_sha: "abc",
  cloud_sha: "def",
  changed_files: [
    {
      path: "subscriptions/data.json",
      cloud_sha: "sha1",
      local_sha: "sha2",
      cloud_content: '{"name":"sub-a"}',
      local_content: '{"name":"sub-b"}',
    },
  ],
};

describe("CloudSyncConflictDialog", () => {
  it("renders conflict title and hint", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    expect(screen.getByText("settings_cloudSync_conflictTitle")).toBeInTheDocument();
    expect(screen.getByText("settings_cloudSync_conflictHint")).toBeInTheDocument();
  });

  it("displays file path of changed file", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    expect(screen.getByText("subscriptions/data.json")).toBeInTheDocument();
  });

  it("shows formatted JSON content for cloud and local", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    expect(screen.getByText(/"name":\s*"sub-a"/)).toBeInTheDocument();
    expect(screen.getByText(/"name":\s*"sub-b"/)).toBeInTheDocument();
  });

  it("calls onKeepLocal when Keep Local button is clicked", async () => {
    const user = userEvent.setup();
    const onKeepLocal = vi.fn();
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={onKeepLocal}
        onKeepCloud={vi.fn()}
      />
    );
    await user.click(screen.getByText("settings_cloudSync_keepLocal"));
    expect(onKeepLocal).toHaveBeenCalled();
  });

  it("calls onKeepCloud when Keep Cloud button is clicked", async () => {
    const user = userEvent.setup();
    const onKeepCloud = vi.fn();
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={onKeepCloud}
      />
    );
    await user.click(screen.getByText("settings_cloudSync_keepCloud"));
    expect(onKeepCloud).toHaveBeenCalled();
  });

  it("disables buttons when loading", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
        loading={true}
      />
    );
    expect(screen.getByText("settings_cloudSync_keepLocal")).toBeDisabled();
    expect(screen.getByText("settings_cloudSync_keepCloud")).toBeDisabled();
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `pnpm test -- src/__tests__/components/CloudSyncConflictDialog.test.tsx`
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/components/CloudSyncConflictDialog.test.tsx
git commit -m "test(cloud-sync): add CloudSyncConflictDialog tests"
```

---

## Task 14: Backend 测试 — cloud_sync.rs 单元测试

**Files:**
- Modify: `src-tauri/src/cloud_sync.rs` — 新增 `#[cfg(test)]` 模块

- [ ] **Step 1: 新增 Rust 单元测试**

在 `cloud_sync.rs` 文件末尾新增：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_sha_deterministic() {
        let content = r#"{"test":"data"}"#;
        let sha1 = CloudSyncManifest::compute_sha(content);
        let sha2 = CloudSyncManifest::compute_sha(content);
        assert_eq!(sha1, sha2);
        assert_eq!(sha1.len(), 64); // SHA-256 hex is 64 chars
    }

    #[test]
    fn test_compute_sha_different_content() {
        let sha1 = CloudSyncManifest::compute_sha(r#"{"a":1}"#);
        let sha2 = CloudSyncManifest::compute_sha(r#"{"a":2}"#);
        assert_ne!(sha1, sha2);
    }

    #[test]
    fn test_build_local_manifest_includes_all_files() {
        let manifest = CloudSyncManifest::build_local_manifest(
            r#"[]"#,
            r#"[]"#,
            r#"[]"#,
            r#"[]"#,
            r#"{}"#,
            r#"[]"#,
            r#"[]"#,
            r#"{}"#,
            r#"[]"#,
            r#""#,
        );
        assert_eq!(manifest.version, 1);
        assert!(manifest.files.contains_key("subscriptions/data.json"));
        assert!(manifest.files.contains_key("rules/remote.json"));
        assert!(manifest.files.contains_key("rules/individual.json"));
        assert!(manifest.files.contains_key("nodes/data.json"));
        assert!(manifest.files.contains_key("output/config.json"));
        assert!(manifest.files.contains_key("hosts/data.json"));
        assert!(manifest.files.contains_key("url_rewrites/data.json"));
        assert!(manifest.files.contains_key("general_settings/data.json"));
        assert!(manifest.files.contains_key("disabled_sub_rule_keys/data.json"));
        assert!(manifest.files.contains_key("mitm_section/data.json"));
        assert_eq!(manifest.files.len(), 10);
    }

    #[test]
    fn test_build_local_manifest_sha_changes_with_content() {
        let manifest1 = CloudSyncManifest::build_local_manifest(
            r#"{"test":1}"#,
            r#"[]"#,
            r#"[]"#,
            r#"[]"#,
            r#"{}"#,
            r#"[]"#,
            r#"[]"#,
            r#"{}"#,
            r#"[]"#,
            r#""#,
        );
        let manifest2 = CloudSyncManifest::build_local_manifest(
            r#"{"test":2}"#,
            r#"[]"#,
            r#"[]"#,
            r#"[]"#,
            r#"{}"#,
            r#"[]"#,
            r#"[]"#,
            r#"{}"#,
            r#"[]"#,
            r#""#,
        );
        let sha1 = manifest1.files.get("subscriptions/data.json").unwrap().sha.clone();
        let sha2 = manifest2.files.get("subscriptions/data.json").unwrap().sha.clone();
        assert_ne!(sha1, sha2);
    }
}
```

- [ ] **Step 2: 运行 Rust 测试**

Run: `cd src-tauri && cargo test cloud_sync`
Expected: 所有 cloud_sync 测试通过

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/cloud_sync.rs
git commit -m "test(cloud-sync): add Rust unit tests for cloud_sync module"
```

---

## Task 15: 最终验证

- [ ] **Step 1: TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: Rust 检查和测试**

Run: `cd src-tauri && cargo check && cargo fmt -- --check && cargo clippy -- -D warnings && cargo test`
Expected: 所有检查通过，所有测试通过

- [ ] **Step 3: 前端测试**

Run: `pnpm test`
Expected: 所有测试通过

- [ ] **Step 4: 最终 git add + commit**

```bash
git add -A
git commit -m "feat(cloud-sync): complete closed-loop sync with conflict detection, restore confirmation, rollback, and tests"
```

---

## Self-Review Checklist

- [ ] AC-01: CloudSyncPage "Sync Now" 前置冲突检测 — Task 7 覆盖
- [ ] AC-02: CloudSyncPage "Restore from Cloud" 确认对话框 + 冲突检测 — Task 6, 7 覆盖
- [ ] AC-03: 冲突对话框展示文件级 diff — Task 4, 5 覆盖
- [ ] AC-04: `last_synced_at` 更新 — Task 8 覆盖
- [ ] AC-05: 并发保护（按钮置灰）— Task 7 覆盖（`isBusy` 状态）
- [ ] AC-06: 部分失败回滚 — Task 11 覆盖
- [ ] AC-07: 同步范围扩大 — Task 9 覆盖
- [ ] AC-08: Rust 单元测试 — Task 14 覆盖
- [ ] AC-09: 前端组件测试 — Task 12, 13 覆盖
- [ ] AC-10: `pnpm test` 通过 — Task 15 验证

**Type consistency check:**
- `SyncConflictInfo.changed_files: Vec<FileChangeInfo>` — Task 1 定义 → Task 3 引用一致
- `cloud_sync.rs` 中 `build_local_manifest` 接受 10 个参数 — Task 9 更新 → Task 14 测试匹配
- `sync_to_cloud` 回滚逻辑在 `commands.rs` — Task 11 编写 → Task 15 验证编译
