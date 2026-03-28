# Surge Configuration Manager — UI Design Prompt

> This document serves as the canonical UI design specification for SCM.
> Use this prompt with design generation tools (Pencil, v0.dev, Figma AI, etc.).

---

## Background

SCM manages two kinds of external files:

1. **Subscription files** (e.g. `ImmTelecom_Surge.conf`) — read-only, provided by proxy
   service providers, contain `[Proxy]` and `[Proxy Group]` sections with dozens of nodes
   grouped by region (HKG 01, USA 01, etc.)
2. **User template files** (e.g. `Immtel1.conf`) — wraps the subscription via `#!include`,
   and contains custom `[General]`, `[Rule]`, `[Host]`, `[MITM]` sections

**Core workflow**: Manage subscriptions + custom rules visually in SCM, then generate a
final merged `.conf` file written to a user-specified output path for Surge to read.

Platform: macOS only (Tauri desktop app).

---

## Design Prompt

Design a macOS desktop application called "Surge Configuration Manager" (SCM).
It is a Tauri-based app for managing Surge proxy configuration files on macOS.

---

### Core Concept

The app has two kinds of external files it manages:
1. Subscription files (e.g. ImmTelecom_Surge.conf) — read-only, provided by proxy
   service providers, contain [Proxy] and [Proxy Group] sections with dozens of nodes
   grouped by region (HKG 01, USA 01, etc.)
2. A user template file (e.g. Immtel1.conf) — uses `#!include SubscriptionFile.conf`
   to embed the subscription, and contains custom [General], [Rule], [Host], [MITM]
   sections

SCM lets users visually manage subscriptions + custom rules, then generates a final
merged .conf file that Surge reads from a specified output path.

---

### Visual Style

- macOS native aesthetic — clean, minimal, professional
- Dark mode only
- Background: #1A1A1F (near-black)
- Surface cards: #242429
- Sidebar: #1E1E23
- Accent color: #5E6AD2 (indigo-blue)
- Text primary: #EDEDF0
- Text secondary: #8B8B99
- Borders: 1px solid rgba(255,255,255,0.06)
- Border radius: 8px for cards, 6px for inputs
- Font: SF Pro (system font)
- Inspired by: Linear app, Raycast, Arc browser sidebar style

---

### App Layout

Three-column layout with a native macOS window chrome (traffic lights visible):

LEFT SIDEBAR (240px wide):
- App logo/name "SCM" at top
- Navigation items with icons:
  - Subscriptions (cloud download icon)
  - Rules (filter/list icon)
  - Extra Nodes (server icon) — for manual SOCKS5 nodes
  - Output (export/generate icon)
- At bottom: Settings gear icon

MAIN CONTENT AREA:
- Changes based on selected nav item
- Has a subtle top toolbar with breadcrumb + action buttons

---

### Screen 1: Subscriptions Page (default/landing screen)

This is where users add and manage subscription URLs that provide proxy nodes.

TOP TOOLBAR:
- Title "Subscriptions"
- "+ Add Subscription" button (accent color, filled)

SUBSCRIPTION LIST:
Each subscription is shown as a card with:
- Left: colored circle avatar with first letter of name
- Subscription name (bold, e.g. "ImmTelecom")
- Subscription URL (monospace, truncated, gray text below name)
- Status badges on the right side:
  - Node count chip: "104 nodes" (subtle gray badge)
  - Last refreshed: "2h ago" (gray text)
  - Auto-refresh interval: "12h" (small badge)
- Right side action area:
  - Refresh button (circular arrows icon, ghost button)
  - "..." more menu (edit / delete)
- Bottom of card: thin progress bar showing usage if detected
  (e.g. "366.64G / 1000.00G used · Expires 2026-12-27")
  shown in a very subtle muted style

EMPTY STATE (when no subscriptions):
- Centered illustration (simple line art of a cloud with arrow)
- "No subscriptions yet"
- "Add a subscription URL to import proxy nodes"
- "+ Add Subscription" button

