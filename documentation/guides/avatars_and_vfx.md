# Avatars, Hybrid Media & Reusable VFX Guide

This guide explains how Seven renders live agent avatars, how procedural avatars mix in per-pose and one-shot reaction images/videos, how tool/reaction signals flow from chat and gameplay into UI overlays, and how to attach or trigger reusable curve-driven VFX across avatars, chat elements, and tabletop views.

---

## 1. Architecture Overview

Seven splits animated visual feedback into three composable layers:

1. **Inner Canvas & Hybrid Media (`BaseAvatar`, `MediaLayer`)** — Draws procedural canvas art (`glyph`, `lattice`, or custom renderers) and/or composited `AssetMedia` images, GIFs, and cached `<video>` clips per mood, activity, or transient reaction (`hit`, `heal`, `crit`).
2. **Outer Frame VFX (`<VfxFrame>`, `useVfx`, `triggerVfx`, `VfxPreset`)** — Animates borders, glows, opacity, shake/wobble curves, and glitch bursts around any DOM container via the Web Animations API (WAAPI), keyed by semantic target IDs (`avatar:<sessionId>`, `sheet:<id>`, `token:<id>`, `card:<name>`).
3. **Status & Thought Overlays (`ThoughtTag`, `useReactions`, `AvatarSignals`)** — Surfaces live running tool info, emoji bubbles, and reaction badges cleanly without overflowing small avatar thumbnails.

All visual styling uses Seven's semantic CSS custom properties (`--color-accent`, `--color-alert`, `--color-ok`, `--color-cyan`, `--color-purple`, `--color-teal` in `src/renderer/src/theme/tokens.css`) and respects `prefers-reduced-motion`.

---

## 2. Hybrid Avatars & Per-Pose / Reaction Media

### Shared Definitions
- **Moods, Activities & Reaction Poses** (`src/shared/moods.ts`):
  - `MOODS` and `ACTIVITIES` define persistent emotional/activity states (`idle`, `thinking`, `tool`, `talking`, etc.).
  - `REACTION_POSES` registers transient one-shot reaction slots: `hit` (`Hit`), `heal` (`Heal`), and `crit` (`Crit`), checked with `isReactionPose(name)`.
  - `AvatarPose` carries optional `mood`, `energy`, `warmth`, `activity`, `rate`, and `reaction?: string | null`.
- **Per-Frame Media & Frame Entries** (`src/shared/settingSpec/spec.ts`, `src/shared/settingSpec/frames.ts`):
  - `FrameEntry = string | { text?: string; media?: string }` lets any individual frame remain a lightweight string (`'( • _ • )'`) **or** attach its own image/GIF/video `media` asset ID with optional overlay text.
  - Helpers exported from `@shared/settingSpec`: `frameText(entry)`, `frameMedia(entry)`, and `normalizeFrame(text, media?)` (automatically collapsing media-less frames back to plain strings).
- **Renderer Registry** (`src/shared/avatars/registry.ts`, `glyph.ts`, `lattice.ts`, `picture.ts`):
  - `MEDIA_CLIP_SETTING` defines a fallback state-level `{ name: 'picture', kind: 'picture' }` slot auto-registered on any renderer that omits it, alongside grouped `SettingSpec.group` tags (`look`, `frames`, `glances`, `motion`).
  - `picture` renderer also includes optional `frames` + `speed` so even picture-first avatars can play multi-frame image/video/text sequences per pose or reaction.

### Canvas & Media Composition
- **`Animated<S>`** (`src/renderer/src/components/animated/Animated.ts`):
  - 30 fps canvas base class managed by a single `requestAnimationFrame` loop (`loop.ts`).
  - Exposes `react(name, detail?)` -> `protected onReaction(name, detail?)` and `protected reschedule()` so transient reactions can wake a paused/still avatar without tearing down its renderer.
- **`MediaLayer`** (`src/renderer/src/components/avatars/mediaLayer.ts`):
  - Caches loaded `HTMLImageElement` and looping/one-shot `HTMLVideoElement` sources across frames and cleans up via `WeakSet` disposal.
  - Supports `loop: false` one-shot playback with `onEnded` callbacks and smooth crossfades between clips.
- **`BaseAvatar` & Renderers** (`BaseAvatar.ts`, `renderers/glyph.ts`, `renderers/lattice.ts`, `renderers/picture.ts`):
  - Resolves `poseKey()` with priority: active `reaction` -> current `activity` -> dominant `mood` -> base settings.
  - Exposes `paintMediaClip(clip, time, key, opts)` and `poseClip(key, sequenceSetting)`. Precedence per tick: active frame's `media` -> explicit pose fallback `picture` -> base `picture` (only when the pose does not override its frame sequence) -> procedural canvas drawing. If a frame specifies both `media` and `text`, text overlays on top of the painted frame media.

