# 8. Rules data (game definitions)

The numbers and rules the game runs on are entries you edit, in a built-in module called Game. The catalog the components read (`Catalog`) is built from them.

## Definition types (`shared/game/defs/`)

Each type registers itself from its own file with `registerDefType`: its params (the same `ParamSchema` components use), its starter set, a one-line summary, and `addTo(data, def)`, which puts the entry into the catalog data. Generic code only loops over the registered types.

| Type | File | Becomes |
|---|---|---|
| Stat (`stat`) | `stat.ts` | `StatDef`: group, default, lowest, highest, regeneration per second / minute / hour / day (stored per second), scaled by a stat |
| Damage type (`damage_type`) | `damageType.ts` | `DamageTypeDef`: the resist stat that reduces it, a stat that scales it |
| Formula (`formula`) | `formula.ts` | a named formula, looked up by id |
| Clock (`clock`) | `time.ts` | `TimeDef`: a `ClockConfig` plus the battle round length |
| Check (`check`) | `check.ts` | `CheckDef`: a group, the dice formula and the bonus formula (reading the roller's stats as `user.<stat>`) |

- An entry is `{ id, name, notes, values }`. The id comes from the name the first time and never changes after, so renaming doesn't break anything that refers to it.
- `cleanDef(type, raw)` fixes bad values with the params (a bad number goes back to its default, a choice not in the list goes back to its default).
- `catalogData(defs)` runs every type's `addTo`; `catalogFrom(data)` gives the `Catalog` the components use. `stats()` with no group gives every stat.

## Starter set

Put in the first time each list is read; a list that exists is never refilled, so deleting entries is permanent.

- **Attributes** (group `attribute`, 10, 1 to 30): `str`, `dex`, `con`, `int`, `wis`, `cha`.
- **Resources** (group `resource`; the stat is the maximum): `health` 10, +1 an hour; `stamina` 20, −1 an hour (drains as time passes); `mana` 10, +2 an hour.
- **Combat** (group `combat`): `armour` 10, `speed` 30 ft, `belt` 4 slots, `carry` 90 lb.
- **Resists** (group `resist`, 0, −3 to 1): one per damage type, `<type>_resist`. 0 normal, 0.5 half, 1 immune, −1 double.
- **Damage types**: slashing, piercing, bludgeoning, fire, cold, lightning, thunder, acid, poison, necrotic, radiant, force, psychic; each reduced by its resist, none scaled by a stat.
- **Formula** `damage`: `max(floor * ceil(clamp(1 - resist, 0, 1)), round(power * (1 - resist)))`. A direct hit does at least 1 unless the target is immune; damage over time can do 0.
- **Checks**: the six attributes (group `attribute`) and the 18 SRD skills (group `skill`, each on its attribute), all `1d20` plus `floor((user.<attribute> - 10) / 2)`.
- **Clock** `standard`: a game hour is a real minute at 1×, a tick is an hour, 24-hour days, 0.25× to 8×, at most 24 ticks at once, 6-second battle rounds.

Only the `damage` formula is read by code so far. Other rules (to hit, armour, carry) get their formulas when combat is built.

Tested in isolation: every starter entry cleans, every damage type's resist stat exists, mana regen per second, and a skeleton with radiant −1, piercing 0.5 and poison 1 takes double radiant, half piercing (7 → 4) and no poison.

## The Game module (`modules/game/`)

- **Rule sets:** every definition and template belongs to a rule set, a folder `moduledata/game/<rule set>/` with `rules.json` (name, notes) and one JSON list per type. With no rule set at all, Seven makes **Starter** (`starter`). A missing list in a rule set is filled with that type's starter entries; a new empty rule set writes an empty list for every type, so it stays empty (a type added to Seven later still gets its starters there).
- `store.ts`: `ruleSets`, `ruleSet`, `resolve(wanted)` (the wanted rule set, or the first when it is missing or empty), `saveRuleSet(id, name, notes, copy)` (new, empty or a copy of another; or rename), `removeRuleSet`; per rule set `list`, `get`, `find` (a ref `<rule set>/<id>`, or an id or name looked for in every rule set), `save` (a new entry can't take an existing id; saving with `previousId` keeps the id), `remove`, `catalog(ruleSet)`.
- `worldRules.ts`: `worldRuleSet(world)`; `removeRuleSet` refuses while a world plays by it and names the worlds.
- `kinds.ts`: each type is a library kind in the Game group (find, read, link, show in chat, rename, delete), with ids `<rule set>/<id>`; titles add the rule set's name when there is more than one. **Rule set** (`game_rules`) is a kind too. The agent can read them; it has no tools to change them yet.
- Engine requests: `game.ruleSets`, `game.saveRuleSet`, `game.removeRuleSet`, and `game.list`, `game.get`, `game.save`, `game.remove`, `game.catalog`, each with `ruleSet`; event `game.changed`.
- **Worlds:** each world names its rule set (`worlds.setRules`, the Rules picker beside Your character) and has tags (`worlds.setTags`). A world that names none, or a rule set that's gone, plays by the first rule set.
- **Characters:** joining the game picks a rule set and a character template in it; the sheet keeps the rule set (`gameRules`), and their record is read with it. Until saves hold characters (part 5 of the plan), a character keeps the rules they joined with even in a world that plays by another rule set.
- **Moving your existing lists:** the lists made before rule sets are in `moduledata/game/<type>.json`. Move them into `moduledata/game/starter/` (replacing what Seven put there) to keep your edits; Seven doesn't convert them.

## In the app (`renderer/src/components/game/`)

Each type registers its kind UI in `gameUis.tsx`: a screen to make, edit (autosaved) and delete an entry, with name, id, every param as a field with its description, and notes; a card for chat and boards. `ParamFields` draws the params, each param kind's editor registered in `params/`.

## Templates (`shared/game/defs/templates.ts`)

Templates are definitions too, made of components. Placing or learning one makes a new instance from it; the template never changes.

- **Component templates** have one root component and its pieces: Buff (`game_buff`, root `buff`), Ability (`game_ability`, root `ability`), Item (`game_item`, root `item`). Their fields are the root component's own params (its id and label come from the entry) plus Pieces. `Catalog.template(kind, id)` gives the root `ComponentDef`.
- **Entity templates** are a list of components: Character template (`game_character`) and Creature (`game_creature`). `Catalog.entity(kind, id)` gives a `Template` for `spawn`.
- The kind names start with `game_` so they can't take the name of a type in one of your worlds (a world type called `item` or `creature` would otherwise be renamed `world-item`).
- A components field (`ParamKind` `components`, with `host`) is cleaned with each component's own params, nested pieces included; a type Seven doesn't know is kept as it is. `componentsFor(host)` lists the component types that can go in a host (a component type, or `ENTITY_HOST` for an entity), by asking each one's `canApply`. Resource and Health now only go on an entity.
- Starter: buffs Poisoned (1 poison every 10 minutes for an hour, stacks to 3), Well fed (+2 most Health for 6 hours), Shielded (+2 Armour for a minute); abilities Cure Wounds (4 Mana, 1d8 + 3), Fire Bolt (free, 1d10 fire), Guiding Bolt (4 Mana, 4d6 radiant); items Healing draught (2d4 + 2, used up, stacks to 10), Shortsword, Shortbow, Leather armour (+1 Armour, chest); character template Adventurer (stats, Health, Stamina, Mana, buffs, spell book, 20-stack inventory, equipment with belt slots from Belt slots); creatures Skeleton (radiant and bludgeoning ×2, piercing ×0.5, poison immune, Bone shot) and Wolf (Bite).
- Tested: the Adventurer starts at 10 / 20 / 10; an hour of Poisoned does 6 and Stamina drains 1; a draught heals and uses one up; the Skeleton's Bone shot hurts; Guiding Bolt costs 4 Mana and takes the Skeleton to 0.

## Characters in the game

The sheet is the character: its game record (`EntityRecord`) is saved on the sheet as `game`.

- `game.joinCharacter` builds the record from a character template (resources start full), `game.saveCharacter` saves a changed record (restored with the catalog and written again, so anything bad is dropped), `game.leaveCharacter` removes it. Saving the rest of the sheet never touches it.
- The sheet's **Game** tab (`components/game/character/CharacterGameTab.tsx`): Join the game with a template, then one panel per component in the record. Each component type registers its panel from its own file in `character/panels/` (`registerComponentPanel(type, { Panel, wide })`); `panelFor(comp)` walks up the class chain, so Health uses the Resource panel. A component with no panel shows its tooltip rows.
  - Stats: every stat by group, base value editable, the value now beside it when equipment or buffs change it.
  - Resources (Health, Stamina, Mana): a bar, the current value editable, the most, regeneration an hour.
  - Buffs: name, stacks, time left, remove, add from the Buffs.
  - Spell book: known abilities with cost or cooldown, forget, learn from the Abilities.
  - Inventory: gold, stacks with counts, use, drop one, give from the Items; stacks used and weight.
  - Equipment: every slot (belt slots from the Belt slots stat), put on from what fits in the inventory, take off.
- The sheet's tabs are one list (value, label, body) instead of a chain of checks on the tab name.
- Places send the record with each visitor (`PlaceVisitor.game`). Where a character is in the game, their resource bars replace the D&D HP: on map tokens (one thin bar per resource, stacked), in the character row of a place and in Play's You line. Each bar's colour is the stat's Bar colour (a theme colour: accent, alert, ok, cyan, purple); the starter has Health alert, Stamina ok, Mana purple. `resourcesOf(entity)` gives every resource with its label, current, most and colour.
- What the agent reads about a character gets a Game section: each component's rows (Health 8/10, buffs and time left, items, and so on). The Game module adds it through `registerSheetSection` in `engine/library/sheets.ts`.

## Not done yet

- Reactions' conditions (`when`) can't be edited in the form yet; lists without an item type say so.

## Rolling checks (`shared/game/rules/check.ts`)

- `checkBonus(entity, check)` the bonus now; `rollCheck(entity, check, die)` rolls the dice formula (every die face is kept, so `max(1d20, 1d20)` shows both) and adds the bonus; `die(sides)` is passed in, so tests can fix it.
- `contest(roll, { dc } | { roll })`: meeting a DC passes; against another roll it must be higher.
- `checkText(...)` what a chat is told (CHECK …).
- Tested: 24 starter checks by group; Wisdom 14 gives Perception +2 and 7 gives −2; a fixed die of 13 at −2 totals 11 and passes DC 11, not 12; `max(1d20, 1d20)` keeps the higher of two faces; the Skeleton rolls Stealth; a tie goes to the creature; check and rolled triggers take their defaults and clean bad values.

## Rules that don't fit (`shared/game/defs/misfits.ts`)

- `misfitsOf(record, has)` walks a character's components and lists every id they refer to that a rule set lacks: for each component, every param with a `templateKind` (stats in Stats, resists in Wear, damage types, buffs, items…, in its params and its saved state), the template id of buff, ability and item roots (`templateKindOf(root)`), and component types this Seven doesn't have. Nothing names a component type: it all comes from each component's `PARAMS`.
- `game.misfits(sheet)` checks a character against the rule set they are read with. They keep what doesn't fit: stats keep their base values and items keep their own pieces.
- Tested: an Adventurer fits the starter rules; a Sanity stat and a Laser rifle item are found; empty rules miss stats, items and damage types.
