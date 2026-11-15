# Stage 2: Shell

## Goal

The frame around every view works on a phone and a tablet: title bar, bottom nav, main area, toasts and overlays, safe areas, keyboard.

## Checklist

- [ ] Title bar: on `phone:` the activity, clock and glyph row fits one line; items that don't fit move into a menu built from the same list the title bar renders. *(Done so far: `TitleBar.tsx` compacts logo, spacing, `Activity` by hiding `Pulse`, and `Clock` by hiding the date on `phone:`; overflow menu not yet added.)*
- [x] Bottom nav: a Menu tab first, then as many `viewsIn('tabs')` views as fit (measured, no horizontal scrolling). Menu opens `NavMenu` (`shell/NavMenu.tsx`), a `Sheet` listing every view (current one marked), `MainView.menu` tools, favourites, the player, themes, and Browser / Lock actions at the bottom. No sound control on phone or tablet (device volume covers it). Search and Notifications are `NavButton`s opening their own sheets. Settings and Lock stay on the bar on tablet, in the menu on phone. Desktop renders `DesktopTaskbar` unchanged.
- [ ] Safe areas: shell padding uses `env(safe-area-inset-*)` under the variants, so the nav and title bar clear notches and the gesture bar. *(Done so far: `Taskbar`, floating `AppSearch`, and `NotificationButton` apply `env(safe-area-inset-bottom)` under `tablet:`/`phone:`; Android's `MainActivity` already consumes system insets via `safeDrawingPadding()`. `TitleBar` top safe area not yet added.)*
- [ ] On-screen keyboard: the main area shrinks with the visual viewport; focused inputs stay visible.
- [ ] Toasts, tooltips and modal hosts: positioned and sized within the phone width; modals become full-screen on `phone:`. *(Done so far: `Popover` clamps to the viewport; search and notifications are sheets; `Modal` scrolls its body within `100dvh` on `tablet:` and is full screen on `phone:`; context menus are a single scrolling column within the screen with touch-sized rows, submenus cascading below the tapped row. Toasts and tooltips still pending.)*

## Problems and how they are solved

- **Thirteen views don't fit a phone nav bar.** The bar shows what fits; the Menu sheet lists every view from the same registry list, so nothing is reachable only from a clipped strip. **Solved.**
- **Panels collapsing to a sliver in the companion app.** Their height was capped with `100dvh`/`vh`, which the WebView resolves to almost nothing. Sheets are sized by their edges, and `Popover`, `Modal` and `ContextMenu` cap with `%` of the fixed viewport box under the variants. **Solved.**
- **Dropdowns anchored to tiny nav buttons are too small to use and clip.** Everything that opens from the nav is a `Sheet` with touch-sized rows, one open at a time (`useSheet`). **Solved.**
- **The companion app also pads for system bars.** The app's frame (`MainActivity.kt` `safeDrawingPadding()`) consumes system bar insets on Android so `env(safe-area-inset-*)` stays 0 inside the WebView while still protecting edge-to-edge mobile browsers. **Partly solved** (top bar inset / browser verification pending).
