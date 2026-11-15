# Stage 1: Foundation

## Goal

The pieces every later stage builds on: the form attribute, the three variants, the settings, and the viewport meta.

## Checklist

- [ ] Settings for the layout: phone maximum width, tablet maximum width (CSS pixels), touch target minimum size, long-press delay. Defaults recorded here once chosen. Readable at Chat level (layout only, like `settings.get`). *(Currently fixed defaults in `src/renderer/src/lib/form.ts`: `PHONE_MAX_WIDTH = 640`, `TABLET_MAX_WIDTH = 1024`.)*
- [x] One module in `src/renderer/src/lib/` (`src/renderer/src/lib/form.ts`, started from `src/renderer/src/main.tsx` only when `hasCapability('form')`) sets `data-form` on `<html>` from the viewport width (`<= 640px` `phone`, `<= 1024px` or coarse pointer `tablet`), updates it on resize, orientation change, and pointer media change. The Electron transport never sets `form` capability. *(Needs wiring to settings once layout settings are added.)*
- [x] Transports declare whether they set a form (`TransportCapabilities.form` in `src/shared/transport.ts`, enabled in `src/renderer/src/transport/remote.ts`), so `main.tsx` and the shell don't test which transport is running.
- [x] `@custom-variant phone`, `tablet` and `touch` defined once in `src/renderer/src/theme/variants.css` (imported in `src/renderer/src/index.css`) against `html[data-form]` (with higher specificity for `phone:` over `tablet:`, and `pointer: coarse` for `touch`).
- [x] `--nav-h` (bottom nav height including the safe area) set per form in `theme/variants.css`, for anything that docks above the nav.
- [x] `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">` in `src/renderer/index.html`. Electron ignores it.
- [x] Record in `docs/ui-components.md`: the variants, when to use each, and that unprefixed classes are desktop.

## Problems and how they are solved

- **The App root depending on percentage heights.** The App's root div is already `fixed inset-0`; the shell stops depending on `html`/`body` heights. **Solved.**
