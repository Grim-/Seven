# 03 · Renderers

## One animation base for backgrounds and avatars

`components/backgrounds/base.ts` already has what an avatar renderer needs: mount, resize, colours, settings, reactions, a reduced-motion still frame and a 30 fps cap. Extract it as `Animated` in `components/animated/`, with two subclasses: `BaseBackground` (unchanged behaviour) and `BaseAvatar`.

**Why:** one place for frame timing, reduced motion and canvas sizing, so a fix lands in both. The Blackwall face (`blackwallFace.ts`) shows the two families already overlap.

## Shared settings schema

Generalise `BackgroundSetting` (`shared/backgrounds.ts`) into `SettingSpec` in `shared/settingSpec.ts`, used by both backgrounds and avatars:

| `type` | Value | Control |
|---|---|---|
| `range` | number, min/max/step | Slider |
| `color` | hex, or `accent`/`secondary` | Colour row with theme-linked options |
| `choice` | one of `options` | Select or segmented |
| `toggle` | boolean | Toggle |
| `picture` | asset id (`kinds` limits image/video) | `PictureField` |
| `frames` | string[] | Frame editor (`04-editor.md`) |

One cleaner and one control set serve every renderer. `effectSettingsFor` and `cleanEffectSettings` become the generic `settingsFor(specs, saved)` and `cleanSettings(specs, value)`.

**Why `color` can be `accent`:** an avatar that follows the agent's accent or the theme keeps looking right when either changes. A fixed hex is still allowed.

## Registration

```ts
registerAvatarRenderer({
  id: 'lattice',
  label: 'Lattice',
  description: 'A pulsing grid core with reaching arms and glitch tearing.', // agent-facing, one line
  settings: SettingSpec[],
  moodSettings?: string[],      // which settings can be overridden per mood
  sizes?: Partial<Record<Size, 'live' | 'still'>>,  // see Sizes
  builtins: AvatarSeed[],       // built-in avatars from this renderer
  make: (colors, settings) => BaseAvatar
})
```

Each renderer calls this from its own file. Backgrounds get `registerBackground` with the same shape (id, name, description, reactions, settings, make), replacing both `BACKGROUNDS` and `MAKERS`. Nothing outside a renderer's own file names it.

`BaseAvatar` adds two methods to `Animated`:
- `frame(dt, time, signals)`: draws, given `AvatarSignals` (`02-signals.md`).
- `event(e)`: one-off reactions and activity changes.

## Sizes

| Size | Box | Typical place | Default |
|---|---|---|---|
| `dot` | < 20 px | Lists, message labels | Still frame, redrawn only when mood/activity changes |
| `badge` | 20–48 px | Chat header, tiles | Live, reduced detail |
| `portrait` | 48–160 px | Look editor, side panel | Live, full detail |
| `stage` | > 160 px | Overlay presence, idle screen, studio | Live, full detail plus ambient extras |

A renderer can mark a size `still`. **Why:** a dozen avatars in a list each running a full animation is wasteful and visually noisy, and a still glyph reads better at 16 px anyway.

## Shared frame loop

One `requestAnimationFrame` loop (`components/animated/loop.ts`) drives every mounted `Animated`, instead of one loop each:
- An `IntersectionObserver` removes off-screen instances from the loop.
- A hidden document pauses everything (today's `document.hidden` check, done once).
- Signals are built once per conversation per frame and shared by all of that conversation's avatars.

## The renderers

### Phase 2: replaces what exists
- **Glyph**: the current ASCII face. Settings: frames, frame time, idle glances (frames, how often, how long), colour, glow, breathe, bob, droop, shake, pulse, flicker; per pose all but the glances. `rate` speeds up the frames while text streams. Built-in: `ascii_face` (one frame set per pose; the old random choice between several sets per mood is not carried over).
- **Lattice**: `GlitchSkull`. Settings: tick, decay, noise, reach, flex, packets, tear chance and size, net/core/virus colours, core frames, state label, name tag, scanlines; per pose all of these except the tag and scanlines. Built-in: `glitch_skull`, with the old per-state table as its poses.
- `ascii_hd` is a Glyph built-in (multi-line skull frames per pose, with pulse, shake and glow), since it is text frames, not a grid. Its old second layer (red eyes pulsing over the angry skull) is not carried over.
- **Picture**: one picture/video as the base, with optional per-pose picture or clip that crossfades. Breathing, a lean toward the pointer from `gaze`, a scale pulse from `rate`, shake/bob/droop and greying from the dials, a mood colour wash from energy and warmth, and a scan line while thinking (a pose setting). This replaces the CSS `MOTION`/`TINT`/`StateFx` path. Saved `file` looks draw through it.

### Phase 4: new
- **Eyes**: two expressive eyes. They follow `gaze`, blink at random intervals, narrow or widen with energy, tilt their lids with warmth, glance up and aside while thinking, and look down while writing. Settings: shape (bar, slit, ring, pixel), spacing, colour, glow, blink rate.
- **Sigil**: concentric rings of glyphs. Idle turns slowly; thinking assembles glyphs into the inner ring; tool spins one ring as a gear; writing pulses outward with `rate`; reactions flare. Settings: ring count, glyph set (runes, braille, katakana, custom), colours, speed.
- **Swarm**: particles forming any picture. It samples the picture's brightness into a point cloud; particles drift with idle, scatter with energy, re-form and shimmer with warmth, and stream outward while writing. Settings: picture, particle count, size, colour mode (picture's own colours / accent), cohesion.
- **Braille portrait**: any picture turned into braille or ASCII, like the Blackwall face, with glitch rows, scan reveal and colour from the theme. Settings: picture, character set, contrast, glitch.

### Later
- **Three.js model**: the renderer contract holds it. `make` builds a scene; `frame` passes signals and mood dials to an animation controller that picks clips and blend weights. Its settings are the model file plus a map of clips to activities and moods. It gets its own plan when you start that work.

## Drawing technology

Canvas 2D through `Animated`, the same as backgrounds. pixi.js is in the project and a renderer may use it (Swarm with many particles would benefit). The choice belongs to that renderer, and nothing generic depends on it.
