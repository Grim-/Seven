# Part 2.2: stats, resources, health, damage

Built in `shared/game/` (typechecked; a test ran stats, resists, mana regen, holy damage through a data formula, death, and save and restore).

- **Catalog** (`core/catalog.ts`): the data the game reads.
  - Stat definitions: id, label, domain such as `stats` or `resists`, default, min, max, regen per second, and the stat that scales regen.
  - Damage types: which resist reduces them, and which source stat scales them.
  - Named formulas.
  - It's passed to `spawn` and `fromRecord`; where it's filled from (kinds) comes later.
- **Formulas** (`core/formula.ts`): data formulas with `+ - * / % ^`, brackets, `min max floor ceil round abs clamp`, named values, and dice (`2d6`, given by the caller). There's no `eval`. Errors name the problem, and `checkFormula` validates a formula for editors.
- **`stats`:** base values per stat id, kept and saved on the instance. Every read runs all components' `modifyStat` and `modifyStatLate`, then clamps to the stat's limits.
- **`resource`:** one component per resource, with `stat` saying which stat gives its maximum and regen. It has `get`, `set`, `change`, `spend`, and regen per tick. `Resource.of(entity, stat)` finds one.
- **`health`:** a resource with death.
  - `damage(amount, hit)` resolves through the `damage` formula in data, using `power`, `resist`, `scalestat` and `floor`. It signals `OnHealthLost` and `OnHurt` on the target, and `OnDamageDealt` on the source.
  - `heal`, `kill` (`OnDeath`) and `revive`. A dead entity doesn't regen.
