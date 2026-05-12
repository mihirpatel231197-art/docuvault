# DocuVault Desktop App — UI Kit

A click-thru recreation of the DocuVault Tauri/Next.js desktop app. Dark-mode default, Linear/Raycast-quality density.

## Files

- `index.html` — interactive prototype with all 7 pages + sidebar navigation + ⌘K palette
- `app.jsx` — top-level App + router/state
- `components/`
  - `Sidebar.jsx` — fixed nav with collapse + dynamic categories
  - `TitleBar.jsx` — Tauri title bar with mac traffic lights
  - `Primitives.jsx` — Button, Badge, Card, Input, Kbd, IconButton
  - `FileTypeIcon.jsx` — colored chip per mime type
  - `CategoryBadge.jsx` — hash-coloured badge from a category name
  - `ConfidenceBadge.jsx` — `%` with green/yellow/red
  - `Toast.jsx` — sonner-styled toast container + hook
  - `CommandPalette.jsx` — ⌘K overlay
- `pages/`
  - `Dashboard.jsx`
  - `Chat.jsx`
  - `Documents.jsx`
  - `Search.jsx`
  - `Duplicates.jsx`
  - `Settings.jsx`
  - `Upload.jsx`
- `data.js` — fake API responses matching the real `/api/*` shapes

## Conventions

- All token references go through `colors_and_type.css` at the project root.
- Categories are **never hardcoded**. The `CategoryBadge` component and the sidebar both derive color from `categoryColor(name)` (a stable string-hash → 12-hue lookup).
- Lucide icons are loaded from CDN.
- Components are intentionally cosmetic — they don't fetch real data, but they accept the same shapes the real API returns.
