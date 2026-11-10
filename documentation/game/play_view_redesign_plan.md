# Play View Redesign & Remediation Plan

## Executive Summary
The Play View currently suffers from severe UX regressions:
1. Floating HUD collisions in the top-center (initiative strip, action economy, roll callout, area narration, and speech bubbles all overlapping at the same coordinates).
2. The player's actual action bar (`ActionBarHud` with spells, weapon attacks, potions, and inventory) is completely unmounted in combat and replaced by a dummy 5-button dock.
3. Fake visual overlays (arbitrary cyan box and circular pixel radius) while the actual turn-based tile grid movement is unenforced, allowing free-roam walking during battle.
4. Hostile monsters trigger peaceful tavern dialogue trees during active combat.
5. Duplicate stat readouts in the top-left crowding the viewport.
6. Disconnected "Arena View" abstraction that yanks the player off the map.

This plan details the step-by-step architectural remediation to align the Play View with Seven's design principles: a clean, tactical, tile-based 2D top-down RPG.

---

## 1. Unified Modern CRPG Action Dock (BG3 / Pathfinder Style)

### Architecture
Instead of stacking two disjointed toolbars on top of each other, merge the HUD into a single cohesive bottom dock inspired by modern CRPGs (Baldur's Gate 3 / Pathfinder Wrath of the Righteous):

```
+-------------------------------------------------------------------------------------------------------------------------+
| [PORTRAIT] | HP: 25/25        | [UTIL] [DASH] [DODGE] [DISENG] [PARLEY] | [1] STRIKE  [2] FIRE BOLT  [3] HEAL  [4] SHIELD | [END TURN] |
| LV 3 (AF)  | [●] [▲] [■] Pips |                                         | +6 1d8+4    120ft 1d10     2d4+2     +5 AC      |  [SPACE]   |
| AC: 15     | MOVE: 30/30 FT   |                                         |                                                    |            |
+-------------------------------------------------------------------------------------------------------------------------+
```

1. **Left Section — Character Telemetry & Resource Pips**:
   - Portrait thumbnail, Level, and AC badge.
   - HP Bar with numeric current/max.
   - **Resource Pips**:
     - Action Pip: Green dot `[●]` (filled when available, hollow when spent).
     - Bonus Action Pip: Orange triangle `[▲]` (filled when available, hollow when spent).
     - Reaction Pip: Purple dot `[■]` (ready vs spent).
   - **Continuous Movement Gauge**:
     - Horizontal gauge displaying remaining movement feet (e.g. `30 / 30 FT`) that drains dynamically as tiles are traversed.
2. **Center-Left Section — Common Universal Actions**:
   - Dash, Dodge, Disengage, and Parley are implemented as **standard ability buttons** (with clear Action / Bonus Action cost tags and tooltips). They reside inside the action bar tray, never in a second floating header.
3. **Center-Right Section — Weapon, Spells & Consumables Hotbar**:
   - Real 1–9 hotbar slots populated from the character sheet and inventory (`useActionSlots`).
   - Weapon strikes, cantrips, slotted spells, and consumables (potions, scrolls, throwables).
4. **Right Section — Compact End Turn Button**:
   - A compact, space-efficient button with `[Space]` keybind badge.

---

## 2. Spatial Discipline & Screen-Bound Anchoring (Zero HUD Collisions)

### Architecture
- **Top Edge (`top-2`) — Initiative Avatar Ribbon**:
  - Pure visual ribbon: sequence of character and enemy avatars in turn order (`[AF (Player)] -> [DW (Wolf Alpha)] -> [LS (Companion)] -> [W2 (Wolf 2)]`).
  - Active combatant pulses with a faction-colored outline (cyan for player party, red for hostiles).
  - Minimal round counter on the left. Zero action economy buttons, end-turn banners, or target frames here.
- **Left Edge — Vertical Allied Party Chain**:
  - Party members are stacked vertically along the left edge (BG3 style).
  - Each companion card shows portrait, level, mini HP bar (numeric cur/max), status pips, and chain link.
  - Clicking any companion portrait switches active control / selects that character.
- **Right Edge — Vertical Hostile / Opponents Stack**:
  - Symmetric counterpart to the party stack on the left edge.
  - Displays all hostile combatants engaged in the encounter (e.g. Dire Wolf Alpha, Timber Wolf 2) with creature name, AC badge, and current/max HP bar.
  - The actively targeted enemy has a high-contrast red outline. Clicking any enemy card or canvas token switches the targeted combatant.
- **Bottom-Right Corner — Compact Combat & Dice Roll Feed**:
  - Positioned below the right-side hostile stack at `bottom-3 right-3`. Pure event roll results (`[Strike] d20(14) + 6 = 20 vs AC 12 -> HIT (7 Slashing)`). Transparent, auto-scrolling, zero clutter.
- **Zero Static Text Fluff**:
  - Remove all fake static text blocks ("Daylight fades...", "Intent: Stalking prey..."). A game HUD is telemetry, buttons, icons, resources, and numbers.

---

## 3. Real Grid-Native Turn-Based Movement

### Problem
`ExploreScene.ts` currently draws an arbitrary cyan rectangle (`drawCombatGrid`) and a smooth pixel circle (`drawMovementRadius`). Clicking the ground lets the player walk anywhere with zero speed restrictions or turn enforcement.

### Solution
- **Purge Cosmetic Overlays:** Delete `drawCombatGrid` and `drawMovementRadius`.
- **Tile-Based Movement Budget:**
  - Map tile dimensions are discrete (`tile.w`, `tile.h`, e.g. 32x32px).
  - 1 tile = 5 feet. A character with 30 ft speed has a budget of `Math.floor(movementRemaining / 5)` tiles (6 tiles).
- **Grid Highlight:**
  - On the active player's turn, calculate reachable tile coordinates via breadth-first search on open walkable tiles up to remaining tile budget.
  - Highlight the exact valid tile squares on the map canvas.
- **Movement Enforcement:**
  - In combat, clicking a tile only triggers movement if:
    1. It is the active player's turn.
    2. The destination tile is within the reachable grid budget.
    3. The path is walkable.
  - Upon arrival, deduct `tilesTraveled * 5` from `battle.economy.movementRemaining`.
  - When `movementRemaining === 0`, tile clicking is disabled until the next turn or Dash.
  - When it is the enemy's turn, all player movement input is strictly blocked.

---

## 4. Context-Aware Interaction & Combat Dialogue Gating

### Problem
Clicking an entity in `WorldPlay.tsx` calls `pickWho`, which unconditionally triggers `useDialogue.getState().startDialogue(...)`. Hostile beasts (like Dire Wolf) pop up an innkeeper chat tree during battle.

### Solution
- **Combat State Gating:**
  - If `inCombat`:
    - Clicking an entity selects them as the `attackTarget` / spell target in `TargetHud`.
    - **Never** fire `startDialogue` on hostile combatants or during battle.
    - Right-click menu on hostile tokens displays combat actions: `Target`, `Attack with [Equipped]`, `Cast Ability`, `Approach (to melee range)`.
  - `PlayerChatOverlay`:
    - Remains minimized during battle.
    - Only opens if the player explicitly selects a social action (e.g. `Parley [Opposed Check]`) or clicks expand.
- **Outside Combat:**
  - Neutral / Friendly NPCs open dialogue on click or talk menu as expected.

---

## 5. Elimination of Top-Left Redundancy

### Problem
The top application bar already displays `alistair_finch / Human Artificer 3, HP 25/25, AC 15`. Immediately underneath, `PartyHud` displays another floating card for the same character.

### Solution
- **Hide Self-Card in `PartyHud`:**
  - When solo or playing as the active character, do not render a duplicate player card.
  - `PartyHud` only renders additional party members / companion tokens if they exist.
- **Dedicated Target HUD:**
  - Positioned cleanly at `left-3 top-3`.
  - Only visible when a target is selected.
  - Displays target name, disposition badge (`HOSTILE` in red), HP bar, AC, distance in feet, and direct action triggers.

---

## 6. Purge Disconnected "Battle Arena View" Mode

### Problem
`CombatTurnHud` offers a `MAP / ARENA` toggle that switches to `BattleArenaView`. Seven is a 2D top-down RPG; tearing the player out of the world map into a disconnected arena contradicts the core product design.

### Solution
- Remove `BattleArenaView` and the `MAP / ARENA` tab toggle.
- 100% of tactical combat occurs on the map canvas on the tile grid.
- Camera automatically frames the active combatants on the map during the encounter.

---

## Implementation Sequence

| Step | Scope | Target Files |
| :--- | :--- | :--- |
| **1** | Unified Combat Action Dock | `src/renderer/src/components/worlds/WorldPlay.tsx`, `src/renderer/src/components/play/hud/ActionBarHud.tsx` |
| **2** | Top-Center De-clutter & Roll Toast | `src/renderer/src/components/play/hud/CombatTurnHud.tsx`, `src/renderer/src/components/play/hud/NarrationOverlay.tsx` |
| **3** | Turn-Based Tile Grid Movement | `src/renderer/src/game/explore/ExploreScene.ts`, `src/shared/game/state/BattleStateMachine.ts` |
| **4** | Context-Aware Interaction & Dialogue Gating | `src/renderer/src/components/worlds/WorldPlay.tsx`, `src/renderer/src/components/maps/useMapTokens.tsx` |
| **5** | Redundant HUD Removal & Clean Target Card | `src/renderer/src/components/play/hud/PartyHud.tsx`, `src/renderer/src/components/play/hud/TargetHud.tsx` |
| **6** | Purge Disconnected Arena View | `src/renderer/src/components/worlds/WorldPlay.tsx`, `src/renderer/src/components/play/battle/` |
| **7** | Typecheck & Visual Verification | Run `npm run typecheck:web` and verify 0 collisions on active map |
