# Game plan: Worlds become a 2D top-down RPG

## Brief

**What I'm going for.** A world is played as a real game: a top-down 2D RPG and virtual tabletop. You click to move a party around a map, walk up to things, talk to NPCs the agent plays, fight turn-based battles, and manage inventory, equipment and spells. The DM agent writes the world: areas, encounters, loot, NPCs and dialogue. Code runs the rules. Play is one screen, shown in Worlds > Play and in a chat's Game Mode. A world is a template you build; each save is a playthrough started from it, with its own characters, and everything that happens is in the save.

**It is a shell, not a setting.** Seven ships the shell of a top-down 2D RPG with a fantasy starter set (stats, damage types, buffs, abilities, items, creatures). None of the starter set is in code. Someone can delete it and make a game with guns, sanity, hunger or anything else by editing data and, at most, adding a type in its own file.

**Absolute requirement: data-oriented and component-based in every part where it is possible.**
- Rules, numbers and content are data: stats, resources, damage types, formulas, clocks, slots, action types, costs, conditions, items, abilities, buffs, creatures, encounters and triggers.
- Behaviour is components and types. Each registers itself from its own file and is configured by data (`PARAMS`). Generic code never names a type, stat, resource, damage type, slot or creature, and never keeps a fixed list of them.
- Maximum configuration: no hidden hard-coded limits or numbers in rules code. Anything a game designer could want to change is a field in data with a default.
- The UI comes from the data: editors from `PARAMS`, panels registered per component type, tooltips from the components.
- The test for every change: could someone add guns, or a weapon with its own abilities, with data and new type files only, without touching generic code?

## Designing for anything: worked examples

These are what the design has to allow. The parts below carry the checklist items that make each one possible.

- **A gun.**
  - A `ballistic` damage type and its resist are definitions.
  - Bullets are an item, stacked in the inventory.
  - The gun is an item with `item.weapon` (hand slots, a range of 150 ft), a magazine (a resource on the item: current and most), and the abilities it grants:
    - Shoot costs 1 from the magazine and deals the weapon's damage;
    - Burst costs 3 and repeats the hit three times;
    - Reload takes Bullets from the inventory into the magazine and uses an action.
  - The muzzle flash, tracer and sound are the abilities' look and sound, chosen from registered effect types.
  - Anything new in code is a new piece type in its own file (for example a cone of fire), never a change to combat.
- **A weapon with its own abilities.**
  - A flaming sword is an item with `item.weapon`, a granted ability Flame Strike (5 Stamina, fire damage, applies Burning) and a reaction on hit.
  - Equipping it adds its abilities to the action bar; taking it off removes them.
  - The abilities belong to the item instance, so their cooldowns and charges go with the sword when it is traded.
- **A new resource, slot or action type** (Sanity, a Back slot, Overwatch): data entries. Screens, bars, costs and checks pick them up without code changes.

## Principles

- **The game is an engine, not React.** A fixed-step loop with managers runs the world and draws it to a WebGL canvas. React only draws UI over it (HUD, panels, screens). Per-frame animation through React re-renders can't stay smooth.
- **Rules are code; the agent only writes content.** Combat, movement, checks, loot and inventory are run by the engine. The agent composes encounters, items, NPCs and areas, and speaks for characters. Code gives the same answer every time.
- **Everything the game uses is library data.** Rules data, templates, triggers and areas are kinds, stored like everything else. The builder, the agent and the game read and write the same records.
- **Kinds and types define themselves.** Each trigger, item piece, effect, creature or encounter type registers, from its own file: its data, its editor, its in-game behaviour, its game UI and its agent tool. Generic code never lists types.
- **Building and playing are separate scenes.** Maps is the builder. Play is the game, with no editor chrome. Both draw with the same engine renderer.
- **Play only ever writes the save.** What was built (the world template), who a character is (the sheet) and the rules (a rule set) are never changed by playing. Everything that happens is in the save, laid over its template when it loads.
- **Narration stays out of the world.** In the world, characters only speak in bubbles above their heads. The DM's narration goes in the chat panel.
- **vpet's structure, not its code.** Seven uses vpet's structure (`stateful-agents/src-ui/src/vpet`): the component base, the tick model, and the buff, ability and item piece pattern. Each piece is designed for Seven. vpet-only systems (genes, parts, life stages, sim grids, breeding) don't come over. vpet's rules hold: components hold their own behaviour, and randomness is seeded.

