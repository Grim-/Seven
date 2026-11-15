# Remote access: end result and where things stand

The one page to read first. It says what the finished remote access looks like, what is built, what is left, and how to split the remaining work between agents so none of them wait on another. The detail lives in the numbered stage pages; where this page and the code disagree, the code wins.

## The end result

- Seven runs only on the PC. The phone or tablet is a screen and keyboard for it, over the local network only.
- The only way in is the Android app in `android/`. There is no browser access (`08-browser-access.md`).
- You turn remote access on in Seven's Network panel, scan a QR code once in the app, and press Allow on the PC. After that the app finds Seven by itself (mDNS) or uses the last address that worked.
- Every connection is TLS pinned to Seven's own certificate fingerprint, and every request carries a per-device key kept in the Android Keystore. Nothing works for an unpaired or revoked device.
- The app shows Seven's own React UI, fetched from the PC each time, so it is always the version the PC runs. The WebView never talks to the PC: everything goes through the app's loopback proxy on `127.0.0.1`, which adds the device key.
- Each device has a level (Chat, Full, Admin). Every request and event has a declared level in `src/shared/remote.ts`; the server enforces it and the UI hides what the level cannot do.
- Phone and tablet layout is added CSS only. The desktop app does not change at all (`docs/responsive-layout/`).

## Status by stage

| Stage | State |
| --- | --- |
| 1 Transport seam | Done. |
| 2 Remote bridge | Done. |
| 3 Pairing and trust | Done on Seven's side. App side: pins the fingerprint, verified pairing on a device. |
| 4 Remote permissions | Done. `settings.get` and `settings.changed` moved to Chat level (the UI cannot start without them). |
| 5 PC-only requests | Done. |
| 6 Files and media | Done on Seven's side; app-side save/open/pick written, not yet verified on a device. |
| 7 Discovery | Done on Seven's side; app-side NSD written, runtime check on a device outstanding. |
| 8 Browser access | Not built, by decision. |
| 9 Android app | Pairs, connects and shows Seven's UI on a real phone. Remaining checklist items in `09-android-app.md`. |
| 10 Layout | Planned in `docs/responsive-layout/`. Bottom nav already works on remote devices. |
| 11 Hardening | Not started. |

## Fixes found while bringing the app up (keep in mind)

- **Vault-locked loaders.** Anything in the main process that reads sealed files at startup must wait for the vault: `onVaultUnlocked` in `src/main/vault.ts`. Device trust and network settings use it. Other loaders have not been audited for the same race.
- **Model API password** is only for `/v1/*`. The gateway listens without it; with no password the model API is simply off.
- **Renderer build output** puts scripts in `static/` (`electron.vite.config.ts`), because `/assets/` is Seven's asset-bytes route. The gateway serves `out/renderer`, so the phone sees UI changes only after `npm run build`; `npm run dev` does not update it.
- **UI calls that are never allowed remotely** must be gated with `allowedRequest` before calling (the title bar's window controls were the first case). An ungated call shows up as `CodedError: Not allowed from this device` in the WebView console.
- **App root** is `fixed inset-0` in `App.tsx`, so it doesn't depend on `html`/`body` heights inside the WebView. The app's WebView is created with `MATCH_PARENT` layout params.
- **Remote styling** uses the `remote:` Tailwind variant (set by the remote transport as `html[data-transport="remote"]`). It never matches in the desktop app.
- **Debugging the page on the phone:** debug builds of the app allow `chrome://inspect` on the PC to open the WebView's DevTools.
- **Android Studio** can overwrite files changed on disk with stale editor copies; use File > Reload All from Disk after files change outside it.

## What is left, as independent work streams

Each stream has its own files, so agents can run them at the same time. When a stream must touch a file owned by another, it says so in its stage page before changing it.

| Stream | Owns | Work | Depends on |
| --- | --- | --- | --- |
| A. Android app | `android/` | Finish and verify the `09-android-app.md` checklist: device capabilities on a device, discovery on a device, lost connection and background disconnect, release signing written down, optional long-task notifications. | Nothing. |
| B. Responsive layout | `src/renderer/src/components/shell/`, shared UI components, `src/renderer/src/theme/`, `docs/responsive-layout/` | Stages 1 to 5 of `docs/responsive-layout/`, in order. | Nothing. Stage 1's desktop screenshot baseline must exist before any other layout change. |
| C. Seven-side gaps | `src/main/network/`, `src/shared/remote.ts`, `src/shared/protocol.ts` | Show the announce `id` on the manual pairing screen; a route for a device to revoke itself; cancel a pending pairing claim when its connection closes; split `ui.respond` so a Chat device can't approve PC tool prompts; serve presented pages from a separate origin without the proxy cookie; audit other main-process loaders for the vault-unlock race. | Nothing. |
| D. Hardening | `docs/remote-access/11-hardening.md`, test scripts | The stage 11 checklist, run as scripts against the PC's own LAN address, results recorded with date and Seven version. | C done, A verified. |

Shared hot spots that need care across streams: `src/shared/remote.ts` (levels), `src/shared/protocol.ts` (request types), `src/main/settings.ts` (new settings). Only stream C changes the first two; a stream that needs a new setting adds it in its own commit and says so.

## How an agent picks up work here

1. Read this page, then the stage page for the stream (`09-android-app.md`, `docs/responsive-layout/README.md`, `11-hardening.md`), then `09-companion-app-brief.md` for the wire contract.
2. Read `AGENTS.md` and load the `seven-kinds` skill (and `seven-ui-components` for React UI) before changing Seven code.
3. Work only in the files your stream owns. Small pieces, each finished and verified before the next.
4. Tick a checklist item only when it is actually verified. Record decisions and anything hard to place in the stage page, and update the status table above when a stage changes state.
5. If the plan turns out wrong once real constraints appear, stop and say so in the stage page rather than working around it.

## Rules that hold everywhere

- Never touch user data outside the repo (`~/.seven` and the like); debug with code and mocks only.
- No code comments. No hard-coded tunables: they are settings (Seven's settings, or `AppSettings.kt` in the app).
- No branching on kind, view or form names in generic code, and no kind-keyed maps.
- Reuse shared components and hooks before writing new ones.
- Square corners, monospace, no emojis.
- The desktop app's look and behaviour never change because of remote work.
- Never hide a problem; fix the cause.
