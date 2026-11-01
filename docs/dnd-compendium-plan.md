# Plan: D&D compendium

Done (v201); character sheet tie-in done in v202. See HANDOFF, D&D compendium.

Goal: spells, classes, features, races, equipment, conditions and monsters as kinds in Seven, filled from the free SRD, with your own entries and JSON import on top.

## Owned by a D&D module
- A new built-in module `src/modules/dnd/` (module.json, index.ts, prompt.md, help.md) owns everything here: the seven kinds, the compendium store, and the bundled SRD data (`src/modules/dnd/srd/`).
- First, a small piece in the engine: built-in modules can register kinds of their own (`registerKind(kind, moduleId)` in the library), and a module's kinds follow its on/off state, globally in Tools and per agent, like its tools. Off means gone from the Data rail, search, links and agents.
- The module's prompt only mentions spells, monsters and the rest when the module is on for that agent.
- Workout kinds stay where they are for now; they can move onto the same mechanism later.
- The character sheet's D&D tab stays with sheets, since sheets are also used for characters outside D&D.

## Kinds
A **D&D** group in the Data rail with seven kinds: Spells, Classes (with subclasses), Features (class features, racial traits, feats), Races (with subraces), Equipment (gear and magic items), Conditions, Monsters.
They behave like every other kind: list with filter and sort, right-click menus, Copy link (`@spell:fireball`), Reference in chat, tags, search, and agents can find and read them with the tools they already have. No new agent tools.

## Data
- **SRD, read-only, bundled.** A build script (`scripts/srd-import.ts`) turns the open 5e-database JSON (MIT, SRD content under CC-BY-4.0) into one compact file per kind in `src/modules/dnd/srd/`, shipped with the app. Public rules text, so not encrypted and not in your data folder. Each entry: `id`, `name`, `source` ("SRD 5.1" or "SRD 5.2"), the kind's facts, and its text as markdown.
- **Yours, editable.** New and imported entries go in `moduledata/dnd/<kind>.json` through the storage layer (encrypted like everything else). An entry of yours with the same id as an SRD one replaces it, so "edit" on an SRD entry makes your copy.

## Facts per kind (shown as a small table above the text)
- Spell: level, school, casting time, range, components, duration, concentration, ritual, classes.
- Class: hit die, primary ability, saves, armour and weapon proficiencies, subclasses.
- Feature: from (class, subclass, race or feat), level.
- Race: size, speed, ability bonuses, traits.
- Equipment: category, cost, weight, damage or armour class, properties, rarity.
- Condition: text only.
- Monster: size, type, alignment, AC, HP, speed, CR, ability scores, then traits and actions as text.

## Adding and importing
- "New spell" etc. from the kind header, its right-click menu and empty-space menu. One shared editor driven by each kind's fact list (no seven editors), plus a markdown box for the text.
- **Import JSON** on each kind (the existing importer slot): accepts a list in Seven's shape or in 5e-database's shape, detected automatically and mapped by the same code the build script uses. Shows what will be added or replaced before saving.

## Later, separate step
- On the character sheet: spell names suggest from the compendium and fill level and note; features can be picked from the character's class and race.

## Edition
2014 (SRD 5.1).

## Cost
About 22 files (module registration of kinds in the engine, the dnd module with its 7 kinds, a store, the editor, import mapping, build script, docs) plus roughly 4 MB of bundled data.
