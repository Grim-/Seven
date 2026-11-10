# Seven 2D RPG Framework: Architecture, End-to-End Flow & Character Systems

## 1. System Vision & Purpose

Seven integrates a 2D top-down tabletop RPG framework directly into its local AI agent harness.

The framework enables users to author custom virtual tabletop worlds:
- Author maps with terrain, interactive objects, and zones.
- Assemble worlds with factions, places, triggers, and standing characters.
- Roleplay and simulate encounters where AI agents control characters with targeted persona and episodic memory, without overloading context windows with global state.
- Experience a clean separation between **Authoring Mode** (Map Editor and World Editor) and **Runtime Simulation** (Play Mode and Saves).

---

## 2. End-to-End User Flow

The progression from authoring to live gameplay follows three distinct phases:

```
+------------------+       +-------------------+       +--------------------+
|    MAP EDITOR    |  -->  |   WORLD EDITOR    |  -->  |     PLAY VIEW      |
| Spatial Layout & |       | World Assembly &  |       | Active Simulation, |
| Object Triggers  |       | Narrative Setup   |       | Dialogue & Combat  |
+------------------+       +-------------------+       +--------------------+
```

### Phase 1: Map Editor (Spatial Layout & Interactive Geometry)
The Map Editor is a standalone tool for authoring physical environments. It is agnostic of world narrative, global factions, and game saves.

1. **Create Map & Canvas**:
   - The user opens `Map Editor` and creates a map record (e.g., `Dungeon Entrance`).
   - Sets grid geometry, dimensions, and draws base terrain tiles (floors, walls, water, corridors).
2. **Place Interactive Objects**:
   - The user places prop objects from the library onto object layers (e.g., an iron chest, a locked portcullis, a lever).
   - In the object inspector, the user configures an **Interaction**:
     - **Examine**: Ambient or narrative descriptions shown when the player investigates.
     - **Lock / Pick**: DC (Difficulty Class) checks (e.g., Dexterity / Sleight of Hand DC 14).
     - **Trigger Action**: State changes (e.g., pulling a lever toggles an adjacent portcullis state).
3. **Define Zones & Shapes**:
   - The user draws bounding polygon/box shapes (e.g., `Antechamber`, `Boss Room`, `Trapped Hallway`).
   - These zones demarcate physical spaces that are later promoted to named Places in the World Editor.
4. **Save Spatial Asset**:
   - The map is saved as a reusable asset in the library.

---

### Phase 2: World Editor (Narrative Assembly & Template Setup)
The World Editor links maps, places, factions, and characters into an adventure template. **The World Editor is an authoring tool; it never writes to, creates, or modifies save files.**

1. **Create World**:
   - The user opens `World Editor` and creates a world record (e.g., `Elysium`).
   - Assigns a ruleset schema (e.g., `D&D 5e` / `Starter Rules`).
2. **Assign Maps & Register Places**:
   - The user assigns the authored map (`Dungeon Entrance`) to the world.
   - The engine registers all drawn map shapes as world **Places** (e.g., `Antechamber` becomes an accessible place entity in the world hierarchy).
3. **Establish Factions & Standings**:
   - Factions are configured with default relations:
     - `Player & Companions` (Friendly to player).
     - `Townsfolk / Merchants` (Neutral, open to dialogue and trade).
     - `Dungeon Denizens` (Hostile, attacks on sight or requires stealth).
4. **Assign Standing Characters & Spawns**:
   - **Player Character**: The user designates an existing Character Sheet from the library as `Active Player` (e.g., `Alistair Finch`). This sets `world.player = sheetId`.
   - **NPCs & Monsters**: The user places character sheets onto specific map coordinates or places (e.g., `Wandering Merchant` in the `Antechamber`, `Goblin Sentry` in the `Trapped Hallway`).
   - Placed tokens are stored in the world template configuration (`use.stand[sheetId] = { at: { x, y } }`).
   - **Critical Invariant**: Placing a character here records their initial blueprint spawn position. It does not touch `CharacterSheet.save` or call any save APIs.

---

### Phase 3: Play View (Active Simulation, Agent Dialogue & Combat)
The Play View is the live runtime session.

1. **Adventure Initialization**:
   - The user navigates to the main `Play` view.
   - If no campaign save exists for this world, the UI presents a **"Start New Adventure"** prompt.
   - Clicking Start New Adventure initializes an isolated `GameSave`:
     - Spawns the player token at the designated start position.
     - Instantiates all standing NPC tokens defined in the world template.
     - Copies initial object states (e.g., chest is closed, door is locked).
     - The world template in World Editor remains completely unmodified.
2. **World Exploration & Prop Interaction**:
   - The player moves their character token across the 2D grid.
   - Approaching the iron chest highlights the interaction prompt.
   - Clicking `Pick Lock` invokes a deterministic skill check against the character's Dexterity modifier from their sheet. A roll window resolves `d20 + modifier >= 14`.
   - On success, the chest opens, granting loot to the player's runtime inventory.
