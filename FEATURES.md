# Surge Configuration Manager — Feature Index

## Overview

Tauri 2.x desktop app (macOS only) for visually managing Surge proxy configuration files.
Stack: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + shadcn/ui + Rust backend.

---

## Pages & Routes

| Route | Page | File |
|-------|------|------|
| `/` | Subscriptions | `src/pages/Subscriptions.tsx` |
| `/rules` | Rules | `src/pages/Rules.tsx` |
| `/nodes` | Extra Nodes | `src/pages/ExtraNodes.tsx` |
| `/output` | Output | `src/pages/Output.tsx` |
| `/settings` | Settings | `src/pages/Settings.tsx` |

---

## Subscriptions (`/`)

### Core Features
- List all subscriptions in card layout
- Add subscription from **URL** or **local file** (file picker via `@tauri-apps/plugin-dialog`)
- Refresh subscription (re-fetches URL or re-reads file)
- Remove subscription with confirmation dialog
- **Primary subscription** — one subscription can be designated Primary (Crown badge + indigo ring)
  - Primary contributes: Proxy Groups + Rules to generated config
  - Secondary subscriptions contribute: proxy nodes only
  - Set primary via dropdown menu → "Set as Primary"

### Subscription Card Info
- Name, source type badge (Local / URL), node count badge
- External link button (URL sources only)
- Last refreshed timestamp (relative: "2h ago", "Just now")
- Refresh interval (URL) or "Local File" label
- Status badge: Active / Error / (secondary)
- Data usage bar (color: green <60%, yellow 60-80%, red >80%)
- Expiry date (if present in subscription)
- Error warning when last refresh failed (cached content preserved)

### Expiration Protection
Failed fetches or invalid content do NOT overwrite cached data — status is set to `Error`.

### Backend Commands
- `get_subscriptions` → `Subscription[]`
- `add_subscription(name, url, source_type)`
- `refresh_subscription(id)` → updated `Subscription`
- `remove_subscription(id)`
- `set_primary_subscription(id)`

---

## Rules (`/rules`)

### Core Features
- List **Remote Rule Sets** (RULE-SET URLs) and **Individual Rules**
- Add / remove remote rule set URLs
- Add / remove / toggle individual rules (enable/disable)
- Drag-to-reorder individual rules
- View rules sourced from the primary subscription (read-only, COPY badge)

### Subscription Rules (read-only section)
- Rule sets from primary subscription shown with "COPY" badge + subscription name
- Individual rules from primary subscription shown similarly
- Disabled toggle (cannot be edited — from subscription)
- Divider "From Subscriptions" separates user rules from subscription rules

### Backend Commands
- `get_remote_rule_sets` → `RemoteRuleSet[]`
- `add_remote_rule_set(url, name)`
- `remove_remote_rule_set(id)`
- `get_individual_rules` → `IndividualRule[]`
- `add_individual_rule(rule_type, value, policy, enabled)`
- `remove_individual_rule(id)`
- `reorder_individual_rules(ids)`

---

## Extra Nodes (`/nodes`)

### Core Features
- List manually added proxy nodes
- Add node via unified dialog (single button: **添加节点**)
- Batch or single node addition
- Select nodes (checkbox) for batch delete
- Select All / Deselect All
- Test individual node or Test All (latency + IP info + clean/proxy/hosting detection)
- Refresh node IP (only for nodes with `refresh_url`)
- Remove individual node with confirmation

### Add Node Dialog (unified, two main tabs)

**Tab 1 — 逐个添加 (Single)**
- Protocol selector (pill buttons): SOCKS5, SOCKS5-TLS, HTTP, HTTPS, Shadowsocks, VMess, Trojan, Hysteria2, TUIC
- Fields: node name, server, port (auto-fills default per protocol)
- Protocol-specific fields:
  - SOCKS5/SOCKS5-TLS/HTTP/HTTPS: username + password (optional)
  - Shadowsocks: encrypt method (dropdown) + password
  - VMess: UUID + WS Path (optional) + TLS toggle
  - Trojan / Hysteria2: password + skip-cert-verify toggle
  - TUIC: UUID + Token
- Refresh URL (optional, all protocols)
- Live raw-line preview (Surge config format)

**Tab 2 — 批量添加 (Batch)** with two sub-tabs:
- **SOCKS5 sub-tab**: paste `user:pass@host:port` lines (one per line)
  - Refresh URL template with `{user}` placeholder
  - Auto-converts pasted URL → template (replaces `user=xxx` with `user={user}`)
  - Live validation: count of valid / invalid lines
  - Error details per invalid line
- **原始行 sub-tab**: paste full Surge proxy lines (all protocols supported)
  - Example format shown in UI
  - Count of lines to be added

### Node Test Results
- Latency (ms)
- IP address
- Country flag + name
- ISP + city
- Clean / Proxy / Hosting detection
- Results persisted in `localStorage` across sessions

