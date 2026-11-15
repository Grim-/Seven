# Module Reorganization & Clutter Reduction Changelog

## Overview
As part of the module interconnectivity overhaul, the redundant `worldbuild` module has been merged directly into the `world` module, eliminating an artificial module split that previously existed solely for permission gating.

---

## What Was Changed

### 1. Merged `worldbuild` into `world`
The separate `src/modules/worldbuild` module was completely removed:
- Deleted: `src/modules/worldbuild/index.ts`
- Deleted: `src/modules/worldbuild/module.json`
- Deleted: `src/modules/worldbuild/help.md`
- Deleted: `src/modules/worldbuild/prompt.md`

All authoring and world mutation tools were consolidated into `src/modules/world/index.ts`.

### 2. Consolidated Toolset in `modules/world`
The `world` module now exposes the complete, unified world tool suite:

#### A. Participant / Player Tools
- `world_recall`: Read world records (narrowed by field, query, or sort).
- `world_remember`: Update the agent's own record, lists, logs, and relationships.
- `world_search`: Search records across any field by text.
- `world_post`: Post messages to the shared world bulletin board.
- `world_board`: Read latest board posts with optional search filters.

#### B. Authoring & World Builder Tools (DM / World Architect)
- `world_create`: Create new records with fields and initial values.
- `world_set_property`: Set attributes, descriptions, or status on any world record.
- `world_entries`: Add, edit, remove, or clear list/log entries across any record.
- `world_add_action`: Attach interactive actions with skill/stat checks, narrative outcomes, and card swaps to objects, places, or characters.
- `world_add_decision`: Attach branching decision points with clear options and decider rules (user vs. agent).
- `world_delete`: Delete records (configured with `permission: "ask"` for user safety).

### 3. Updated Module Manifest (`src/modules/world/module.json`)
- Version bumped to `1.1.0`.
- Description expanded to clarify that the module covers both player participation and DM authoring tools.
- Added explicit `toolPermissions`:
  ```json
  "toolPermissions": {
    "world_delete": "ask"
  }
  ```

### 4. Consolidated Documentation (`src/modules/world/help.md`)
Combined agent instructions into a structured guide covering:
- Reading records.
- Writing to own record.
- Board interactions and posting etiquette.
- Authoring and builder commands (with parameter explanations).

---

## Architectural Impact & Benefits

1. **Eliminated Orphan Module Crashes**:
   Previously, `worldbuild` stated in prose that it *"Needs the World module"*. If `world` was disabled in `ToolsView`, `worldbuild` remained active and threw unhandled runtime errors on tool invocation. Merging them removes this failure mode entirely.

2. **Clean Agent Permission Modeling**:
   Agents in Seven already have fine-grained tool controls:
   - Giving an agent the `world` module gives them the world toolset.
   - Player agents can have builder tools disabled via `agent.offTools` or assigned to a `world:player` toolset.
   - Destructive commands like `world_delete` ask the user before execution by default.

3. **Cleaner Module Manager (`ToolsView`)**:
   Users no longer see two separate, confusing modules (`World` and `World builder`) for the exact same underlying system.

---

## Verification
- `npm run typecheck:web` verified clean with **0 errors**.
- All references to `worldbuild` in `src/` verified removed.
