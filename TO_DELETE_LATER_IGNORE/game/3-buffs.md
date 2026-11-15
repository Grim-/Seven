# Part 2.3: buffs

Built in `shared/game/components/` (typechecked; a test stacked poison, ran damage over time every 6 s, added a stat bonus, expired the poison, and saved and restored mid-way).

- **`buffs`:** on the entity. It holds the active buffs, ticks them, and removes them when they end (`OnBuffApplied`, `OnBuffStacked`, `OnBuffRemoved`).
  - `apply(def, source, key)` makes a buff from data.
  - The same buff `id` from the same source (or the same `key`) adds a stack, up to `maxStacks`, and restarts its duration.
- **`buff`:** `id`, `duration` (seconds, 0 lasts until removed), `potency` and `maxStacks`. Its state (source, key, stacks, elapsed, remaining) is saved.
  - Strength is potency × stacks.
  - It ends when time runs out, or when all its limited pieces are done.
  - It only goes inside `buffs`.
- **`BuffPiece`:** the base for buff pieces. It only goes inside a buff, and has `strength`, `isDone`, `onEnd`, plus everything `Component` has (`tickSim`, `repeatEvery`, `modifyStat`, `bind`).
- **Pieces so far:**
  - `buff.damageOverTime`: damage type, per hit (0 uses strength), `every` seconds, scaling stat. It's continuous damage through `Health.damage`, credited to the source when the world can find it.
  - `buff.statBonus`: stat or resist, plus `amount` × strength.
- **`GameEntity.world`:** how pieces find other entities by uid. The save or world sets it.
- **Open:** whether a re-applied buff should only refresh, stack, or run separately is fixed at "add a stack and refresh" for now.
