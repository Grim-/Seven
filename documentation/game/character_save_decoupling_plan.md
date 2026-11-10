# Complete Decoupling Plan: World Editor, Character Sheets, and Game Saves

## 1. Executive Summary & Core Mandate

The World Editor and Map Editor are authoring tools for constructing adventure blueprints. They are not game runtimes.

### Core Architectural Invariant
- **Authoring Mode (Map Editor & World Editor)**: Modifies only template assets (`maps`, `worlds`, `use.stand`, `world.player`, `world.places`, `factions`). It must **never** call `saves.bring`, invoke `takeOut`, write to `CharacterSheet.save`, or auto-generate save files.
- **Runtime Simulation Mode (Play View & Game Saves)**: When a player clicks "Start New Adventure" in Play mode, the engine creates an isolated `GameSave` that copies the world template's standing tokens and player into a runtime session. Runtime actions, combat HP changes, and movement only mutate the save session.

---

## 2. Root Cause Analysis: How the Contamination Occurred

### The Mechanism
In Seven, character sheets possess an active save pointer:
`sheet.save: string` (identifies which runtime save file currently holds the character).

When an entity is brought into a save via `engine('saves.bring')` (`src/engine/worlds/party.ts`):
```typescript
export function bring(id: string, sheet: string, where = ''): GameSave {
  const save = saves.get(id)
  const s = getSheet(sheet)
  if (s.save === id) return save
  if (s.save) takeOut(s.id) // Strips character out of their current save file
  ...
  setSheetSave(s.id, id)    // Mutates CharacterSheet.save
}
```

### The 5 Contaminated Editor Call-Sites
A helper function called `bringHere(...)` in `src/renderer/src/components/play/bringHere.ts` was written for runtime gameplay. It calls `saves.current` (which previously auto-created ghost saves) and `saves.bring` (which invokes `takeOut` and rewrites `sheet.save`).

This runtime function was incorrectly imported into World Editor authoring components:

1. **`src/renderer/src/components/maps/useMapTokens.tsx` (Lines 170-179)**:
   - In `putHere`: when the user clicked "Put a character here" on the Map Canvas in World Editor, it called `await bringHere(world, hit.id)`.
   - **Consequence**: Placing a character token on a world map stripped that character from their existing save file and bound them to a ghost save.
2. **`src/renderer/src/components/worlds/AddWorldCharacterModal.tsx` (Lines 94 & 123)**:
   - When spawning a monster template or adding a library sheet to the world roster, it called `await bringHere(world.id, newSheet.id)` and `await bringHere(world.id, sheetId)`.
   - **Consequence**: Simply adding a creature or companion to a world template corrupted their save pointer.
3. **`src/renderer/src/components/maps/PlaceCard.tsx` (Line 68)**:
   - In the Place inspector, clicking "Put a character here" called `bringHere(world, hit.id)`.
   - **Consequence**: Associating an NPC with a place zone stripped them from their game saves.
4. **`src/renderer/src/components/maps/QuickCreatureSpawner.tsx` (Line 68)**:
   - Spawning a creature template onto the canvas called `await bringHere(worldId, sheet.id)`.
   - **Consequence**: Spawning a monster template corrupted save state.
5. **`src/renderer/src/components/worlds/Worlds.tsx` (Line 215)**:
   - In `onStart`, clicking "Start Here" invoked `bringHere(world.id, player)`.
   - **Consequence**: Assigning a starting place stripped the player from existing saves.

---

## 3. Four-Tier Architecture & Boundaries

```
+---------------------------------------------------------------------------------------+
| TIER 1: CHARACTER SHEETS (Library Assets)                                             |
| - Defined independently in the Library.                                               |
| - [sheet]: Persona, voice, dialogue context (injected into Agent system prompts).     |
| - [dnd]: Numerical stats, HP, AC, ability checks (evaluated by combat engine).        |
| - [story]: Episodic memory, recent decisions, location (retrieved by Agent).          |
| - [cards] & [game]: Ability decks and custom system data.                             |
| - Invariant: Reusable across multiple worlds. Never tied permanently to any world.    |
+---------------------------------------------------------------------------------------+
                                     |
                                     v Referenced by ID
+---------------------------------------------------------------------------------------+
| TIER 2: MAP EDITOR (Spatial Layout Assets)                                            |
| - Standalone canvas: grid, terrain tiles, visual layers, walls, collision.            |
| - Object layers: interactive props with local trigger DCs (chest, lever, door).       |
| - Zones & Shapes: raw bounding polygons/rectangles.                                   |
| - Invariant: Zero character data, zero save awareness. Reusable in multiple worlds.   |
+---------------------------------------------------------------------------------------+
                                     |
                                     v Linked by ID
+---------------------------------------------------------------------------------------+
| TIER 3: WORLD EDITOR (Adventure Template Blueprint)                                   |
| - Links authored maps together.                                                       |
| - Promotes map shapes into named Places (e.g. Antechamber, Throne Room).              |
| - Sets faction standings (Player, Neutral, Hostile).                                  |
| - Sets active player character: world.player = sheetId                                |
| - Sets standing NPC tokens: use.stand[sheetId] = { at: Point, actions, decisions }    |
| - Invariant: PURE TEMPLATE AUTHORING. NEVER CALLS saves.bring. ZERO SAVE MUTATIONS.   |
+---------------------------------------------------------------------------------------+
                                     |
                                     v Cloned into fresh session on "Start New Adventure"
+---------------------------------------------------------------------------------------+
| TIER 4: PLAY VIEW & GAME SAVES (Runtime Simulation)                                   |
| - Isolated session container: GameSave (characters, inventory, active battle state).  |
| - Initialized via createNewWorldSave(world, name).                                    |
| - Agents act as characters or NPCs using partitioned Sheet + Story episodic context.  |
| - Invariant: Mutations stay inside the save session. World templates remain pristine. |
+---------------------------------------------------------------------------------------+
```

