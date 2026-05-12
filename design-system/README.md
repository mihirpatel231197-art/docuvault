# DocuVault Design System

DocuVault is an **AI-powered desktop document management app**. Users point it at folders on their local disk; it OCRs, extracts text, and classifies every file with Claude. Files stay in place — only metadata lives in SQLite. Users search, chat with their docs, and get proactive alerts (expiring contracts, duplicates, things to review).

This is a **Tauri desktop app** (native window) using **Next.js + shadcn/ui + Tailwind**. Dark mode is the default. The product is desktop-first, minimum 1200×800, and aims for the premium-but-utilitarian feel of **Linear, Raycast, and Arc**.

---

## Sources used to build this system

| Source | Provided | Notes |
|---|---|---|
| Product brief | ✅ Pasted into chat | Full API surface + 7 page specs + design guidelines |
| Codebase | ❌ Not attached | Design language inferred from "shadcn + Tailwind, Linear/Raycast quality" cue |
| Figma | ❌ Not attached | — |
| Logos / brand assets | ❌ Not attached | Wordmark + glyph designed in-system to match the desktop-utility aesthetic |
| Slide deck | ❌ Not attached | No sample slides created |

> ⚠️ **No upstream visual reference was provided.** The system below is an *opinionated interpretation* of "shadcn + Tailwind, Linear / Raycast / Arc quality, dark-first desktop app." If DocuVault has existing brand assets, screenshots, or a Figma file, attach them and we'll reconcile.

---

## Index

```
README.md                  ← you are here
colors_and_type.css        ← all design tokens (CSS custom properties)
SKILL.md                   ← agent skill file (drop into .claude/skills/)

assets/
  logo-docuvault.svg       ← wordmark
  glyph-docuvault.svg      ← square app icon / favicon
  iconography.md           ← icon system docs (Lucide via CDN)

preview/                   ← design-system cards (registered in the manifest)
  type-*.html
  color-*.html
  spacing-*.html
  components-*.html
  brand-*.html

ui_kits/
  desktop_app/             ← the DocuVault app itself
    README.md
    index.html             ← interactive click-thru of all 7 pages
    components/            ← Sidebar, StatCard, DocRow, ChatBubble, etc.
```

---

## Brand at a glance

- **Voice**: trusted system librarian. Calm, exact, never marketing-y.
- **Default mode**: dark.
- **Accent**: a single restrained cobalt (`--accent-500`). Used for primary actions, focus rings, and the active nav item — and almost nothing else.
- **Type**: Geist Sans for UI, Geist Mono for file paths, hashes, IDs, JSON.
- **Density**: tight (Linear-tight). Body text is 13/14 px; cards have 16–20 px padding.
- **Categories** are AI-determined and dynamic. The system never hardcodes "Finance" / "Legal" / etc. Each category gets a stable color by hashing its name into a 12-hue palette (`--cat-1` … `--cat-12`).

---

## CONTENT FUNDAMENTALS

DocuVault talks like the OS, not like a SaaS. The voice is **second-person, instructional, and quietly confident** — closer to Finder or 1Password than to Slack or Notion.

### Voice

| Do | Don't |
|---|---|
| "Scan a folder to get started." | "Let's get you set up! 🎉" |
| "3 contracts expire in the next 30 days." | "Heads up — looks like some contracts might be expiring soon!" |
| "No duplicates found." | "You're all caught up!" |
| "Reading your documents…" *(typing indicator)* | "Thinking really hard…" |
| "1,847 documents · 12.3 GB" | "Wow — that's a lot of files!" |

### Casing

- **Sentence case everywhere.** Buttons: "Scan folder", "Open file", "Reveal in Finder". Never Title Case.
- **All-caps only** for very small meta labels (column headers, kbd hints) and uses `letter-spacing: 0.08em`.
- **Numbers are formatted**: `1,847` not `1847`. File sizes use binary units when the user is technical (`12.3 GiB` is fine; `12.3 GB` is also fine — pick one and be consistent).

### Pronouns