## Decisions

1. **Renderer:** PixiJS v8.
2. **Movement:** free movement while exploring, only on walkable tiles; a grid in combat; one tile is 5 ft.
3. **Saves:** a save is one playthrough started from a world template, with its own characters. Any number of saves can share a template. Any agent in a chat belonging to the save can be its DM.
4. **Costs:** not a D&D clone. Ability, attack and spell costs are data: Mana by default, or Stamina, HP, several of these, or items used up.
5. **Battle:** a separate screen with an old-school transition.
6. **UI look:** Seven's own UI style for now.
7. **SRD data:** already imported. The kinds are yours and change to fit the game. Seven shows the required CC-BY credit.
8. **Time:** a steady world clock with pause, speed-up and a day-night cycle. One in-game hour is a tick; ticks spend Stamina and restore HP. Battles use turns, not ticks.
9. **Data model:** data first and component based. Characters and creatures share Resources, Stats, Inventory, Equipment, Spell book, Buffs and Resistances. Items, abilities and buffs are data with lists of components; component types register themselves. Damage types are data.
10. **Where things live:** rules in rule sets; who a character is on their sheet; what was built in the world template; everything that happens in play in the save (see Where things live). Creatures are templates; each one placed is a new instance in the save.
11. **Mockups:** the "Seven game screens" designs are the starting point and get revised once there is something to play.
12. **Starter set:** Seven puts in a starter set of rules data and templates; it is data like anything else and can be deleted.
13. **One save at a time:** a character is in at most one save, so the agent and the player never see two of them and nothing is ever copied. Moving to another save (of the same template or another) takes them out of the first.
14. **Leaving is automatic and complete:** when a character leaves a save, by moving, a trigger, or the save being deleted, the save is written without them and their state goes with them (onto the save they join, or onto their sheet if they join none).
15. **Rules per world:** each world template picks a rule set; its saves use it. The rules data lives in rule sets, not in one global list.
16. **Saves are playthroughs, not points in time:** a save is kept up to date as it is played. Going back in time would bring back characters who have since left, so if a way back is added later, it leaves them out.
17. **Play state is in the save:** places' Now text, the card hand, the journey, positions and where each character is all move from the world into the save.

## Where things live

| Layer | Holds | Lives in | Changed by play? |
|---|---|---|---|
| Rule set | stats, damage types, formulas, clocks, checks, templates | the Game module, one folder per rule set | No |
| Character | who they are (name, portrait, bio, personality) and which save they are in; their game state only while they are in no save | the sheet | No; only joining and leaving a save change it |
| World template | what was built: maps, places, triggers, where creatures and NPCs start, encounters, its rule set and tags (fantasy, story-world) | the world | No; only building in Maps changes it |
| Save | everything that happens: clock, flags, used triggers, its characters and their game state, positions, where each character is, places' Now text, the card hand, creatures and their state, dropped items, anything the agent adds during play, the journey | the save, which names its template | Yes |

For example:
- **001 Valerius:** template Elysium (fantasy, story-world), character Valerius, and everything that has happened to him there.
- **002 Emo:** template Elysium, character Emo, and its own history. Neither sees the other.

**Loading a save** loads its template, then lays the save's state over it. Editing the template in Maps therefore reaches every save of it; save data about something deleted from the template is ignored.

**Characters and saves:**
- **Starting a save:** pick a template, name the save, and bring characters. A character in no save brings the game state on their sheet; one never in the game is built from a character template in the template's rule set.
- **In a save:** there is exactly one copy of the character, in that save. Play, and every chat belonging to the save, reads and changes it. Their sheet says which save they are in and shows their game state read only.
- **Moving to another save** (Move, or a "go to another world" trigger): Valerius leaves 001, which is saved without him, and joins 002 with his state as it was. One copy, always.
- **Leaving to nowhere:** a character taken out of a save without joining another carries their state onto their sheet.
- **Deleting a save:** the characters in it leave first, their state onto their sheets.
- **Different rules:** joining a save whose rule set lacks some of their stats, items or components keeps them as they are rather than dropping them, so they work again under rules that have them. Seven lists what doesn't fit when they join.

