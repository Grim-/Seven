# Part 2.1: component base and entities

Built in `shared/game/core/` (typechecked, and run in a test: spawn, interval ticks, signals, save and restore). Structure from vpet's `Component.js`; designed for Seven.

## Templates
- A template is a kind record (a Skeleton, a Health Potion, Poisoned, Fireball). It holds `components`: a list of `{ type, ...params }`.
- **Templates are only edited, never played.** Changing a template changes instances made after it, not ones already in a save.

## Component types
- Each type is a class in its own file under `shared/game/components/`, registered with `registerComponent(Class)`.
- The class says:
  - `type`: its id, e.g. `health`;
  - `DESCRIPTION`;
  - `PARAMS`: its fields, each with a kind (number, text, choice, formula, template reference, list), default, min, max, choices and description;
  - `canApply(host)`: `true`, or why it can't go there (e.g. a buff piece only inside a buff).
- `PARAMS` drives the template editor, validation, and the agent's tool schemas. No hand-written forms per type.

## Component instance
```ts
abstract class Component {
  uid: string
  params: Record<string, unknown>
  parent: Component | null
  comps: Component[]
  get entity(): GameEntity
  comp<T>(Type): T | null
  add(comp) / remove(comp)
  onApplied() / onRemoved()
  bind(source, signal, fn) / emit(signal, payload)
  tickSim()
  repeatEvery(seconds, fn)
  modifyStat(domain, key, value): number
  modifyStatLate(domain, key, value): number
  toJSON(): ComponentRecord
  fromJSON(record)
  sheet(ctx) / tooltipRows(ctx)
}
```
- Comps hold comps: a buff holds buff pieces, an ability holds ability pieces, an item holds item pieces.
- Signals are named strings (`OnHurt`, `OnDeath`, `OnUse`, ...). Pieces bind to them from data (`on`) and emit the next one.
- Bindings are dropped on `onRemoved`.

## Entities (instances)
- `GameEntity`: a `uid`, its template reference (kind and id), a name, its components, and a signal bus.
- **`spawn(template, at)`** builds the components from the template's list and runs `onApplied`. Every entity is spawned the same way; there are no entity classes.
- **Saving:** an entity saves `{ uid, template, name, comps: [toJSON of each, nested] }`. Each component saves everything it needs. Loading rebuilds from the record, not the template.
- **Randomness** is seeded from the entity uid; world rolls use the save's seed.

## Where instances live
- Characters: in the save they are in (one at a time), or on their sheet while they are in none. See `9-saves-and-time.md`.
- Everything else (monsters, NPCs, dropped items): in the world's named save, with its state.
- Another skeleton is another `spawn`. Nothing is duplicated between saves.

## Files
- `shared/game/core/`: `Component.ts`, `GameEntity.ts`, `registry.ts`, `params.ts` (the `PARAMS` field kinds and validation), `signals.ts`, `rng.ts`.
- `shared/game/components/`: one file per component type, added from part 2.2 on (stats, resources and health next).

## Characters and creatures
- **A character's sheet is the character:** who they are, and which save they are in. They are in one save at a time and their game state lives there; it is on the sheet only while they are in no save. They are gone when the sheet is deleted.
- **Creatures are templates:** each one placed in a world is a new instance, saved in that world's save. As many of each as wanted.