### Adding a New Reaction Pose or Avatar Renderer
1. To add a new reaction clip slot, append `{ name, label }` to `REACTION_POSES` in `src/shared/moods.ts`. `PoseChips`, `POSE_KEYS`, and `AvatarsPanel` pick it up automatically.
2. To build a new procedural renderer:
   - Register metadata with `registerAvatarRenderer(info)` under `src/shared/avatars/`.
   - Subclass `BaseAvatar` under `src/renderer/src/components/avatars/renderers/`, register it via `registerAvatarDrawer(id, Class)`, and leave `ownsMedia = false` to get per-pose/reaction media compositing automatically.

---

## 3. Avatar Signals & `ThoughtTag`

### Signal Pipeline
- **`src/renderer/src/store/reactions.ts`**:
  - `useActiveTool(sessionId)` reads the active running tool call from `useSessions` and returns `{ name, label }` (human-readable tool activity/name) or `null`.
  - `useAvatarReaction(sessionId)` returns the active `ReactionCue | null` (`{ id, kind, until, label? }`).
  - `useReactions.getState().trigger(sessionId, kind, seconds?, label?)` triggers a transient reaction cue manually (e.g., from combat HP changes or scripted acts).
- **`src/renderer/src/components/avatars/signals.ts` & `useAvatarSignals.ts`**:
  - `SignalSource` exposes `reactionTriggered` event subscriptions plus per-frame `tool` and `reaction` fields inside `AvatarSignals`.
  - `useAvatarSignals(sessionId, pose)` feeds `useActiveTool`, `useAvatarReaction`, and `pose?.reaction` directly into `BaseAvatar` and fires `reactionTriggered` whenever a reaction cue ID changes or `pose.reaction` is set.

### `ThoughtTag` (`src/renderer/src/components/avatars/ThoughtTag.tsx`)
- Renders live tool and reaction status inside `<AgentAvatar>` (`src/renderer/src/components/agents/look.tsx`) according to container pixel size:
  - **`< 48px` (`dot` / `badge`)**: compact square corner indicator (`bg-alert` for hit/error/crit, `bg-ok` for heal, `bg-cyan` for active tool) with descriptive `title` tooltip.
  - **`>= 48px` (`portrait` / `stage`)**: crisp uppercase monospace pill anchored at bottom-left (`font-mono text-[9px]`) showing the reaction label (`HIT`, `HEAL`, etc.) or active tool label.

---

## 4. Reusable Curve-Driven VFX System

### Core Modules
- **`src/renderer/src/store/vfx.ts`**:
  - Pub/sub dispatcher with built-in per-target/preset cooldown coalescing (`100ms`) to prevent visual spam during streaming or multi-hit cascades.
  - `triggerVfx(targets, cue: VfxCue)` — `targets` can be a single ID or array of IDs (`string | (string | null | undefined)[]`); `VfxCue` accepts `{ preset, color?, intensity?, durationMs?, loop? }`. `color` accepts any CSS color string or semantic `VfxTone` (`'accent' | 'alert' | 'ok' | 'teal' | 'purple' | 'cyan'`).
- **`src/renderer/src/components/vfx/registry.ts` & `presets.ts`**:
  - Curves are authored with `sampleCurve(steps, fn)` returning Web Animations API `Keyframe[]` and `KeyframeAnimationOptions`.
  - Built-in presets registered in `presets.ts`:
    - `hit` (`alert` shake + border flash)
    - `pulse` (`cyan` breathing scale + glow)
    - `glow` (`accent` soft border halo)
    - `wobble` (`accent` damped tilt + squash/stretch)
    - `flash` (`ok` opacity + border strobe)
    - `fadeIn` / `fadeOut` (vertical entrance/exit)
    - `glitch` (`alert`/`cyan` stepped horizontal jitter)
    - `highlight` (`cyan` double-shadow attention pulse + subtle scale)
- **`src/renderer/src/components/vfx/useVfx.ts` & `VfxFrame.tsx`**:
  - `useVfx<T extends HTMLElement>(targets, inlineCue?)` returns a React callback/ref to attach to **any** existing DOM element (no wrapper div required).
  - `<VfxFrame target={...} cue={...} as="div" | "span">` wraps components declaratively and forwards standard HTML attributes.

### Attaching VFX to New UI Elements
Use `<VfxFrame>` or `useVfx` with semantic target names:

```tsx
// Declarative wrapper: responds to sheet, token, or agent cues
<VfxFrame as="span" target={[`sheet:${sheetId}`, `agent:${agentId}`]}>
  <MyPortrait />
</VfxFrame>

// Ref hook directly on an existing container
const vfxRef = useVfx<HTMLDivElement>(`card:${cardName}`)
return <div ref={vfxRef} className="...">{children}</div>
```

