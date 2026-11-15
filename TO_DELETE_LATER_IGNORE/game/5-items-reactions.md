# Part 2.5: actions, items, equipment, reactions, conditions

Built in `shared/game/` (typechecked). A test ran:
- potions stacking to 5 per stack across slots, with one used up healing 10;
- gold;
- a sword refused for the off hand, then equipped in the main hand, giving +1 AC;
- tool belt slots coming from a stat;
- a holy sword hit killing a skeleton through its reaction;
- saving and restoring what's worn and the gold.

- **`Action` (`components/Action.ts`):** the shared base for anything that runs chained pieces: abilities, items and reactions. It has `fire(signal, ctx)`, its saved use count, and `actionValue` (formulas reading `user.*`, `target.*`, `distance` and event values, with seeded dice).
  - Pieces are `ActionPiece`, renamed from the earlier ability pieces, now `action.damage`, `action.heal`, `action.applyBuff`, `action.chance` and the new `action.kill`. They work in any action.
- **`inventory`:** `slots` (stacks) and gold.
  - `give(def, count)` stacks by item id up to `maxStack` and fills new slots.
  - `take(item, count)` and `changeGold(amount)`.
  - It signals `OnItemGained`, `OnItemLost` and `OnGoldChanged`.
- **`item`:** an `Action` with `id`, `label`, `value`, `weight`, `maxStack`, `usedUp` and `grantsWhen` (`worn` or `carried`: when the abilities inside it can be used). `use(ctx)` runs its `OnUse` pieces, and uses one up if `usedUp`. Its count is saved.
- **`equipment`:** `slots` from data (default head, chest, legs, mainHand, offHand, bag), plus `belt1..N` from `beltStat`.
  - `fitting(item)` the slots an item can go in; `equip(item, slot)` only accepts those, and swaps out what was there.
  - `slotLabel(id)` the words of a slot id (`mainHand` is main hand); slots as definitions with their own labels are still to come.
  - `unequip(slot)` puts it back in the inventory.
  - What's worn is saved.
- **`Wearable`** pieces, inside an item:
  - `item.wear`: the slots it fits, and stat and resist bonuses while worn.
  - `item.weapon`: hand slots, reach in ft (no upper limit), damage formula and type. Its attacks are abilities inside the item with `action.weaponHit` (the starter shortsword and shortbow have Attack); the old `attack()` and the weapon's own `action` are gone.
- **`item.resource`:** a value kept on the one item: charges, a magazine, durability (`id`, `label`, `max`, `startFull`, `regenPerSecond`, `colour`). Saved with the item; spent by `itemCost`, filled by `action.refill`.
- A test built the plan's gun from data alone: a 150 ft pistol with a 6-round magazine; Shoot (1 round, the weapon's damage), Burst (3 rounds, 3 hits) and Reload (bullets from the inventory); its abilities only usable while wielded; out of range at 200 ft; burst refused with 2 left; reload taking 4 bullets; the magazine saved with the gun. The shortsword's Attack reaches 5 ft.
- **`reaction`:** on an entity. It runs its pieces when a signal (default `OnHurt`) arrives and all `when` conditions hold, acting on itself or the source. A skeleton that dies to any Holy damage is `reaction` with `when: [{ type: 'is', field: 'type', value: 'holy' }]` and an `action.kill` piece.
- **Conditions (`core/conditions.ts`):** data conditions registered by type. So far: `all`, `any`, `not`, `chance` (seeded), `stat` (min and max) and `is` (a signal field equals a value).
