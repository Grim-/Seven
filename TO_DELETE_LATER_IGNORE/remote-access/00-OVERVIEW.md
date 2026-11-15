# Remote access: Seven on your phone and tablet

Use the whole of Seven (chats, memory, tools, views, models) from a phone or tablet, over your local network, safely. Seven on the PC stays the one and only engine; the phone is a screen and keyboard for it.

## The spirit of the whole plan

- **Same Seven, not a second one.** The phone runs the same React UI against the same engine through the same typed protocol. No parallel app logic to keep in sync, no "lite" Seven that drifts.
- **Secure on the local network too.** Treat your own Wi-Fi as hostile: anyone on it (a guest, a compromised smart plug) must not be able to read, impersonate or drive Seven. Every connection is encrypted, the phone checks it is really your PC, and the PC checks it is really your paired device.
- **Minimal fuss.** Turn it on in Seven, scan a QR code once in the app, and it finds Seven by itself after that. No typing IP addresses, no certificate warnings, no installing certificates; the word "certificate" never appears to you.
- **Off unless you turn it on, and default deny.** Nothing is reachable until you enable it, and a remote device can only do what has been explicitly allowed for remote use.
- **No hard-coded tunables.** Ports, timeouts, limits, discovery name: all settings, like the rest of Seven.

## What exists today

- `engine/model/server/gateway.ts`: an HTTPS server (port setting, default 8443) with a self-signed certificate made by `certificate.ts` (covers the hostname and LAN IPv4 addresses, fingerprint stored), a hashed password (`password.ts`), a private-network-only option (on by default), per-device lockout after failed passwords, a request size limit and a client list. It only forwards `/v1/models`, `/v1/chat/completions` and `/v1/completions`.
- The renderer talks to Seven only through `renderer/src/lib/ipc.ts` (`engine()`, `main()`, `on()`), which calls `window.seven` from `preload/index.ts` (`engine`, `main`, `on`, `pathForFile`). Requests and events are typed in `shared/protocol.ts` (`EngineRequests`, `MainRequests`, `Events`).
- 44 main-process requests in `MainRequests` (window, overlay, dialogs, clipboard, vaults, backups, settings, hotkey) that only make sense on the PC as they stand.

## What can't be fully solved

Read this before deciding to build. Everything else in the stage pages has a solution written next to the problem.

- **Wi-Fi with client or AP isolation** (most guest networks, some mesh systems) stops devices reaching each other at all. No local remote access can work there. You need the phone and PC on a network without isolation. Seven says so when this is the cause.
- **Routers that block multicast** stop discovery only. Connecting still works through the addresses saved at pairing; a fixed address for the PC in your router brings back automatic finding.
- **No browser access.** A browser can't trust a local server without a certificate install or an outside service, so the Android app is the only way in (like Syncthing and KDE Connect). Other devices need their own app.
- **Windows firewall:** if you deny Seven network access, Seven can't override it. It shows how to allow it.
- **No notifications while the app is closed** in this plan.

Nothing here blocks the main goal: the whole of Seven on an Android phone or tablet on your own Wi-Fi, encrypted, pinned, per-device keys, default deny, with nothing to install but the app.

## Stages

Each stage has its own page with its goal, its spirit, a checklist and the problems to expect. They are in build order; each one leaves Seven working.

1. [Transport seam](01-transport-seam.md): the renderer stops assuming Electron.
2. [Remote bridge](02-remote-bridge.md): the protocol over a WebSocket on the HTTPS server, and Seven serving its own UI.
3. [Pairing and device trust](03-pairing-and-trust.md): QR pairing, pinned certificate, per-device keys, revoking.
4. [Remote permissions](04-remote-permissions.md): default deny; each request says what a remote device may do.
5. [PC-only requests](05-pc-only-requests.md): every main-process request gets a remote behaviour.
6. [Files and media](06-files-and-media.md): attachments, images, saving, audio without PC paths.
7. [Discovery](07-discovery.md): Seven announces itself on the LAN.
8. [Browser access](08-browser-access.md): not built, and why.
9. [Android app](09-android-app.md): thin app for discovery, pairing, pinning and key storage.
10. [Tablet and phone layout](10-layout.md): the UI fits small and touch screens.
11. [Hardening and checks](11-hardening.md): try to break it before trusting it.

## Out of scope for now

- iOS app (a later app reuses stages 1–7 and 10; only the shell is new).
- Reaching Seven from outside the local network.
- Running anything model-related on the phone itself.