Trigger from anywhere in the renderer:

```ts
import { triggerVfx } from '../store/vfx'

triggerVfx(`sheet:${targetId}`, { preset: 'hit', color: 'alert', intensity: 1.2 })
```

Currently wired UI targets:
- `AgentAvatar` (`src/renderer/src/components/agents/look.tsx`): `avatar:<sessionId>`, `agent:<agent.id>`, and every active `sheet:<sheetId>`
- `LiveAvatar` (`src/renderer/src/components/avatars/LiveAvatar.tsx`): defaults to `avatar:<avatar.id>` (overridable via `target` prop)
- `CardPlayRecord` (`src/renderer/src/components/cards/CardPlayRecord.tsx`): `card:<name>`, `card:<id>`
- `GamePortrait` (`src/renderer/src/game/ui/GamePortrait.tsx`): `sheet:<visitor.sheet>`
- `TokenLayer` (`src/renderer/src/components/maps/TokenLayer.tsx`): `token:<visitor.token>`, `sheet:<visitor.sheet>`, `agent:<visitor.agent>`

---

## 5. Game, Card & Reaction Wiring

### Store & Chat Integrations
- **Agent Reactions & Tool Failures** (`src/renderer/src/store/reactions.ts`):
  - `onReaction` maps incoming `AgentReaction` (`reaction` and `state` moods) through lookup tables (`REACTION_VFX`, `MOOD_VFX`) to `triggerVfx('avatar:' + sessionId, ...)`.
  - `onFailed` triggers `{ preset: 'glitch', color: 'alert' }` plus a temporary `'hit'` (`Error`) reaction cue.
- **Outcome & Card Helper** (`src/renderer/src/components/vfx/effectVfx.ts`):
  - `triggerOutcomeVfx(outcome, fallbackTargets?)`: inspects `EffectOutcome.results` for numeric HP changes (`from` -> `to`). Damage (`to < from`) triggers `'hit'` VFX on `sheet:<id>` / `creature:<id>` / `token:<id>` plus `triggerReactionForSheets(..., 'hit')`; healing (`to > from`) triggers `'flash'` (`color: 'ok'`) plus `'heal'` reaction clips.
  - `triggerCardPlayVfx(sessionId, cardName, tone)`: fires card & caster VFX when a `card_play` chat element arrives in `src/renderer/src/store/bootstrap.ts`.
  - Called automatically by `runCardEffects` (`src/renderer/src/components/play/cardEffects.ts`) and `EffectsTrigger` (`src/renderer/src/components/play/triggers/EffectsTrigger.tsx`).
- **Agent Gameplay Cards** (`src/modules/game/cardVariation.ts`):
  - Emits `{ kind: 'vfx', target, data: { preset, tone, reaction } }` `ViewEvent` entries for HP deltas in agent-played gameplay cards.

### Tabletop `viewActs` (`src/renderer/src/components/play/viewActs/vfx.ts`)
- Registers both `vfx` (as an ambient host-optional act via `registerAmbientAct`, so chat-only sessions still flash portraits without requiring the Play map to be mounted) and `highlight` (world act via `registerViewAct`).
- Supported `ViewEvent` shape:
  - `kind: 'vfx' | 'highlight'`
  - `target?: string | null` (sheet/creature/token ID)
  - `data`: `{ preset?: string, targets?: string[], target?: string, tone?: string, color?: string, intensity?: number, durationMs?: number, loop?: boolean, reaction?: string }`

### Avatar Studio (`AvatarsPanel.tsx` & `FramesControl.tsx`)
- **Pinned Stage & Identity Header**: Live preview (`LiveAvatar` + `SizeStrip`), `Name`, `Description`, `Style` (`RendererPicker`), `MoodPad`, `Doing`, save/copy/delete actions, and **Test FX** (`Hit`, `Heal`, `Crit`, `pulse`, `wobble`, `glitch`, `highlight`) stay pinned at the top so tweaking any frame or slider keeps the live preview visible.
- **Pose Strip & Grouped Inspector**: `PoseChips` switches between Base, activity/mood poses, and reactions (`Hit`, `Heal`, `Crit`). Settings dynamically filter by `SettingSpec.group` tabs (`Look & Frames`, `Frame Sequence`, `Idle Glances`, `Motion & FX`) in natural wrapping flow rows instead of monolithic grids.
- **Flowing Frame Cards**: `FramesControl` (`src/renderer/src/components/settingSpec/controls/FramesControl.tsx`) renders frames as a compact wrapping strip of cards where any individual frame can carry text, an attached image/GIF/video clip (`fromSeven`/`fromDisk`), or both.
