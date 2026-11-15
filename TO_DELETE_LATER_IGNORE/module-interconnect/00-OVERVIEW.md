# Module Interconnectivity, Kinds, and Entity Lifecycles Architecture

## Overview & Why This Must Change

Seven has grown from an exploratory agent harness with isolated data kinds into a live, multi-system RPG simulation engine. Today, modules do not merely add independent CLI tools or isolated lists; they interconnect, enrich, and cross-pollinate shared simulation primitives:
- A **Character Sheet** (`sheet`) is a standalone identity, but can be equipped with stats and ECS components from the `game` module, SRD spells and proficiencies from the `dnd` module, and presence or journeys from the `world` module.
- A **World** (`world`) orchestrates spatial maps and persistent saves, but relies on a `game` RuleSet to govern combat rules, formulas, and checks.
- A **WorldBuilder** (`worldbuild`) empowers agents and DMs to mutate world records and drop encounters onto maps, but is completely inoperative without `world`.
- A **D&D Toolset** (`dnd`) provides compendium reference data and 5e stat calculations, but its monsters and spells are used to populate in-game encounters on world maps.

### Why The Current Model Breaks Down

Despite this deep interconnection, Seven currently has **no formal mechanics for modules to declare dependencies, provide capabilities, or extend kinds**. This architectural vacuum has caused critical structural defects:

1. **Monolithic Data Pollution (The Creature vs. Character Flaw)**:
   The codebase collapsed the distinction between an **ephemeral in-game Creature** and a **permanent Library Character Sheet**. Spawning five wolves or goblins on a map currently invokes `engine('sheets.save')`, writing five permanent character sheets into the user's global library database (`data.pages`). Combat fodder permanently litters the library alongside real player characters and recurring NPCs.
   **Solved by Phases 1 and 2**: creatures live only in `save.creatures`, and spawning never calls `sheets.save`.

2. **Accidental Hardcoded Coupling**:
   Because kinds lack pluggable extension points (facets), sub-systems directly modify core components. `SheetData` hardcodes `dnd: DndStats`, `game: EntityRecord`, `gameRules`, `faction`, and `story`. `SheetEditor.tsx` statically renders `D&D` and `Game` tabs on every character, even if the character is a cyberpunk operative or a pure narrative persona, and regardless of whether the `dnd` module is enabled.
   **Solved by Phase 4A**: each system is a facet that owns its own data key on the sheet and registers its own tab from its own module.

3. **Template vs. Runtime Conflation**:
   Map templates (`map` kind) are meant to be reusable, pristine blueprints. But without clean runtime save isolation, map state, placed tokens, and persistent modifications bleed together.
   **Solved by Phase 1**: every write made during play (token placement, creature state, records) goes through `saves.*` into the active save. Nothing in play writes to a `map` page.

4. **Zero Dependency & Capability Telemetry**:
   `worldbuild` stated in prose in its `module.json` that it *"Needs the World module"*, but machine-readable manifest fields do not exist. If `world` was disabled in the Module Manager, `worldbuild` stayed enabled and crashed on invocation. The UI has no way to warn the user, visualize dependencies, or display what features a module unlocks.
   **The crash is solved by doc 05** (`worldbuild` merged into `world`). The missing contracts and telemetry are solved by Phase 4B.

---

## Core Architectural Invariants

### 1. The 3-Tier State Hierarchy

State mutability is partitioned into three discrete layers:

```
+─────────────────────────────────────────────────────────────────────────────+
| 1. TEMPLATE TIER (Global Library - Immutable during play)                   |
|    - Map Templates (`map`): Raw tile geometry, default props, colliders.     |
|    - Bestiaries (`dnd` compendium & `game` defs): Monster stat blocks.      |
|    - Characters (`sheet`): Permanent cast members in the library.           |
+─────────────────────────────────────────────────────────────────────────────+
                                       │ Instantiated into
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| 2. WORLD TIER (Setting Definition - The Campaign Container)                 |
|    - World Schema: Custom record types, factions, lore entities.            |
|    - Map Usage (`WorldMapUse`): Which maps belong to this world.            |
|    - Default RuleSet: Which game mechanics rule this world (`rules`).       |
+─────────────────────────────────────────────────────────────────────────────+
                                       │ Played via
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
| 3. SAVE TIER (Live Runtime Simulation - 100% Mutable Reality)               |
|    - `save.characters`: Visiting party members/VIPs (linked to `@sheet:...`)|
|    - `save.creatures`: In-game monsters and NPCs living ONLY in this save.  |
|    - Dynamic State: Current HP, token coordinates, turn order, dropped loot.|
+─────────────────────────────────────────────────────────────────────────────+
```