3. **NPC Dialogue (Via Seven Agent Harness)**:
   - The player approaches `Wandering Merchant` and triggers dialogue.
   - The chat interface opens, routing to Seven's LLM agent.
   - The agent harness injects:
     - The merchant's persona details (speech habits, background secrets, motivations from their sheet's `sheet` tab).
     - Episodic memory from the merchant's `story` tab (recent decisions, current location, standing toward the player).
   - The agent acts as the merchant's voice without needing global campaign transcripts.
4. **Combat Encounters**:
   - Approaching the hostile `Goblin Sentry` triggers the tactical turn-based encounter mode.
   - Initiative is rolled using DEX modifiers from the respective character sheets (`dnd` tab).
   - Attacks, spell slots, damage calculation, and condition tracking update the save file's runtime instance, leaving library sheets pristine.

---

## 3. Structural Separation: Map Editor vs. World Editor

| Domain | Map Editor | World Editor |
| :--- | :--- | :--- |
| **Responsibility** | Visual and spatial geometry authoring. | Narrative assembly and campaign configuration. |
| **Scope** | Single canvas: tiles, objects, visual layers, raw shapes. | World system: multiple maps, places, factions, triggers, quests. |
| **Characters** | None. Characters do not belong to map files. | Character sheets assigned to world template spawn coordinates. |
| **Interactions** | Local trigger mechanics (locks, examines, toggles). | World-wide flags, quest milestones, faction standing changes. |
| **Save Awareness** | Zero knowledge of saves. | Blueprint template only. **Zero mutation of runtime saves.** |

### Why This Separation Is Enforced
- **Asset Portability**: A well-crafted map (e.g., `Tavern Interior`) can be referenced by multiple worlds with different NPCs and factions without altering the original geometry.
- **Authoring Safety**: Editing a map's collision or visual tiles never threatens world quest state or character rosters.
- **Save Isolation**: Authoring tools never write to or read from game saves. Saves are ephemeral runtime instances created exclusively in Play mode.

---

## 4. Character Sheet Architecture & Tab Breakdown

A Character Sheet serves dual responsibilities: it is both an agent persona for natural language roleplay and a numerical stat block for deterministic game rules.

To allow rich agentic storytelling without overflowing context windows, character data is partitioned into dedicated tabs:

```
+---------------------------------------------------------------------------------------+
|                                    CHARACTER SHEET                                    |
+-------------------+-------------------+-----------------------+-----------------------+
| [sheet]           | [dnd]             | [story]               | [cards] & [game]      |
| Persona & Voice   | Rules & Mechanics | Memory & Location     | Decks & Custom Schema |
+-------------------+-------------------+-----------------------+-----------------------+
        |                   |                       |                       |
        v                   v                       v                       v
   LLM System Prompt   Combat Engine &         Episodic Memory         Action Cards &
   (Tone, Traits)      Math Evaluator          (Where, Choices)        Custom Rules
```

### 1. `sheet` Tab (Persona & Voice)
- **Primary Consumer**: Seven LLM Agent Harness.
- **Fields**: Name, description, personality traits, speech patterns, ideals, bonds, flaws, secrets.
- **Role**: Injected directly into the LLM system prompt when an agent speaks or makes decisions as this character. It provides the voice, tone, and behavioral boundaries needed for consistent roleplay without cluttering the prompt with mechanical numbers.

### 2. `dnd` Tab (Numerical Mechanics & Combat Engine)
- **Primary Consumer**: Seven Deterministic Game Engine & Roll Evaluator.
- **Fields**: Ability scores (STR, DEX, CON, INT, WIS, CHA), Armor Class, Maximum/Current HP, Speed, Proficiencies, Saving Throws, Conditions (e.g., Poisoned, Prone).
- **Role**: Supplies all numbers required for combat, DC checks, and skill challenges. The LLM is never relied upon for basic arithmetic; the engine evaluates rolls programmatically.

### 3. `story` Tab (Episodic Memory & State Tracking)
- **Primary Consumer**: Long-term Campaign Continuity & Context Injection.
- **Fields**:
  - `where`: Current registered place and world coordinates.
  - Decision logs: Key narrative choices made by or involving this character (e.g., `spared_bandit: true`).
  - Quest chronicles: Discrete narrative bullet points documenting encounters this character participated in.
- **Role**: Allows any agent embodying this character or interacting with them to understand what has transpired recently and where they currently stand, eliminating the need to parse megabytes of raw chat history.

### 4. `cards` & `game` Tabs (Action Decks & Extended Schemas)
- **`cards`**: Action, ability, or spell cards available to the character during encounters and dialogue.
- **`game`**: Extensible key-value storage for custom non-D&D attributes (e.g., stress meters, reputation points, energy pools).

---

## 5. Architectural Invariants

1. **Editors are Templates**: World Editor and Map Editor operate strictly on template data. They never mutate save files.
2. **Saves are Sandboxed**: Starting a game in Play view copies template data into an active `GameSave`. Modifying or deleting saves never affects world templates or library sheets.
3. **Character Pointers**: A character sheet in the library is a shared resource. Dropping a character into a world map assigns a template spawn coordinate in `use.stand`, leaving `sheet.save` untouched.
