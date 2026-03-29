# 配置文件版本回退 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add version rollback functionality for generated .conf files — users can view history, preview, and restore any previous version.

**Architecture:** Backup files already exist in `{app_data}/backups/` (format `scm_{timestamp}.conf`). This feature adds three new Tauri commands to list/preview/rollback backups, plus a new "History Versions" modal in the Output page.

**Tech Stack:** React 19 + Tauri 2 + Rust backend + i18next

---

## File Structure

**Backend (Rust):**
- `src-tauri/src/commands.rs` — Add 3 new commands: `get_backups`, `get_backup_content`, `rollback_to_backup`
- `src-tauri/src/models.rs` — Add `BackupInfo` struct
- `src-tauri/src/lib.rs` — Register new commands

**Frontend (React/TypeScript):**
- `src/types/index.ts` — Add `BackupInfo` interface
- `src/lib/api.ts` — Add 3 new API wrappers
- `src/pages/Output.tsx` — Add "历史版本" button + modal with list/preview/rollback
- `src/locales/en/output.json` — Add i18n keys
- `src/locales/zh/output.json` — Add i18n keys

---

## Task 1: Rust Backend — BackupInfo Model

**Files:**
- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: Add BackupInfo struct to models.rs**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub created: DateTime<Utc>,
}
```

---

## Task 2: Rust Backend — Three New Commands

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `get_backups` command to commands.rs**

```rust
#[tauri::command]
pub fn get_backups(store: State<'_, Store>) -> Result<Vec<BackupInfo>, String> {
    let backup_dir = store.app_data_dir().join("backups");
    let entries = fs::read_dir(&backup_dir)
        .map_err(|e| format!("Cannot read backup dir: {}", e))?;

    let mut backups: Vec<BackupInfo> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("conf"))
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok()?;
            let filename = path.file_name()?.to_str()?.to_string();
            let created = metadata.created().ok()?;
            let created: DateTime<Utc> = created.into();
            Some(BackupInfo {
                filename,
                size_bytes: metadata.len(),
                created,
            })
        })
        .collect();

    backups.sort_by_key(|b| std::cmp::Reverse(b.created));
    Ok(backups)
}
```

- [ ] **Step 2: Add `get_backup_content` command to commands.rs**

```rust
#[tauri::command]
pub fn get_backup_content(filename: String, store: State<'_, Store>) -> Result<String, String> {
    let backup_path = store.app_data_dir().join("backups").join(&filename);
    fs::read_to_string(&backup_path)
        .map_err(|e| format!("Cannot read backup file '{}': {}", filename, e))
}
```

- [ ] **Step 3: Add `rollback_to_backup` command to commands.rs**

```rust
#[tauri::command]
pub fn rollback_to_backup(filename: String, store: State<'_, Store>) -> Result<(), String> {
    let data = store.data.lock().map_err(|e| e.to_string())?;
    let backup_path = store.app_data_dir().join("backups").join(&filename);
    let content = fs::read_to_string(&backup_path)
        .map_err(|e| format!("Cannot read backup file '{}': {}", filename, e))?;

    let output_dir = shellexpand_tilde(&data.output_config.output_path);
    fs::create_dir_all(&output_dir).map_err(|e| format!("Cannot create output dir: {}", e))?;

    let output_filename = if data.output_config.output_filename.is_empty() {
        "surge.conf".to_string()
    } else {
        data.output_config.output_filename.clone()
    };

    let full_path = PathBuf::from(&output_dir).join(&output_filename);
    fs::write(&full_path, &content).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}
```

- [ ] **Step 4: Register commands in lib.rs**

```rust
commands::get_backups,
commands::get_backup_content,
commands::rollback_to_backup,
```

- [ ] **Step 5: Run cargo check**

Run: `cd src-tauri && cargo check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/src/models.rs
git commit -m "feat: add backup list, preview, and rollback commands"
```

---

## Task 3: Frontend Type and API

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add BackupInfo type to types/index.ts**

```typescript
export interface BackupInfo {
  filename: string;
  size_bytes: number;
  created: string;
}
```

- [ ] **Step 2: Add API wrappers to lib/api.ts**

```typescript
export interface BackupInfo {
  filename: string;
  size_bytes: number;
  created: string;
}

