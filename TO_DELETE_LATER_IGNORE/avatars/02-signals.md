# 02 · Signals and moods

## Why signals

An avatar that only knows "thinking" plays the same thinking loop whether the model is crawling through a long reasoning pass or firing tools. Small, true reactions are what make something feel alive: speeding up as text pours out, glancing at the cursor, perking up when you start typing. All of these come from data Seven already has.

## `AvatarSignals`

Built once per frame by the shared loop (`03-renderers.md`) for each conversation that has an avatar on screen, and handed to every avatar for that conversation.

| Signal | Type | Source today | Why |
|---|---|---|---|
| `activity` | `idle \| listening \| thinking \| tool \| talking` | `activityOf` in `store/reactions.ts`, split so a running tool is its own state. `listening` (composer focused with text being typed) is defined but not reported yet | Five clearly different behaviours instead of two |
| `rate` | 0..1 | Recent text growth of the last assistant part, smoothed | Writing visibly speeds up and slows down |
| `since` | seconds | Time since `activity` last changed | Idle can get sleepier over time, and long thinking can show strain |
| `mood` | `{ name, energy, warmth, strength }` | `useAvatarState` mood/failed, blended (below) | One continuous input for every renderer |
| `gaze` | `{ x, y }` −1..1, or null | Pointer position relative to the avatar's box, null when the window isn't focused | Eyes, tilt, parallax |
| `colors` | `{ accent, secondary, base }` | Read from the CSS colour variables around the avatar (theme palette and the agent's accent), once a second | Avatars match the theme and the agent without subscribing to theme state. Sky phase is not passed yet |
| `size` | `dot \| badge \| portrait \| stage` | From the box size (`03-renderers.md`) | Draw what makes sense at that size |
| `voice` | 0..1 | **Reserved, always 0 for now** | Room for lip sync later without changing the contract |

Events, separate from the per-frame values:
- `reaction(name)`: the existing reaction bubbles (`REACTIONS`), sent once. Renderers may answer with a burst, and the bubble overlay in `AgentAvatar` stays.
- `activity(from, to)`: sent once per change, for one-off transitions.

The signal builder is one module, `lib/avatarSignals.ts`. It reads stores and has no knowledge of renderers.

## Moods as dials

Today `AvatarState` is a union and `MOTION`/`TINT`/`SKULL`/`FACE` are tables keyed by it. Replace those tables with a definition per mood:

```ts
interface MoodDef {
  name: string        // the value agents use, e.g. 'happy'
  label: string
  energy: number      // -1 calm .. 1 intense
  warmth: number      // -1 hostile/cold .. 1 warm/friendly
  description: string // one line, agent-facing
}
```

Rough placement: idle (0, 0), happy (0.3, 0.8), laughing (0.9, 0.9), sad (−0.7, −0.2), angry (0.9, −0.9), error (0.6, −0.6). Thinking and talking stop being moods: they are `activity`, which is what they always were. Presentations that name a pose as one word (story and scene moods such as `talking`) turn it into a mood or activity with `poseOf`.

- The moods and activities are defined in one file, `shared/moods.ts`, which replaces `AVATAR_STATES`. Agent tools take the names from it as a fixed set of choices.
- Generic code never checks a mood name. Renderers read `energy`/`warmth`, and art-driven renderers read the avatar's per-mood overrides with the nearest-mood fallback (`01-model.md`).
- **Why two dials:** every visual quality maps naturally onto them. Speed, jitter and particle spread follow energy; colour temperature, softness and openness follow warmth. A renderer written once handles every mood, including moods added later.

## Blending

`mood` is not a switch. When it changes, the dials ease to the new point over ~400 ms, and `strength` fades in and back out over the mood's `seconds`. `name` changes at the halfway point, so art-driven renderers crossfade there.

**Why:** snapping between states is the main reason the current avatars feel mechanical.

## Error

`error` today comes from `failed` in the reactions store and is mapped to angry for the skulls. It becomes an ordinary mood (high energy, cold), set by the same `onFailed`. The skull's "breach" look comes from those dial values, so no mapping is needed.