### 2. Creature vs. Character Distinction

| Attribute | Game Creature (`Creature`) | Character Sheet (`sheet`) |
| :--- | :--- | :--- |
| **Lifecycle** | **Ephemeral runtime entity**: lives only in active save state (`save.creatures`). | **Permanent cast member**: lives in the library (`data.pages`). |
| **Visibility** | **Play View only**: has no standalone page in data explorer. | **Standalone Kind**: inspectable anywhere in Seven. |
| **Agent Binding** | Controlled by the simulation, AI combat state, or DM. | **Wearable by Agents**: an AI agent can inhabit and roleplay it. |
| **Source** | Spawned from **blueprints** (D&D 5E SRD, Game templates). | Created manually or **promoted from an in-game creature**. |
| **Cross-World** | Cannot leave the world save where it was instantiated. | Can travel between worlds, join parties, and retain state. |

---

## Master Implementation Plan

The overhaul has four phases plus one completed change. Phase 4 is split into two parts because its sheet facets must exist before promotion writes to sheets.

**Execution order: 1 → 2 → 4A → 3 → 4B.**

1. **[Phase 1: Save-Level Creature Decoupling](./01-SAVE-LEVEL-CREATURE-DECOUPLING.md)**:
   Decouple map tokens and save state so runtime simulation creatures live in `save.creatures` as ECS entities without touching library character sheets. Map tokens resolve through self-registering token sources.

2. **[Phase 2: Unified Spawner UX & Blueprint Ingestion](./02-UNIFIED-SPAWNER-AND-BLUEPRINT-PIPELINE.md)**:
   Build a clean, CRPG-native spawner separating `[PARTY & CAST]` from `[BESTIARY & NPCS]`, compiling external blueprints (D&D SRD or Game defs) directly into runtime creatures.

3. **[Phase 4A: Sheet Facets](./04-MODULE-CONTRACTS-KIND-FACETS-AND-TELEMETRY.md#phase-4a-sheet-facets)**:
   Split the Character Sheet into a core plus facets that each own their data key and tab. **Must land before Phase 3**, otherwise promotion writes into the hardcoded `game` / `gameRules` fields and locks the monolith in.

4. **[Phase 3: The Creature Promotion Pipeline](./03-CREATURE-PROMOTION-PIPELINE.md)**:
   Implement the `[PROMOTE TO CHARACTER]` bridge, allowing in-game creatures to be factually promoted to permanent library sheets with zero fabricated fluff. Writes the creature's stats through the game facet.

5. **[Phase 4B: Module Dependencies & Telemetry](./04-MODULE-CONTRACTS-KIND-FACETS-AND-TELEMETRY.md#phase-4b-module-dependencies--telemetry)**:
   Add `dependencies` to module manifests, and derive what each module provides and extends from what it actually registers.

**Completed:** [Module Reorganization Changelog](./05-MODULE-REORGANIZATION-CHANGELOG.md) records the merge of `worldbuild` into a unified `world` module.

---

## Problems This Plan Does Not Solve

- **Creature sheets already in the library stay there.** Earlier spawns wrote real `sheet` pages. Rewriting or deleting stored pages automatically is not allowed, so the plan leaves them alone. The user deletes them by hand from the Character Library.
- **Existing sheet data is not moved.** Facets claim the keys that already exist on stored sheets (`dnd`, `game`, `gameRules`, `faction`, `story`) rather than migrating them into a new structure. Old sheets keep working unchanged, but those keys stay top-level for good.
- **No current module needs `dependencies`.** After the `worldbuild` merge, no built-in module depends on another, so Phase 4B ships the mechanism for add-on modules without a built-in user.