### Backend Commands
- `get_extra_nodes` → `ExtraNode[]`
- `add_extra_node(name, node_type, server, port, username?, password?, refresh_url?)`
- `add_node_from_raw_line(raw_line, refresh_url?)` — parses `name = type, server, port, ...`
- `batch_add_extra_nodes(nodes[])` — SOCKS5 batch import
- `remove_extra_node(id)`
- `batch_remove_extra_nodes(ids[])`
- `test_extra_node(id)` → `NodeTestResult` (latency, IP, geo, clean/proxy/hosting)
- `refresh_extra_node(id)` — hits node's refresh_url

---

## Output (`/output`)

### Core Features
- Preview generated `.conf` content
- Configure output file path (Surge profile directory)
- Generate config — writes final `.conf` to disk
- Build history (list of past generated configs with timestamps)
- Clear build history

### Config Generation Logic (backend: `generator.rs`)
- `[General]`: http-listen, socks5-listen + extra general lines
- `[Proxy]`: nodes from all subscriptions + extra nodes (deduplication by name)
- `[Proxy Group]`: from primary subscription only
- `[Rule]`: user individual rules → RULE-SET entries → subscription rules (primary only) → FINAL
- `[MITM]`: from settings
- `[Host]`: from settings
- `[URL Rewrite]`: from settings

### Backend Commands
- `get_output_config` → `OutputConfig`
- `update_output_config(config)`
- `generate_config` → writes file, returns `BuildRecord`
- `preview_config` → returns config string without writing
- `get_build_history` → `BuildRecord[]`
- `clear_build_history`

---

## Settings (`/settings`)

### General Section
- HTTP Listen address (e.g. `0.0.0.0:7890`)
- SOCKS5 Listen address (e.g. `0.0.0.0:7891`)
- Extra `[General]` lines (free-text, one `key = value` per line)
- Save button with "Saved!" feedback

### Advanced Sections (separate save)
- **[MITM]** — raw section content (hostname, skip-server-cert-verify, etc.)
- **[Host]** — DNS mapping rules (domain → IP)
- **[URL Rewrite]** — HTTP URL rewrite rules (regex replacement type)

### Backend Commands
- `get_general_settings` → `GeneralSettings`
- `update_general_settings(settings)`
- `get_advanced_sections` → `AdvancedSections`
- `update_advanced_sections(sections)`

---

## App Shell (`src/App.tsx`)

### Header
- App title: "Surge Configuration Manager"
- Theme toggle (dark/light) — persisted in `localStorage` as `scm_theme`
- "Generate Config" button (calls generate from anywhere)
- Update notification banner (when new version available via GitHub Releases)

### Auto-updater
- Checks GitHub Releases on startup (`check_for_update`)
- Banner shows new version + current version
- "Install & Restart" button — downloads, installs, restarts app
- Dismiss (X) button

### Backend Commands
- `check_for_update` → `UpdateInfo | null`
- `install_update` — downloads and installs, then exits

---

## Data Persistence

All data stored as JSON in `scm_data.json` in Tauri app data directory.

### Key Data Structures (Rust `models.rs`)
| Struct | Fields |
|--------|--------|
| `Subscription` | id, name, url, source_type (Url/File), raw_content, node_count, status, last_refreshed, interval_secs, usage_used_gb, usage_total_gb, expires, is_primary, rule_lines |
| `ExtraNode` | id, name, node_type, server, port, username, password, refresh_url, raw_line |
| `RemoteRuleSet` | id, url, name, enabled |
| `IndividualRule` | id, rule_type, value, policy, enabled |
| `OutputConfig` | output_path, profile_name |
| `BuildRecord` | id, timestamp, path, success |
| `GeneralSettings` | http_listen, socks5_listen, extra_lines |
| `AdvancedSections` | mitm, host, url_rewrite |

---

## CI/CD

### GitHub Actions (`.github/workflows/`)
- **ci.yml** — runs on every push: `tsc --noEmit` → `cargo fmt --check` → `cargo clippy -D warnings` → `cargo test`
- **release.yml** — triggered on version tags: builds signed macOS app, generates updater manifest, publishes GitHub Release

### Tests
- Rust unit tests (41 tests): `cd src-tauri && cargo test`
- Covers: subscription parsing, config generation, store CRUD

---

## Components

| Component | File | Purpose |
|-----------|------|---------|
| `Sidebar` | `src/components/Sidebar.tsx` | Navigation sidebar with route links |
| `ConfirmDialog` | `src/components/ConfirmDialog.tsx` | Reusable destructive-action confirm modal |
| shadcn/ui | `src/components/ui/` | Button, Card, Badge, Input, Dialog, DropdownMenu, etc. |

---

## Theming

Dark/light mode toggle (persisted). CSS variables in `src/index.css`:
- `--color-success`, `--color-danger`, `--color-warning`, `--color-info`
- Primary: `#5E6AD2` (indigo)
- Default: dark mode