ADD SUBSCRIPTION DRAWER (slides in from right, 420px wide):
Form fields:
- Name (text input, e.g. "ImmTelecom")
- Subscription URL (text input, full URL, monospace font)
- Auto-refresh interval (segmented control: Off / 1h / 6h / 12h / 24h)
- [Parse & Preview] button — fetches the URL and shows node count preview
- Preview area (appears after parse): shows "Found 104 nodes across 12 regions"
  with a small region breakdown list
- [Save Subscription] primary button
- [Cancel] ghost button

---

### Screen 2: Rules Page

This is where users manage the custom [Rule] section of their config.

The rules section in Surge config mixes two types:
A) RULE-SET entries — remote rule lists from URLs, assigned to a proxy group
   Example: `RULE-SET,https://github.com/.../OpenAI.list,AI,update-interval=86400`
B) Individual rules — specific overrides
   Example: `DOMAIN,api.anthropic.com,REJECT`
   Example: `PROCESS-NAME,/Applications/WeChat.app/Contents/MacOS/WeChat,DIRECT`
   Example: `GEOIP,CN,Direct`

TOP TOOLBAR:
- Title "Rules"
- Rule count badge "32 rules"
- "+ Add Rule" dropdown button with two options:
  - "Add Rule Set (URL)"
  - "Add Individual Rule"

RULE LIST:
Two visually distinct sections with section headers:

Section: "Remote Rule Sets" (collapsible)
Each row shows:
- Left: colored dot matching the policy/proxy-group color
- Rule set name (derived from URL, e.g. "OpenAI" extracted from URL path)
- URL shown below in tiny monospace gray text (truncated)
- Right: policy badge (e.g. "AI" in indigo, "Direct" in green, "Proxies" in blue)
- Refresh interval badge "24h"
- Drag handle on far left for reorder
- Hover reveals: edit pencil + delete trash icons

Section: "Individual Rules" (collapsible)
Each row shows:
- Rule type badge on left (color-coded):
  - DOMAIN: blue
  - DOMAIN-SUFFIX: light blue
  - IP-CIDR: orange
  - PROCESS-NAME: purple
  - GEOIP: teal
  - SRC-IP: yellow
  - IN-PORT: gray
  - FINAL: red
- Rule value (monospace, e.g. "api.anthropic.com")
- Arrow to policy badge (e.g. "REJECT" in red, "DIRECT" in green, "AI" in indigo)
- Optional comment (grayed, e.g. "// deny anthropic")
- Drag handle + hover edit/delete

ADD RULE SET PANEL (side drawer):
- Rule Set Name (auto-filled from URL parsing)
- URL input (full URL to .list file)
- Policy: dropdown showing all available proxy groups from subscriptions
  (AI, Netflix, Telegram, YouTube, Proxies, Direct, REJECT, etc.)
- Update interval (segmented: 1h / 6h / 24h / 72h)
- Position: top / bottom (where to insert in rule order)
- [Save] button

ADD INDIVIDUAL RULE PANEL:
- Rule Type: dropdown (DOMAIN / DOMAIN-SUFFIX / DOMAIN-KEYWORD / IP-CIDR /
  PROCESS-NAME / GEOIP / SRC-IP / IN-PORT / FINAL)
- Value: text input (hint changes based on type, e.g. "e.g. api.openai.com")
- Policy: dropdown (same proxy groups list)
- Comment (optional)
- [Save] button

---

### Screen 3: Output & Generate Page

This is the most important page — where the final config is generated.

LAYOUT: Two columns side by side

LEFT COLUMN — Configuration:

Section "Template":
- Currently selected template file path shown
  (e.g. "~/Documents/Immtel1.conf")
- [Choose Template File] button (opens macOS file picker)
- Template preview: collapsed by default, expandable code snippet
  showing first ~10 lines of template in monospace dark code block