- "**Your** documents", "**Your** watched folders" — possessive emphasizes locality (the files are on the user's disk, not in our cloud).
- "**You**" for the user, never "we".
- The app refers to itself by name only when necessary — "DocuVault scans your folder" only on first-run / empty states. Otherwise it disappears.

### Empty states

Empty states explain what the page *will* show, then offer the single best next action.

- Search empty: **"Start typing to search across your documents."**
- Documents empty: **"Nothing indexed yet."** + `[Scan a folder]` button.
- Duplicates empty: **"No duplicates found."** with a checkmark glyph.
- Chat empty: 4 starter-question cards + 3 proactive insight cards above them.

### Errors

Errors state the fact, then the recourse. No apology theater.

- "Couldn't open `~/Documents/lease.pdf` — file no longer exists." `[Reveal in Finder]` `[Remove from index]`
- "Scan failed on 3 files. Open log."

### Emoji

**No.** Not in UI, not in copy, not in empty states. Iconography is Lucide (linework). The only exception is in the *user's own* document content (their chat messages can contain whatever).

### Microcopy patterns

- **Counts always before nouns**: "42 documents", not "documents (42)".
- **Time is relative for recent, absolute for old**: "2 minutes ago", "yesterday", "Mar 12, 2024".
- **Confidence is shown as a percent with color**, not a label: `94%` in green, `61%` in yellow, `38%` in red. Never "high / medium / low" — the number is more honest.
- **File paths are always monospace** and middle-truncated when long: `~/Docs/2024/.../lease-final-v3.pdf`.

---

## VISUAL FOUNDATIONS

### Surfaces (dark mode)

DocuVault uses a 4-tier surface stack. Each tier rises in lightness; tier 0 (the canvas) is never the brightest thing on screen.

| Tier | Token | Example |
|---|---|---|
| 0 — canvas | `--bg-canvas` | App background, page padding |
| 1 — sidebar/panels | `--bg-sidebar` | Sidebar, chat input bar |
| 2 — cards | `--bg-card` | Stat cards, document rows |
| 3 — hover | `--bg-hover` | Hovered row / button |
| 4 — pressed | `--bg-pressed` | Active state, focused input |

Surfaces gain depth through **inset top-highlights** (`--shadow-inset-top`), not heavy drop-shadows. This is the "Linear glow" — a 1px white-04 line at the top edge of cards.

### Color usage rules

- **One accent**, used sparingly. Cobalt `--accent-500` for: primary buttons, the active sidebar item's bar/glow, focus rings, and the user's chat bubbles. That's it.
- **Categories use the hash palette**, not the accent. The accent is for *interaction*; categories are for *taxonomy*.
- **Semantic colors** (`--success`, `--warning`, `--danger`, `--info`) appear *only* with their `-bg` companion as a tinted chip — never as full-saturation backgrounds for large surfaces.

### Typography

- **Geist Sans** (UI), **Geist Mono** (paths, hashes, IDs).
- Scale ranges 10 → 40 px. Most of the UI lives between 12 and 14 px.
- Headings use tight tracking (`-0.02em` on h1, `-0.01em` on h2/h3). Body is at default tracking.
- **OpenType features**: `ss01` (single-storey a) and `cv11` are on by default — gives Geist its slightly geometric, less-corporate look. Mono uses `zero` (slashed zero) and `ss02`.

### Spacing

- 4 px base. Padding inside cards is 16 px; between sections, 24–32 px.
- Sidebar nav items are 32 px tall with 12 px horizontal padding.
- Document rows in list view are 56 px tall.

### Borders & dividers

- **Hairline 1px at `--ink-5`** for cards, inputs, buttons.
- **Faint 1px at `--ink-3`** for internal dividers (separating sections within a card).
- No double-bordering. If a hairline-bordered card sits on a hairline-bordered panel, the inner card loses its border.

### Radii

- 7 px (`--radius-md`) is the default for buttons, badges, inputs.
- 10 px (`--radius-lg`) for cards.
- 14 px (`--radius-xl`) for modals and large overlays (the Cmd+K palette).
- 999 px only for status dots, not for pills (we don't use big pill shapes — too playful for a desktop app).

### Shadows

Dark mode shadows are **almost imperceptible** at rest — depth comes from layered backgrounds and the inset top-highlight. Real shadow only appears on:
- The Cmd+K command palette (`--shadow-overlay`, lifts off the canvas)
- Dropdown menus (`--shadow-lg`)
- The toast container (`--shadow-md`)

Light mode uses softer, warmer shadows — visible but never harsh.

### Backgrounds & imagery

- **No gradients on large surfaces.** The accent gradient is reserved for one place: the upload page's drop-zone hover state (a 4% accent radial wash).
- **No photos in chrome.** Imagery only appears in user document thumbnails (and even then they're letterboxed in a card surface).
- **No textures, no grain, no patterns.** The interface is solid surfaces and hairlines.

### Animation

- **`160ms` is the default duration** for hover / active / page transitions.
- `90ms` for tap-back (button press).
- `280ms` for entrances (toasts, the Cmd+K palette opening).
- Easing is `cubic-bezier(0.22, 1, 0.36, 1)` — a sharp, productive ease-out. **No bounces** on UI elements (bounces would feel toy-like in a desktop app). The only spring-easing is the toast slide-in.
- Skeleton loaders use a subtle 1.5 s `--ink-2` ↔ `--ink-3` shimmer — no rainbow gradient sweep.

### Hover & press

- **Hover**: surface goes up one tier (`--bg-card` → `--bg-hover`). Buttons additionally brighten their fg by ~5%.
- **Press**: surface goes up another tier *and* scales to 0.98 over 90 ms with `--ease-in-out`. Subtle, not bouncy.
- **Active selection** (sidebar nav, a chosen filter chip): `--bg-pressed` background + a 2 px-wide accent bar on the left edge (sidebar) or a 1 px accent ring (chips).
- **Focus**: 2 px accent ring with a 2 px canvas-color spacer (`--focus-ring`). Never blue browser default.

### Transparency & blur

Used sparingly:
- **The Cmd+K overlay**: `backdrop-filter: blur(8px)` over a `oklch(0.10 0.004 264 / 0.7)` scrim.
- **Sticky table headers**: `backdrop-filter: blur(12px)` with a 70%-opaque `--bg-card` so content scrolls beneath.
- Nowhere else. Cards, sidebars, modals are all solid.

### Layout rules

- **Sidebar is fixed-width 260 px** (or 56 px collapsed), always visible (no overlay sidebar — this is desktop, not mobile).
- **Main content has 24 px outer padding** at all viewport sizes ≥1200 px; scales down to 16 px at 800 px.
- **Page titles sit at top-left** of the content area, with secondary actions top-right. No big hero banners.
- **Tables fill width**; cards in a row use CSS grid with `gap: 16px`.

### Iconography in motion

Icons never animate on hover by default. The exceptions:
- The send-message arrow rotates 90° → up when message is ready to send.
- The collapse-sidebar chevron rotates 180°.
- Loading spinners are the Lucide `Loader2` rotating linearly at 0.8 s.

---

## ICONOGRAPHY

DocuVault uses **[Lucide](https://lucide.dev)** as its icon system, loaded from CDN (`lucide@latest`). Lucide is the canonical shadcn icon library and matches the linework aesthetic.

- **Stroke**: 1.5 px (Lucide default).
- **Size**: 14 px in dense UI (sidebar, table cells), 16 px in buttons, 18–20 px in stat cards, 24 px+ in empty-state illustrations.
- **Color**: icons inherit `currentColor`; never colored unless they carry semantic intent (file-type icons use `--ft-*`, success/warning/danger icons use their semantic token).
- **Logo glyph**: a custom mark (`assets/glyph-docuvault.svg`) — a stack of three offset cards with a small chevron representing AI sorting. The wordmark (`assets/logo-docuvault.svg`) sits next to the glyph in the sidebar header.
- **No emoji.** No unicode symbol icons (✓, ✗, ★) — Lucide has all of them as proper SVGs.
- **No raster icons.** Everything is SVG.

See `assets/iconography.md` for usage details and the canonical icon set per page.

---

## Components inventory

The UI kit (`ui_kits/desktop_app/`) provides these reusable React components:

- **Sidebar** — fixed nav with collapse, dynamic categories, footer
- **TitleBar** — Tauri window controls (mac-style traffic lights for the prototype)
- **StatCard** — hero number + delta + sparkline slot
- **DocRow** — list-view document row with file-type icon, title, badges, actions
- **DocCard** — grid-view document card with thumbnail placeholder
- **CategoryBadge** — auto-colored from the hash palette
- **ConfidenceBadge** — color-coded percentage
- **FileTypeIcon** — looks up by mime type
- **ChatBubble** — user / assistant bubble, with source-badge slot for assistant
- **SourceBadge** — clickable doc-source chip on assistant messages
- **InsightCard** — alert card with severity icon
- **CommandPalette** — Cmd+K overlay
- **EmptyState** — illustration + headline + action
- **Toast** — sonner-styled
- **Sheet** — for the document detail panel
- **Pagination** — table footer

Each is in `ui_kits/desktop_app/components/` and rendered into the click-thru in `index.html`.

---

## How to use this system

1. **Read `colors_and_type.css`** — every token your design needs is there. Don't invent new colors; pick from the existing scales.
2. **Use Lucide icons via CDN.** Don't draw your own SVG icons. If a glyph you need isn't in Lucide, ask before substituting.
3. **Categories are dynamic.** Always use the `categoryColor(name)` hash function (see `ui_kits/desktop_app/components/CategoryBadge.jsx`) — never hardcode a category-to-color map.
4. **Stay dark-first.** Light mode exists, but design in dark first.
5. **When in doubt, look at Linear.** Tight density, monochrome with a single accent, hairline borders, strong type hierarchy.
