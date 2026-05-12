---
name: docuvault-design
description: Use this skill to generate well-branded interfaces and assets for DocuVault — an AI-powered desktop document management app — either for production or throwaway prototypes / mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files (`colors_and_type.css`, `assets/`, `preview/`, `ui_kits/desktop_app/`).

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy the assets and tokens out and create static HTML files for the user to view. The fastest path: load `colors_and_type.css`, drop in the components from `ui_kits/desktop_app/components/`, and reference Lucide icons via CDN.

If working on production code, read the rules here to become an expert in designing with this brand. Key rules:

- Dark mode is the default. Light mode is a supported variant, not the primary surface.
- One accent only (`--accent-500`, a restrained cobalt). Used for primary actions, focus rings, the active sidebar item — and almost nothing else.
- Categories are AI-determined and **dynamic**. Never hardcode a category→color map. Use the hash-based palette in `ui_kits/desktop_app/components/CategoryBadge.jsx` (`categoryColor(name)`).
- Type: Geist Sans for UI, Geist Mono for file paths, hashes, IDs. Most UI lives between 12 and 14 px.
- Iconography: Lucide via CDN. No emoji, no raster icons, no hand-rolled SVG icon glyphs.
- File paths are ALWAYS rendered in monospace.
- Voice: trusted system librarian. Calm, exact, sentence case, second person. Never marketing-y.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
