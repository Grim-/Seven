# 01 · Model: renderers and avatars

## Two things, not one

| | Renderer | Avatar |
|---|---|---|
| What | Code that draws | Data: a renderer plus its settings |
| How many | A handful | As many as people make |
| Who makes it | Seven or an add-on | You, an agent, or a shared picture |
| Where it lives | Its own file, registers itself | Avatar store, shown as the `avatar` kind |

**Why split them:** almost every "new avatar" anyone wants is a variation of something that already draws: another colour, a different set of faces, more noise, a different picture. If each variation is code, the set stays at three forever. If each variation is data, the studio can edit it, agents can make it, and pictures can carry it. Code is only needed for a genuinely new way of drawing.

## Avatar data

```ts
interface Avatar {
  id: string
  name: string
  description: string
  renderer: string                     // a registered renderer id
  settings: Record<string, SettingValue>
  poses: Record<string, Record<string, SettingValue>>  // overrides per mood or activity, only the ones it wants
  builtin?: boolean
  createdBy?: string | null
  createdAt: number
  updatedAt: number
}
```

- `settings` are checked against the renderer's schema (`03-renderers.md`). Unknown names are dropped, and values are clamped or limited to the schema's choices. This uses the same rule as `cleanEffectSettings`/`effectSettingsFor` today, generalised.
- `poses` holds overrides of the same settings (only those the renderer lists in `poseSettings`) per mood or per activity, e.g. Glyph's frame list for `sad` or for `talking`. **Why:** some renderers are art-driven and need specific art per mood and per activity; the old skull had its own look while thinking and talking. Everything else comes from the mood dials (`02-signals.md`), so `poses` stays optional.
- Which pose shows: a mood that is showing (strength over half, not neutral) uses the override of the **nearest mood by dials** among the moods the avatar has overrides for, with the base settings standing at the neutral point; otherwise the current activity's override if there is one; otherwise the base settings. **Why:** a new mood added later still looks right on every avatar without anyone editing them.

## Store

`engine/avatars/store.ts`, modelled on `engine/themes/store.ts`: one JSON file per avatar in `dataRoot/avatars/`, plus `list`, `find`, `get`, `save` and `remove`.

- Built-in avatars come from their renderer's registration (`03-renderers.md`), not from a list in the store. **Why:** adding a renderer with built-ins then needs no edit anywhere else.
- Built-ins can't be changed. Saving one gives "save a copy under a new name", with the same message pattern themes use.
- The vault lock is handled the same way `ThemeStore.list` handles it.

## The `avatar` kind

Engine `Kind` (registered in `kinds()`):
- `line`/`card`/`full` describe it as text: name, renderer and what it reacts to. Agents can read avatars, but the text never exposes UI detail.
- `search`, `resolve`, `title`, `remove`, `rename` (not for built-ins).
- `pack`/`unpack` via `storePacking`, so an avatar can be saved into a picture and shared. Picture-set and Swarm avatars carry their files through `uses` and the normal file-id swapping.
- `actions`: the avatar tools in `04-editor.md`.

`KindUi` (registered with `registerKindUi`):
- `screen`: the avatar studio (`04-editor.md`).
- `thumb`: the avatar itself, live, at badge size. **Why:** a list of avatars should show them moving, not a still icon.
- `railGroup`: the setup group, next to themes.
- `menu`: Use for agent…, Duplicate, Save into picture.

## Agent look

`AvatarRef` gains one case:

```ts
type AvatarRef =
  | { kind: 'file'; assetId: string }    // unchanged
  | { kind: 'coded'; type: string }      // unchanged, still read
  | { kind: 'avatar'; id: string }       // new, written from now on
```

- **Compatibility without rewriting data:** the three current coded avatars become built-in avatars whose ids are the old type ids: `ascii_face`, `glitch_skull`, `ascii_hd`. A stored `{ kind: 'coded', type: 'glitch_skull' }` resolves to avatar `glitch_skull`. No converter runs over saved agents.
- A stored `{ kind: 'file' }` draws through the Picture renderer with that file. It is still read as before, and the look editor writes the new form when you next change it.
- The resolver lives in one place, `avatarOfRef` in `@shared/avatars` (with `avatarIdOfRef`, `fileOfRef`). It is the only code that reads the three stored ref shapes, because saved agents keep the old shapes and nothing rewrites them. `AgentAvatar` asks it for the avatar and draws the result. It has no branch per renderer.

## What `AgentAvatar` keeps

Bubbles, the character badge and the `title` summary stay as they are. They are about the agent, not the avatar. Only the drawing inside the frame changes, and the frame itself stays Seven's square bordered style.
