# Iconography

DocuVault uses **[Lucide](https://lucide.dev)** as its icon system. Lucide ships with shadcn/ui and matches the linework aesthetic used across the app.

## Loading

Lucide is loaded via CDN — no local sprite or icon font:

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

Or in React:

```bash
npm install lucide-react
```

## Style

| Property | Value |
|---|---|
| Stroke width | **1.5 px** (Lucide default) |
| Stroke linecap / linejoin | round / round |
| Color | `currentColor` — inherits from text |
| Fill | none (linework only) |

## Sizes

| Context | Size |
|---|---|
| Sidebar nav, table cells, inline metadata | **14 px** |
| Buttons, badges | **16 px** |
| Stat cards, page headers | **18–20 px** |
| Empty-state illustrations | **48–64 px** |

## Canonical set per page

| Page | Icons used |
|---|---|
| Sidebar | `LayoutDashboard`, `MessageSquare`, `FileText`, `Search`, `Copy`, `Settings`, `ChevronsLeft`, `Plus` |
| Dashboard | `Files`, `HardDrive`, `Tags`, `AlertCircle`, `Sparkles`, `TrendingUp`, `FolderPlus`, `MessageSquarePlus` |
| Chat | `Send`, `Paperclip`, `Trash2`, `RotateCcw`, `BookOpen` |
| Documents | `Filter`, `LayoutGrid`, `List`, `MoreHorizontal`, `ExternalLink`, `Folder`, `RefreshCw`, `Trash2` |
| Search | `Search`, `Command`, `X` |
| Duplicates | `Copy`, `Check`, `Trash2`, `CircleCheck` |
| Settings | `FolderPlus`, `Eye`, `Play`, `Key`, `Info` |
| Upload | `UploadCloud`, `FileText`, `Sparkles`, `CircleCheck` |

## File-type icons

File-type icons are colored, not monochrome, and use these Lucide glyphs:

| Type | Icon | Color token |
|---|---|---|
| PDF | `FileText` | `--ft-pdf` |
| Image | `FileImage` | `--ft-image` |
| Word | `FileText` (blue) | `--ft-word` |
| Excel | `FileSpreadsheet` | `--ft-excel` |
| Code | `FileCode2` | `--ft-code` |
| Audio | `FileAudio` | `--ft-audio` |
| Video | `FileVideo` | `--ft-video` |
| Other | `File` | `--ft-default` |

The file-type icon is always shown inside a 32×32 rounded-square chip (`--radius-md`) with a tinted background (the file-type color at 12% opacity).

## Logo

- `assets/logo-docuvault.svg` — wordmark + glyph horizontal lockup, used in the sidebar header.
- `assets/glyph-docuvault.svg` — square mark only, used as the app icon, favicon, and Tauri title-bar icon.

The glyph is **three offset document cards with a chevron**, evoking the act of AI-sorting a stack. Do not separate the chevron from the cards. The accent-colored top card is always cobalt (`--accent-500`); when used on a light surface, swap to `--accent-700` so it doesn't glow.

## Don'ts

- ❌ No emoji anywhere in the UI.
- ❌ No unicode symbol substitutes (✓ ✗ ★ etc.) — Lucide has them all as proper SVGs.
- ❌ No raster icons (PNG / JPG).
- ❌ Don't use a different icon library "just for one icon" — if Lucide doesn't have it, request it or use a thoughtful Lucide fallback.
- ❌ Don't recolor icons beyond the file-type and semantic palette. UI icons inherit `currentColor`.