Section "Output Path":
- Output directory picker showing current path
  (e.g. "~/Library/Mobile Documents/iCloud~com~nssurge~surge/Documents/")
- [Choose Directory] button
- Output filename input: "Immtel_Generated.conf" (editable)
- Hint text: "Surge reads from this path automatically"

Section "Auto-Generate Triggers":
- Toggle: "Regenerate when subscription refreshes" (on by default)
- Toggle: "Regenerate when rules change" (on by default)

RIGHT COLUMN — Preview & History:

"Generate Config" button — large, full-width, accent color (#5E6AD2)
with a play icon. Subtitle: "Last generated: 2 hours ago"

"Preview Output" — ghost button, opens preview modal

Recent Generations section:
List of last 5 generations with:
- Timestamp (e.g. "Today, 14:32")
- Status icon (green checkmark or red x)
- Small change summary (e.g. "+2 rules, nodes refreshed")
- [View Diff] link

---

### Screen 4: Generate Preview Modal

Full-screen overlay modal (80% of window width, tall):

HEADER:
- "Config Preview" title
- [Copy] button
- [Close] button

TAB BAR:
- "Full Output" tab
- "Diff from last" tab (shows green/red line diffs)

CONTENT:
Syntax-highlighted code view of the final .conf file content.
Color scheme for Surge config syntax:
- Section headers [General] etc: indigo/purple
- Keys: light blue
- Values: white
- Comments (#): gray
- URLs: dimmer white

FOOTER:
- Line count: "198 lines"
- [Generate & Write to Disk] primary button

---

### UI Component Reference

TOAST NOTIFICATIONS (bottom-right corner):
- Success: "Config generated -> ~/Library/.../Immtel_Generated.conf" (green)
- Error: "Subscription refresh failed: timeout" (red, with retry action)
- Info: "104 nodes updated from ImmTelecom" (blue)

PROXY GROUP POLICY BADGES (used throughout):
Color-coded based on group name:
- DIRECT: green (#22C55E)
- REJECT: red (#EF4444)
- Proxies: indigo (#6366F1)
- AI: violet (#8B5CF6)
- Netflix / YouTube / streaming: orange (#F97316)
- Telegram: sky blue (#0EA5E9)
- Others: gray (#6B7280)

WINDOW TITLEBAR:
- Native macOS traffic light buttons
- Centered app title "Surge Configuration Manager"
- Right side: "Generate Config" quick-action button in accent color

---

### Realistic Sample Data

Subscription:
- Name: "ImmTelecom"
- 104 nodes
- Regions: HKG (20), TWN (5), SGP (18), KOR (2), JPN (18), USA (16),
  IND (2), AUS (1), DEU (6), FRA (1), POL (1), NLD (3), ESP (1),
  RUS (2), ISL (1), DNK (1), CAN (2), GBR (4), TUR (2)
- Usage: 366.64G / 1000.00G · Expires 2026-12-27

Proxy Groups available in policy dropdowns:
Proxies, Netflix, HBO, DisneyPlus, YouTube, Bahamut, Bilibili,
MyTVSuper, AI, Telegram, Crypto, Steam, Epic, Xbox, PlayStation,
Microsoft, Scholar, Apple, Google, Tiktok, Direct, Final

Sample Rules:
- RULE-SET -> OpenAI.list -> AI
- RULE-SET -> Claude.list -> AI
- RULE-SET -> Telegram.list -> Telegram
- RULE-SET -> Netflix.list -> Netflix
- RULE-SET -> China.list -> Direct
- DOMAIN, api.anthropic.com -> REJECT // deny anthropic
- PROCESS-NAME, WeChat.app -> DIRECT
- DOMAIN, loginid-mt4.mtapi.io -> SGP 10
- GEOIP, CN -> Direct
- FINAL -> Final

---

Design all 4 screens at macOS window size (1280x800). Dark mode only.