## Checklist

Details of what is built are in `docs/game/`.

### Part 1: Engine core (`renderer/src/game/`)

- [x] PixiJS v8 renderer that only draws; the loop, managers and state are Seven's own.
- [x] Fixed 60 Hz loop with interpolated drawing, paused while the window is hidden.
- [x] Asset manager: pictures come as bytes from main (`assets.readImage`) and become `ImageBitmap`s, so WebGL needs no CORS; it counts users and frees what's no longer used.
- [x] Scene stack: push, pop, replace.
- [x] Map drawing: tile layers in 32-tile chunks cached to textures at 1:1 with nearest scaling, so tiles don't split at fractional zoom.
- [x] Camera: follows, pans, zooms, stays inside the map.
- [x] Input: click, drag, hover, wheel zoom.
- [x] Event bus between the engine, the React UI and the Seven stores.
- [x] Tweens.
- [x] Theme colours resolved to plain `rgba` before PixiJS sees them (themes use `color-mix`).
- [x] PixiJS's `'unsafe-eval'` in `script-src` of the page policy (`src/renderer/index.html`), the same as vpet.
- [x] Place areas in Play: faint fill and 1 px outline, brighter on hover, accent when picked.
- [ ] Keys in Input (moving, hotkeys such as Space to roll in the roll panel).
- [ ] Speech bubbles anchored to entities, queued, then fading out (part 7).
- [ ] Transition scene (map changes and the old-school way into battle; part 9).
- [ ] Audio hook (sound can come later; the hook exists from the start).

### Part 2: Game data model (`shared/game/`)

- [x] 2.1 Component base and entities: one `Component` base with a tree, `canApply`, `onApplied` / `onRemoved`, `bind` / `emit`, `tickSim`, `repeatEvery`, `modifyStat` / `modifyStatLate`, `DESCRIPTION`, `PARAMS`, `toJSON` / `fromJSON`, `sheet` / `tooltipRows`; `GameEntity` and `spawn`; seeded randomness. (`docs/game/1-component-base.md`)
- [x] 2.2 Stats, resources, health and damage: the catalog, data formulas without `eval`, stats with the modify stack, resources with regen, health with death, damage through the `damage` formula and resists. (`2-stats-resources-health.md`)
- [x] 2.3 Buffs: stacking by id and source or key, potency × stacks, duration, damage over time, stat bonus. (`3-buffs.md`)
- [x] 2.4 Abilities and spells: spell book, cost in any resources, cooldown, range, battle action, chained pieces (damage, heal, apply buff, chance), seeded dice, `canUse`, `score`. (`4-abilities.md`)
- [x] 2.5 Items, inventory and gold, equipment with data slots and belt slots from a stat, `item.wear`, `item.weapon`, reactions, conditions (`all`, `any`, `not`, `chance`, `stat`, `is`), `action.kill`. (`5-items-reactions.md`)
- [x] 2.6 World clock and battle time: ticks, speed, pause, catch-up, calendar and daylight, per-unit rates, battle turns advancing `tickSim`. (`6-clock.md`)
- [x] The game screens mocked up in Seven's style: Explore, chat Game Mode shrunk and open, the roll panel, character with equipment, stats and active buffs, inventory, spell book, battle.
- [ ] Conditions `time` and `season`.
- [ ] More action pieces as parts need them: select targets, repeat, spawn, leap, teleport.
- [ ] Re-applying a buff is a setting on the buff (add a stack and refresh, refresh only, or a separate copy). Today it always adds a stack and refreshes.
- [ ] Reaction conditions (`when`) editable in the form.

### Part 3: Party and movement

