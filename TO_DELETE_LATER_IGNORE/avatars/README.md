# Avatars rethink

Status: **phases 1–3 built; phase 3 waiting on the user's test run.** Phase 4 (new renderers) is next. Tick items as they land.

## Why

Seven is a home assistant, not a coding agent. The avatar is the thing on screen that makes it feel present, so it should be something you want to look at. Today's avatars can't get there:

- Each coded avatar in `components/agents/avatars.tsx` has its own data shape (`FACE` frame lists, `SKULL` numbers, `HD` layers), so there is nothing shared for an editor to edit or for a new avatar to reuse. Making a variant means writing code.
- They break the kind rules: `CodedAvatar` picks by `type === 'glitch_skull'`, `skullKey` checks `state === 'error'`, `look.tsx` has `MOTION` and `TINT` keyed by state and `StateFx` checks `state === 'thinking'`, and `CODED_AVATARS` in `shared/types.ts` is a central list. `BackgroundCanvas` has the same problem with `MAKERS`.
- The only thing an avatar knows is one of 8 mood words. It can't tell how fast text is streaming, that a tool is running, that you're typing, where the cursor is or what time of day it is, so it plays animations rather than feeling alive.
- Picture avatars use a separate code path, with CSS wobble and a tint on top.

## The idea in one paragraph

Split avatars into **renderers** (a few pieces of code that draw, each registering itself with a settings schema) and **avatars** (a library kind: pure data, meaning a renderer plus setting values plus optional per-mood art). Users and agents make, edit, copy and share avatars without code, and built-in avatars can't be changed but can be copied, the same way themes work. Every renderer gets the same live **signals** each frame, and moods become two dials (energy, warmth), so a renderer never needs per-mood tables and new moods work everywhere.

## Files

| File | What it covers |
|---|---|
| [01-model.md](01-model.md) | Renderer vs avatar, the avatar kind, stored data, agent look, compatibility with saved agents |
| [02-signals.md](02-signals.md) | What an avatar is told every frame, moods as dials, blending, nearest-mood fallback |
| [03-renderers.md](03-renderers.md) | Shared animation base with backgrounds, sizes, the shared loop, the renderer list |
| [04-editor.md](04-editor.md) | The avatar studio, where avatars appear, agent tools |
| [05-problems.md](05-problems.md) | Every problem with its solution, and what isn't solved |

## Phases

Each phase leaves Seven working. Nothing stored by the user is rewritten at any point.

### Phase 1: foundation (no visible change)
- [x] Shared setting schema (`@shared/settingSpec`, each type registers its cleaner; `SettingControls` registers a control per type) — 01, 03
- [x] `Animated` base extracted from `BaseBackground`; backgrounds moved onto it with identical behaviour — 03
- [x] Shared frame loop with off-screen pausing — 03
- [x] Background self-registration replaces `MAKERS` and `BACKGROUNDS` — 03
- [x] Mood definitions with dials — 02
- [x] `AvatarSignals` built from what exists today (activity, writing speed, mood, gaze, ambience, size). Not yet: `listening` (needs the composer to report typing) and reactions sent to renderers (no renderer uses them yet) — 02

### Phase 2: avatars become a kind
- [x] Avatar renderer registry — 03
- [x] Glyph and Lattice renderers; the three current avatars become built-in avatars with the same ids — 03, 01
- [x] Picture renderer replaces the CSS wobble/tint path — 03
- [x] Avatar store and `avatar` kind (engine `Kind` + `KindUi` with chat card, stage, widget and thumb; the studio screen is phase 3), pack/unpack — 01
- [x] `AgentAvatar` renders through the registry only; `CodedAvatar`, `MOTION`, `TINT`, `StateFx`, `skullKey`, `CODED_AVATARS`, `AVATAR_STATES` removed. `set_avatar` takes an avatar name — 01

### Phase 3: studio
- [x] Avatar studio screen (`components/avatars/studio/AvatarsPanel.tsx`: preview, size strip, mood pad, activity buttons, pose chips, generated controls, frame editor). No React test button yet, since no renderer answers reactions — 04
- [x] Look editor has one Avatar field (`AvatarField`): live tiles of every avatar, a picture/GIF/video, Open in studio, and Make it an editable avatar for a picture — 04
- [x] Agent tools `create_avatar` and `change_avatar` (`modules/look/avatarTools.ts`); the avatar card lists settings and pose settings for agents — 04

### Phase 4: new renderers
- [ ] Eyes — 03
- [ ] Sigil — 03
- [ ] Swarm — 03
- [ ] Braille portrait (Blackwall face generalised) — 03
- [ ] Stage size: the big avatar presence on the overlay and idle screen — 04

### Later, not planned here
- Voice level and lip sync. A slot is reserved in the signals (02) so it can be added without changing renderers.
- 3D models with three.js and animation controllers. The renderer contract (03) is meant to hold a three.js renderer: the controller maps signals and mood dials to clips and blend weights. Its own plan comes when that work starts.