---

## 4. File-by-File Remediation Plan

### Remediation 1: `src/renderer/src/components/maps/useMapTokens.tsx`
- **Location**: Lines 170-179 in `putHere`.
- **Diagnosis**: Currently unconditionally calls `bringHere(world, hit.id)`.
- **Change**:
  - `useMapTokens` already receives `editing: boolean` in its options.
  - When `editing === true` (World Editor mode):
    - Do **not** call `bringHere`.
    - Directly update `use.stand`:
      ```typescript
      setStanding(hit.id, { ...(use.stand[hit.id] ?? NONE), at })
      settle(hit.id, at)
      ```
  - When `editing === false` (Play mode):
    - Call `bringHere(world, hit.id)` as part of active session token movement.

### Remediation 2: `src/renderer/src/components/worlds/AddWorldCharacterModal.tsx`
- **Location**: Lines 94 & 123.
- **Diagnosis**: Imports and calls `bringHere` when spawning a creature or adding an existing library sheet to the world.
- **Change**:
  - Remove `import { bringHere } from '../play/bringHere'`.
  - In `handleSpawnCreature`:
    - Remove `await bringHere(world.id, newSheet.id)`.
    - Save sheet with `engine('sheets.save', sheetInput)`.
    - Assign to `targetUse.stand` via `engine('worlds.saveMapUse', ...)`.
  - In `handleAddLibrarySheet`:
    - Remove `const ok = await bringHere(world.id, sheetId)`.
    - Directly assign `sheetId` to `targetUse.stand`.

### Remediation 3: `src/renderer/src/components/maps/PlaceCard.tsx`
- **Location**: Line 68.
- **Diagnosis**: Calls `bringHere(world, hit.id)` when adding a character to a place in the Place inspector.
- **Change**:
  - Remove `import { bringHere } from '../play/bringHere'`.
  - Calling "Put a character here" in PlaceCard only updates the place reference via `setWhere(hit.id, placeKey)`.
  - Update empty state label from `"Nobody in this save is here."` to `"Nobody is stationed here."` to eliminate save-mode confusion in the editor.

### Remediation 4: `src/renderer/src/components/maps/QuickCreatureSpawner.tsx`
- **Location**: Line 68.
- **Diagnosis**: Calls `await bringHere(worldId, sheet.id)`.
- **Change**:
  - Remove `import { bringHere } from '../play/bringHere'`.
  - Remove line 68. The spawner simply saves the character sheet via `engine('sheets.save', input)` and calls `onSpawn(sheet.id)`. The caller (`useMapTokens` or parent) assigns the token to `use.stand`.

### Remediation 5: `src/renderer/src/components/worlds/Worlds.tsx`
- **Location**: Lines 212-225 in `onStart`.
- **Diagnosis**: Calls `bringHere(world.id, player)` when setting a starting place.
- **Change**:
  - Remove `import { bringHere } from '../play/bringHere'`.
  - Set starting place on the world template (or via `setWhere(player, place)`) and transition to Play mode without invoking `bringHere`.

### Remediation 6: Enforce Runtime Scoping on `bringHere.ts`
- **Location**: `src/renderer/src/components/play/bringHere.ts`.
- **Diagnosis**: Helper function exists in play folder but was imported by editor files.
- **Change**:
  - Add explicit guard comment and ensure it is never imported outside `src/renderer/src/components/play/`.

---

## 5. Verification & Testing Checklist

1. **Map Editor Verification**:
   - Create a map `Test Vault`.
   - Place an iron chest with an Examine description and DC 12 Lock.
   - Draw two zones: `Foyer` and `Sanctum`.
   - Confirm map saves cleanly with 0 save file interactions.
2. **World Editor Character Assignment**:
   - Create world `Test World` and link `Test Vault`.
   - Verify `Foyer` and `Sanctum` appear in the Places list.
   - Designate `Alistair Finch` as `Active Player`.
   - Place `Alistair Finch` on the canvas at (100, 100).
   - Inspect `Alistair Finch`'s sheet: `sheet.save` must be empty / unchanged.
   - Spawn a `Goblin Sentry` at (300, 200).
   - Inspect `Goblin Sentry`'s sheet: `sheet.save` must be empty / unchanged.
   - Verify **no save files** have been created under `saves.list('Test World')`.
3. **Play Mode Initialization**:
   - Switch to `Play` view.
   - Confirm "Start New Adventure" screen appears.
   - Click "Start New Adventure".
   - Confirm a single save file is created.
   - Confirm `Alistair Finch` is instantiated at (100, 100).
   - Confirm `Goblin Sentry` is instantiated at (300, 200).
   - Confirm chest is present and locked.
4. **World Editor Independence**:
   - Switch back to `World Editor`.
   - Confirm `Alistair Finch` and `Goblin Sentry` are still positioned on the template map at their exact coordinates.
   - Delete the save file in Play view.
   - Return to World Editor: confirm the world template is completely intact and unaffected.
5. **Compilation & Style Compliance**:
   - Run `npm run typecheck:web` to verify 0 TypeScript errors.
   - Ensure 0 emojis and 0 hardcoded colors across all touched files.