- [x] 3.1 Click to move: walk grid, A* paths pulled tight into free movement, animated walking, move marker, the camera following near the edge, `arrive`. (`7-movement.md`)
- [x] 3.2 Rules data: the Game module with definition types (stat, damage type, formula, clock) and templates (buff, ability, item, character template, creature), the starter set, characters joining the game from a template, the sheet's Game tab with a panel per component, resource bars on tokens, place rows and Play, and a Game section in what the agent reads about a character. (`8-definitions.md`)
- [x] 3.3 The world clock in Play: ticks run every character in the game on the map, night shading, the clock HUD (time of day, day, pause, speed) and the party HUD (portraits and bars). (`9-saves-and-time.md`)
- [x] HP, Mana and Stamina on sheets (as resources from the character's template).
- [ ] The party: member sheets, a leader, and the party moving as one block.
- [ ] Walk speed from data (the walker's speed stat) instead of 4 tiles a second in the Explore scene.
- [ ] Move the place panel, card hand and journey strip into the game UI.

### Part 4: Triggers and areas

- [x] Named saves in the world: clock, creatures, flags and used triggers; save picker in Play. (`9-saves-and-time.md`)
- [x] The trigger system: data on the map use, types registering themselves, start on walking in or on click, once only, needs an item, needs a flag, sets a flag; drawn in Play; added, edited, sized and deleted from Play's right-click. (`10-triggers.md`)
- [x] Trigger types: note, actions and decisions, give an item, go to another map (with a fade).
- [x] Rolled decisions and checks (against a difficulty, or opposed by a creature) as trigger types, with the game roll panel: who rolls, the dice, bonus, total, result, pass and fail flags, an item to take. Checks are rules data (`check` definitions with dice and bonus formulas). (`10-triggers.md`, `8-definitions.md`)
- [ ] Buffs that change checks (such as rolling twice and keeping the lower while Poisoned), as buff pieces.
- [ ] A place owning its own map: entering it switches maps with a transition, leaving returns to the parent map at the exit.
- [ ] Rest trigger, with rest and recovery rules as data.
- [ ] Placing and shaping triggers in the Maps builder (part 11).

Known gaps, not planned yet:
- Trigger areas show to anyone playing; there is no way to hide them from players.
- A trigger whose type Seven doesn't know is dropped when its map is read.
- Check and rolled-decision rolls aren't seeded from the save.

### Part 5: Where things live

- [x] Rule sets in the Game module: every definition and template belongs to one; new (empty or a copy of another), rename, delete; stored as `moduledata/game/<rule set>/<type>.json`. Library references to a definition name its rule set.
- [x] The starter set becomes the first rule set. The lists already made (`moduledata/game/<type>.json`) are moved into its folder by hand; Seven doesn't convert them.
- [x] A world template picks its rule set and has tags. Its Play, triggers and their editors use only that rule set. (`8-definitions.md`)
- [x] Changing a world's rule set: characters in its saves are read with the world's rules from then on, and anything that doesn't fit is kept.
- [x] Saves as their own list, outside the worlds: name, template, characters, last played. New save, continue, rename, delete; characters are brought in by putting them on the map. Stored as `saves/<save>.json`, naming the template. (`9-saves-and-time.md`)
- [x] Loading a save: the template, then the save's state over it.
- [x] Everything that changes during play moves from the world into the save: characters' game state, standing points, where each character is, records written in play (Now text and what the agent remembers), the journey and the board. The card hand stays with the character's deck, so it goes wherever they go.
- [x] Characters' game state lives in their save; ticks, Take, checks, the party panel and every other change in play write the save.
- [x] The sheet keeps which save the character is in, and their game state only while they are in none; while in a save, the sheet's Game tab says which save and edits the save's copy, with Take out of this save.
- [x] One save at a time: bringing a character into a second save moves them out of the first (after you confirm).
- [x] Move a character to another save: the first is saved without them, the second gets them with their state.
- [x] Take a character out of a save to nowhere: their state goes onto their sheet.
- [x] Deleting a save takes its characters out first, onto their sheets. Deleting a world template says how many saves use it and deletes them the same way.
- [x] Go to another world trigger: names a world template and a map and place on it; on arrival you pick which of its saves to join, or start a new one. (`10-triggers.md`)
- [x] Rules that don't fit on joining: kept, not dropped, and listed for the player. (`8-definitions.md`)
- [x] Chats belong to a save: a chat is tied to the save its world was showing the first time it touched that world, and keeps reading and changing that save after the world switches saves. A character is read from the save they are in, from any chat. (`9-saves-and-time.md`)
- [x] The saves already made under `worlds/<world>/saves/` are test saves; they are deleted by hand, not converted.
- [x] Existing worlds become templates. Their play state (standing points, where everyone is, journeys, the board) moves into a save by a one-off move you run (Bring in the old play state, in Play's save picker), not a converter on load. Now text already in a world stays as the template's.

### Part 6: Items and screens

- [x] The item kind (Item templates) with value, weight, stack size, used up, and pieces.
- [x] Inventory, gold and equipment on sheets, in the Game tab.
- [x] Game UI kit (`renderer/src/game/ui/`): window, panel, bar, item slot, portrait, HUD button and tooltip rows, shared by every game screen.
- [x] Inventory screen: item grid, equip slots, drag and drop, compare (the tooltip shows what is worn in the slots it fits). Items show their initials until items have pictures.
- [x] Character screen: stats, saves, skills, equipment, resources, active buffs.
- [x] Spell book screen.
- [x] Items grant abilities while worn or held: abilities inside an item, shown in the spell book with the item as their source. The action bar comes with combat (Part 9).
- [x] Weapon attacks are abilities the weapon grants, using its damage, type and range (`action.weaponHit`), so swords, bows, guns and magic weapons all go through the same path.
- [x] Resources on an item instance (charges, a magazine, durability), saved with the item (`item.resource`).
- [x] Costs from any resource on the user or on the item used, and items used up from the inventory.
- [x] A refill piece (reloading: items from the inventory into a resource on the item).
- [x] Slots as definitions: id, label, icon, and how many come from a stat.
- [x] No 100 ft cap on weapon range.
- [ ] Shop trigger: buying and selling with gold at the items' value.
- [ ] Loot pop-ups and the pause menu.

### Part 7: Chat Game Mode and the agent

- [ ] Game Mode: a chat view mode where the side panels hide and the Play screen fills the space; the same Play component as Worlds > Play, not a copy.
- [ ] The narration chat floating as a vertical panel on the left with the composer, shrinkable to a strip.
- [ ] `say(character, text)`: a speech bubble over that character in the world.
- [ ] Conversation trigger: walking up to a friendly NPC starts the agent playing them, with bubbles in the world.
- [ ] Game context for the agent: the area, the party and its resources, what's nearby, recent journey entries.
- [ ] Agent tools: create items; give or take items and gold; set an NPC's attitude; change rules data and templates.

### Part 8: Fit the SRD kinds to the game

- [ ] Spells and abilities with resource costs (Mana by default) instead of spell slots.
- [ ] Monsters as creature templates: encounter-ready stat blocks.
- [ ] Equipment as item templates with slots and pieces.
- [ ] The CC-BY credit shown in Seven.

### Part 9: Combat

- [ ] Battle scene, entered through an old-school transition; the world clock stops.
- [ ] Initiative and turns. Each actor's turn advances its own `tickSim` by the round length, so buffs, regen and damage over time run the same as in the world.
- [ ] Action types as definitions (action, bonus, free, reaction, movement, and any others; how many per turn), replacing the fixed choice on abilities and weapons.
- [ ] Hit and miss, armour, saving throws and critical hits as named formulas in data.
- [ ] Targeting types registered from their own files (self, one, radius, cone, line) and chosen by data on the ability.
- [ ] Looks and sounds of abilities and hits as data: effect types (projectile, tracer, slash, burst) registered from their own files.
- [ ] Death, and resources set at the start of a battle as data says.
- [ ] Enemy AI from ability scores: pick a target, move into range, use the best action. Not the agent.
- [ ] Battle UI: turn order bar, action bar, target picking, range and area previews, combat log.
- [ ] Hit flash and floating damage numbers.
- [ ] Encounter kind: creatures, their placement, a loot table and how it starts; creatures placed as instances in the save.
- [ ] Combat trigger.
- [ ] The result (loot, XP, HP left, who fell) to the journey log and the save; the agent can be told how it went.
- [ ] The agent's encounter tool: design an encounter from creatures with its placement.
- [ ] Dice through the existing roll code, so every roll shows the same way; no randomness outside the dice, so rules can be tested.

### Part 10: Agent world building

- [ ] Fill-an-area tool: interactions, NPCs, encounters, loot and a theme.
- [ ] Area themes.
- [ ] Later: generated area maps.

### Part 11: Builder on the engine

- [ ] The Maps editor as an engine scene; the Maps tab and Data view drawn with the engine renderer.
- [ ] Painting walls and walkable areas, feeding the walk grid (today every cell is open).
- [ ] Placing spawns, NPCs, triggers and encounter zones.
- [ ] Play from here.

### Hard-coded today, moving to data

Collected here so none of them is lost; each is also in its part above.

- [ ] Walk speed of 4 tiles a second (Explore scene) → the speed stat (part 3).
- [ ] Night darkness of 55% (Explore scene) → the Clock definition.
- [ ] Clock speeds offered as 1×, 2×, 4×, 8× (`WorldClock`) → the Clock definition.
- [ ] Battle action choice fixed to action, bonus, free → action type definitions (part 9).
- [x] Equipment's default slot list and `belt1..N` naming → slot definitions (part 6).
- [x] Weapon range capped at 100 ft (part 6).
- [ ] Re-applying a buff always stacks and refreshes → a setting on the buff (part 2).

## How the data model fits together

### Templates and instances
- A kind (Skeleton, a Healing draught, Poisoned, Fire Bolt) is a template: it defines the components and their data. Templates are edited, never played.
- Placing or learning one makes an instance with its own uid and component state. Another skeleton is another instance.
- A character exists once: in the save they are in, or on their sheet while they are in none. A placed creature is one instance in one save.

### Components
- Comps hold comps: a buff holds buff pieces, an ability holds action pieces, an item holds item pieces.
- Signals are named strings (`OnHurt`, `OnDeath`, `OnUse`, `OnHit`). Pieces bind to them from data (`on`) and emit the next one, so pieces chain.
- Effects look for the component they need (`comp(Type)`) and do nothing if it isn't there. Nothing requires every target to be hittable.

### Time
- One simulation tick of fixed seconds. Everything that changes over time implements `tickSim()`.
- The world clock turns real time into ticks, with pause, speed, limited catch-up, and units from data. Rates convert per second, minute, hour or day.
- Battle keeps its own time: rounds, initiative, and per turn the action types from data. Ending a turn advances that actor by `roundSeconds / tickSeconds` ticks.

### Stats and resources
- Stats: base values on the instance, plus `modifyStat` / `modifyStatLate` from every component (equipment, buffs, traits), clamped to the stat's limits. Resists are a stat group.
- Resources: one component per resource, its maximum and regen from a stat definition; `get`, `set`, `change`, `spend`.

### Damage
- Damage types are data: which resist reduces each one and which stat scales it.
- `Health.damage(amount, hit)` resolves the amount through the `damage` formula in data, takes it from health, signals `OnHealthLost` and `OnHurt` on the target and `OnDamageDealt` on the source, and kills at zero (`OnDeath`).
- A skeleton taking double radiant damage is its radiant resist in data. A skeleton dying to any holy hit is a reaction on it, bound to `OnHurt` with a condition on the damage type, that kills it. No special case anywhere.

### Abilities, items and equipment
- An ability or item is an `Action` holding action pieces bound to events; values are data formulas reading the user, the target and the distance.
- Equipment pieces change stats through `modifyStat` while worn; weapon pieces give range, damage formula and type, and send `OnHit`.
- Costs are any resources (and, once part 6 is done, resources on the item and items used up).

### Conditions
- Conditions are data registered by type, used by pieces, reactions and triggers.

### Where the code lives
- `shared/game/`: base classes, registries, the clock, damage flow, formulas, definitions, templates, saves and triggers; used by the engine, the agent's tools and the builder.
- One file per component, piece, definition type and trigger type, each registering itself.
- `renderer/src/components/game/` and `renderer/src/components/play/`: editors, panels, HUD and trigger UIs, each registered per type.