export const getBackups = () =>
  invoke<BackupInfo[]>("get_backups");

export const getBackupContent = (filename: string) =>
  invoke<string>("get_backup_content", { filename });

export const rollbackToBackup = (filename: string) =>
  invoke<void>("rollback_to_backup", { filename });
```

Wait — there's a conflict. The `BackupInfo` type already exists in TypeScript from the Rust side. Let me check if we can just import it... Actually, let me restructure this.

**Revised Step 1:** The `BackupInfo` interface should be added to `src/types/index.ts` alongside the other Rust-derived types.

**Revised Step 2:** Add the three API functions to `src/lib/api.ts`.

- [ ] **Step 3: Run tsc --noEmit**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/api.ts
git commit -m "feat: add BackupInfo type and backup API wrappers"
```

---

## Task 4: Frontend — Output Page with History Versions Modal

**Files:**
- Modify: `src/pages/Output.tsx`
- Modify: `src/locales/en/output.json`
- Modify: `src/locales/zh/output.json`

- [ ] **Step 1: Add i18n keys to en/output.json**

```json
{
  "historyVersionsBtn": "History Versions",
  "historyVersionsTitle": "Backup History",
  "noBackups": "No backup files found.",
  "backupPreview": "Preview",
  "rollback": "Rollback",
  "rollbackConfirm": "Restore this version to the Surge profile directory?",
  "rollbackSuccess": "Rollback successful",
  "rollbackFailed": "Rollback failed",
  "backupCreated": "Created",
  "backupSize": "Size"
}
```

- [ ] **Step 2: Add i18n keys to zh/output.json**

```json
{
  "historyVersionsBtn": "历史版本",
  "historyVersionsTitle": "备份历史",
  "noBackups": "暂无备份文件。",
  "backupPreview": "预览",
  "rollback": "回退",
  "rollbackConfirm": "确定要恢复此版本到 Surge 配置目录吗？",
  "rollbackSuccess": "回退成功",
  "rollbackFailed": "回退失败",
  "backupCreated": "创建时间",
  "backupSize": "大小"
}
```

- [ ] **Step 3: Add History Versions modal to Output.tsx**

The modal shows a list of backups with:
- File name and creation time
- File size (formatted: KB/MB)
- "Preview" button → opens preview dialog
- "Rollback" button → confirmation → restore

Add state:
```typescript
const [historyOpen, setHistoryOpen] = useState(false);
const [backups, setBackups] = useState<BackupInfo[]>([]);
const [backupPreviewOpen, setBackupPreviewOpen] = useState(false);
const [backupPreviewContent, setBackupPreviewContent] = useState("");
const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
```

Add to UI (below Build History section):
```tsx
<Button
  variant="outline"
  onClick={async () => {
    const list = await api.getBackups();
    setBackups(list);
    setHistoryOpen(true);
  }}
  className="w-full"
>
  <History size={16} />
  {t("page.historyVersionsBtn")}
</Button>
```

Add the HistoryVersions Dialog (after the Preview Dialog):
- List of backup items with filename, time, size
- Preview button → `api.getBackupContent(filename)` → show in dialog
- Rollback button → confirmation dialog → `api.rollbackToBackup(filename)`

- [ ] **Step 4: Run pnpm test**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/Output.tsx src/locales/en/output.json src/locales/zh/output.json
git commit -m "feat: add history versions modal with preview and rollback"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run cargo test**

Run: `cd src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 2: Run tsc --noEmit**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run pnpm test**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 4: Run cargo clippy**

Run: `cd src-tauri && cargo clippy -- -D warnings`
Expected: No warnings

---

## Acceptance Criteria Coverage

| AC | Implementation |
|----|----------------|
| AC-01: Output page shows history versions button | Task 4: Button + modal in Output.tsx |
| AC-02: Preview backup content | Task 4: Preview dialog with `getBackupContent` |
| AC-03: One-click rollback | Task 4: Rollback button + confirmation + `rollbackToBackup` |
| AC-04: Auto-backup on generate | Already implemented in `generate_config` (commands.rs:840-866) |
| AC-05: `pnpm test` passes | Task 5: Final verification |
