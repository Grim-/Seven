# Responsive layout (phone and tablet)

## Goal

Seven's UI works on a phone and a tablet, inside the companion app, with layouts that fit the screen and controls that fit a thumb. This is added CSS and small additions to shared components, nothing else.

## The one rule

**The desktop app does not change.** Not a pixel, not a behaviour. Every class that exists today stays as it is and keeps meaning what it means today. Phone and tablet styling is layered on top through variants that never match in the desktop app, so the desktop cannot be affected even by mistake.

## Spirit of the goal

Seven on a phone looks like Seven: same tokens, square corners, monospace, same components. It is not a second UI and there are no per-view phone copies. Small-screen behaviour is written once, in the shared components and the shell, and every view gets it by using them. A view that needs its own phone handling is a sign a shared piece is missing.

## How it works, in one paragraph

The page gets a form attribute on `<html>`: `data-form="phone"` or `data-form="tablet"`. It is set by one small module from the viewport width and the breakpoints in settings, and only when the page runs on the remote transport. The Electron transport never sets it. Tailwind gets three custom variants defined once in the theme CSS: `phone:`, `tablet:` (tablet and phone) and `touch:` (any form, coarse pointer). They match only under that attribute. Unprefixed classes stay the desktop styling exactly as written today; small-screen styling is added beside them with these variants and nothing else.

## Stages

Each stage is finished and verified before the next starts.

1. [`01-foundation.md`](01-foundation.md): the form attribute, the variants, the breakpoint settings, the viewport meta.
2. [`02-shell.md`](02-shell.md): title bar, bottom nav, main area, toasts, safe areas, on-screen keyboard.
3. [`03-shared-components.md`](03-shared-components.md): the shared components get their small-screen behaviour, once each.
4. [`04-touch.md`](04-touch.md): long press for context menus, touch equivalents for hover, touch-sized targets.
5. [`05-views.md`](05-views.md): every view checked at tablet then phone size; gaps fixed in shared pieces; views that make no sense on a device hidden by capability.

## Relation to remote access

`docs/remote-access/10-layout.md` set the aim for stage 10 of remote access. This folder is the structured plan that carries it out; when it is done, stage 10 is ticked there with a pointer here.

## Rules that apply to every stage

- No change to an existing unprefixed class, style or component default. Small-screen styling is only ever added with `phone:`, `tablet:` or `touch:`.
- No Tailwind width breakpoints (`sm:`, `md:`, `lg:`, `max-*:`) and no raw `@media` width queries anywhere in the renderer. The three variants are the only way in.
- Variants live in shared components and the shell. Feature folders use the shared components and do not add variants of their own; if they need one, a shared piece is missing.
- No branching on view ids, kinds or form names in generic code. Views and components declare what they support; generic code asks them.
- No hard-coded tunables: breakpoints, touch target size and long-press delay are settings.
- Square corners, monospace, no emojis, same tokens.
- Phone and tablet may restructure or leave things out where the desktop form makes no sense on a device (the sound control is left out: the device's own volume covers it; the nav's overflow is a full menu, not a clipped strip). Where a shared component needs a different structure, it picks its form with `useHasForm()` inside the component, never in a view.
- Anything that opens over the page on phone or tablet (menus, search, notifications, panels of choices) is a `Sheet`: docked above the nav on tablet, full screen above the nav on phone, one open at a time.
- No viewport units (`vh`, `dvh`, `svh`, `vw`) in small-screen styling. Inside the companion app's WebView they did not match the screen (panels capped with `100dvh` collapsed to a sliver). Size from the edges (`top`/`bottom` insets, `var(--nav-h)`) or with `%` of a fixed or definite box.
- No checker scripts or screenshot tooling; desktop safety comes from the variants never matching without `data-form`.
- `docs/ui-components.md` records the small-screen behaviour of each shared component in the same change that adds it.

## Problems and how they are solved

Each problem has its answer and a verdict: **Solved**, **Partly solved** (what is left), or **Not solvable by Seven** (what that means for you).

- **Phone styling leaking into the desktop app.** The variants only match under `data-form`, which only the remote transport sets. A narrow desktop window keeps the desktop layout. **Solved.**
- **Breakpoints spread through every view.** Small-screen styling is allowed only in shared components and the shell, through three variants defined once. **Solved.**
- **Breakpoints being tunable while CSS media queries can't read settings.** The width test happens in one module that sets the attribute; the CSS keys off the attribute, not a width. **Solved.**
- **Tablet in landscape is as wide as a small desktop.** It is still a tablet: touch sizing and long press apply, layout stays the desktop layout where it fits. **Solved.**
- **Dense views (model settings, llama-server) are long on a phone.** `SettingsBrowser` turns its rail into a page list, so each page is short. **Solved.**
- **The UI is fetched from the PC.** The phone always gets the current build; every change here reaches the phone on the next connect. **Solved.**
