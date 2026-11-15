# Part 2.4: abilities and spells

Built in `shared/game/components/` (typechecked; a test cast a fireball: mana cost, cooldown, a seeded `2d6 + user.int` fire hit chained into a burning buff, then refused for cooldown and for mana, and saved its uses).

- **`abilities`:** the spell book on the entity. It holds the abilities it knows, with `find(id)`.
- **`ability`:** `id`, `label`, `cost` (resource stat to amount), `cooldown` (seconds), `range` (ft), `action` (`action`, `bonus` or `free` in a battle turn), and for abilities inside an item: `weaponRange` (use the item's weapon reach), `itemCost` (item resource id to amount, from that item) and `uses` (items used up from the inventory, e.g. an arrow).
  - An ability lives in the spell book (`abilities`) or inside an item. One inside an item belongs to that item instance, so its cooldown goes with the item; it can be used while the item is worn, or carried if the item's `grantsWhen` is `carried` (`available()`).
  - `usableAbilities(entity)` lists every ability the entity can use now: its spell book and what its items give. `reach()` is its range.
  - `canUse(ctx)` gives the reason it can't be used: not worn, cooldown, range, resources, item resources, items to use up, or any piece's own check.
  - `use(ctx)` pays all its costs, starts the cooldown, signals `OnCast` on the user, and sends `OnUse` to its pieces.
  - `score(ctx)` adds up its pieces' scores, for enemy AI.
  - It saves its cooldown and use count.
- **`ActionPiece`** (in `Action.ts`, shared by abilities, items and reactions): each piece runs on the event in its `on` (default `OnUse`) and sends its `emit` event to the next pieces, so they chain.
  - `value(formula, event)` reads `user.<stat>`, `target.<stat>` and `distance`.
  - Dice are seeded from the user's uid, the ability's use count and the piece, so the same save always rolls the same.
- **Pieces so far:**
  - `action.damage`: amount formula and damage type, through `Health.damage` with the user as source.
  - `action.heal`: amount formula.
  - `action.applyBuff`: a buff template by id from the catalog.
  - `action.chance`: percent formula; it sends `emit` on success, `onFail` on failure.
  - `action.weaponHit`: hits with the weapon the ability is inside (its damage and type), `times` hits (a burst) plus a `bonus` formula, each hit seeded on its own and sending `OnHit` to the item.
  - `action.refill`: fills an item resource on the ability's item with items from the inventory (`resource`, `item`, `perItem`), e.g. Reload.
  - Each piece gives tooltip rows (Damage, Heals, Applies, Chance, Hits, Refills), shown in the game screens.
- **`UseContext`:** user, target, point and distance. Picking targets in an area waits for movement and positions (part 3).
- **The catalog now has `template(kind, id)`** for buffs and other templates.
