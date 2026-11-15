# Stage 3: Shared components

## Goal

Every shared component used by views behaves on small screens, written once in the component.

## Checklist

Each item is done when the component behaves at phone and tablet sizes and `docs/ui-components.md` describes the small-screen behaviour.

- [x] `Sheet` (`ui/Sheet.tsx`) and `useSheet(id)` (`lib/sheet.ts`): the one surface for anything that opens over the page on phone and tablet.
- [ ] Inventory: list every component in `docs/ui-components.md` with what it does on phone and tablet (unchanged, stacks, becomes a sheet, becomes a page list). The list below is the start, not the end.
- [ ] `SettingsBrowser`: rail becomes a page list; opening a page shows it full width with a back control.
- [ ] `SettingCard`, `SettingRow`, `TunableRow`: label above control on `phone:`.
- [ ] `ActionBar`: wraps into a grid; overflow into a menu from the same action list.
- [ ] `GridTable`: scrolls horizontally inside its own box, first column pinned; or switches to stacked rows where the component declares it.
- [ ] `Fold`, view headers: header actions collapse into a menu from the same action list. *(Done so far: `Panel` compacts its header and wraps its actions onto their own line on `tablet:`; `ViewHeader` wraps and shrinks its title on `phone:`; `Conversation` moves header extras into a `More` popover under `tablet:`.)*
- [ ] Resizable and split panels (UI rule 2): on `phone:` one pane at a time with a control to switch; on `tablet:` the resizer stays, with a touch-sized handle. *(Done so far in `ui/Split.tsx`: `Gutter` is `tablet:w-4` / `phone:hidden`, `MainPane` is `phone:flex-[1_1_100%]!`, `ListToggle` is `touch:w-5`, and `ListPane` stays side-by-side on `tablet:` so `ListToggle` is never covered. `PagesBrowser` (Pages and Files) now uses `ListPane` + `ListToggle` with `useListPrefs('pagesList')`, so its list collapses on every form and is a closed-by-default drawer on phone that closes on selection.)*
- [ ] Side panels and drawers: open over the content on `phone:` instead of beside it. *(Done so far: `ListPane` in `ui/Split.tsx` and `SidePanel` in `components/side/SidePanel.tsx` open as `phone:` overlay drawers with a tap-to-close backdrop, a right-edge `ListToggle` / header close button inside the drawer, and local `useDrawerPrefs` state in `lib/listPrefs.ts` starting closed on phone and auto-closing on selection in `ChatView` and `DataWindow`.)*
- [x] Modals and dialogs: full screen on `phone:`, body scrolls within the screen on `tablet:`, touch-sized close.

## Problems and how they are solved

- **Some components may be desktop-only by nature (drag-heavy grids, canvases).** They declare it; views using them show the read-only or simplified form the component provides on small screens. **Partly solved** (which components, found by the inventory).
- **Overlay drawers covering the collapse toggle in the main pane header.** Switched `ListPane` overlay mode from `remote:` to `phone:`, added a backdrop and right-edge `ListToggle` inside `ListPane` (`onClose`), and backed compact drawers with local closed-by-default state in `useDrawerPrefs`. **Solved.**
