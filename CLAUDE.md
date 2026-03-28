# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Surge Configuration Manager (SCM) is a **macOS-only Tauri 2.x desktop app** for visually managing [Surge](https://nssurge.com/) proxy configuration files. Core workflow:

1. **Subscriptions** — Import proxy node lists from remote URLs or local `.conf` files (auto-refresh with expiration protection)
2. **Rules** — Manage remote RULE-SET URLs and individual routing rules with drag-to-reorder
3. **Extra Nodes** — Manually add SOCKS5/custom proxy nodes not part of any subscription
4. **Output** — Merge everything into a final `.conf` file written to Surge's profile directory

## Commands

```bash
# Development (launches both Vite dev server and Rust backend)
pnpm tauri dev

# TypeScript type check only
npx tsc --noEmit

# Rust check only
cd src-tauri && cargo check

# Production build
pnpm tauri build

# Add a shadcn component
npx shadcn@latest add <component-name>
```

## Testing & Linting

Run these locally before pushing — GitHub CI enforces all of them on every push.

```bash
# Rust unit tests (41 tests across subscription, generator, store modules)
cd src-tauri && cargo test

# Rust format check (must be clean — CI fails on violations)
cd src-tauri && cargo fmt -- --check

# Auto-fix formatting
cd src-tauri && cargo fmt

# Rust lint (CI treats all warnings as errors)
cd src-tauri && cargo clippy -- -D warnings
```

### CI Pipeline (`.github/workflows/ci.yml`)

Two jobs run on every push:

| Job | Runner | Steps |
|-----|--------|-------|
| **Lint & Unit Tests** | `macos-latest` | `tsc --noEmit` → `cargo fmt --check` → `cargo clippy -D warnings` → `cargo test` |
| **Build Check** | `macos-latest` (after lint passes) | `pnpm build` (Vite) → `cargo build --release` |

## Architecture

### Frontend (React 19 + Vite 7 + Tailwind CSS v4)

- **`src/App.tsx`** — Root layout: Sidebar + header + `<Routes>` (react-router-dom)
- **`src/pages/`** — Four page components, each self-contained with their own dialogs and state:
  - `Subscriptions.tsx`, `Rules.tsx`, `ExtraNodes.tsx`, `Output.tsx`
- **`src/lib/api.ts`** — All Tauri IPC wrappers. Every backend call goes through `invoke()` from `@tauri-apps/api/core`. This is the single source of truth for frontend-backend contract.
- **`src/components/ui/`** — shadcn/ui components (radix-nova preset). Generated, rarely hand-edited.
- **`src/components/Sidebar.tsx`** — Navigation sidebar with route links.

### Backend (Rust / Tauri 2)

- **`src-tauri/src/lib.rs`** — Entry point. Registers plugins (fs, dialog, opener), creates `Store`, registers all 20 command handlers.
- **`src-tauri/src/models.rs`** — All data types: `Subscription`, `SubSource`, `RemoteRuleSet`, `IndividualRule`, `ExtraNode`, `OutputConfig`, `BuildRecord`, `AppData`. `AppData` is the root state struct.
- **`src-tauri/src/store.rs`** — `Store { path, data: Mutex<AppData> }`. JSON persistence to `scm_data.json` in Tauri's app data dir. All commands lock the mutex, mutate, then call `store.save()`.
- **`src-tauri/src/commands.rs`** — 20 `#[tauri::command]` functions. CRUD for subscriptions, rules, nodes, plus config generation/preview. Subscription refresh has **expiration protection**: if fetch fails or content is invalid, old content is preserved and status set to `Error`.
- **`src-tauri/src/subscription.rs`** — HTTP fetch (reqwest with Surge User-Agent) and local file reading. Parses `[Proxy]` and `[Proxy Group]` sections. Extracts usage/expiry from Chinese/English info nodes (e.g. "当前流量：366.64G / 1000.00G").
- **`src-tauri/src/generator.rs`** — Assembles final `.conf` by inlining subscription proxy nodes (not `#!include`), then extra nodes, proxy groups, individual rules, RULE-SET entries, and optional Host/URL Rewrite/MITM sections.

### Data Flow

```
Frontend (React) → invoke("command_name", {params})
  → Tauri IPC → commands.rs → store.data.lock() → mutate AppData → store.save() → scm_data.json
```

Subscriptions support two source types (`SubSource::Url` | `SubSource::File`). On refresh, URL sources validate content via `is_valid_subscription_content()` before replacing — failed fetches preserve cached data.

## Theming

**Dark-only.** No light mode. All colors defined as CSS variables in `src/index.css` `:root` — there is no `.dark` class toggle. Custom tokens (`--color-success`, `--color-danger`, `--color-warning`, `--color-info`) coexist with shadcn's variable system. Primary color: `#5E6AD2` (indigo).

## Key Conventions

- Path alias: `@/` → `src/` (configured in both `tsconfig.json` and `vite.config.ts`)
- Rust lib name is `scm_lib` (not the package name), referenced in `src-tauri/src/main.rs`
- Tauri capabilities are in `src-tauri/capabilities/default.json` — includes `fs:default` and `dialog:default`
- Compact Card usage: always add `className="py-0 gap-0"` to shadcn `<Card>` in list items (default padding is too large)
- Frontend icons: `lucide-react` exclusively
