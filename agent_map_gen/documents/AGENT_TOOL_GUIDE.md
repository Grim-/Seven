# End-User Agent Guide: Using agent_map_gen as a Tool

Manual for AI agents (Game Masters, Worldbuilders, and Narrative Directors) using `agent_map_gen` as a tool within an autonomous harness.

---

## 1. Core Mental Model

You do **not** need to calculate tile coordinates, parse 2D arrays, or trace corridor paths. 

`agent_map_gen` transforms complex procedural geometry into high-level, self-describing **Kinds**:
- **`@area`**: High-level zones (e.g. `entrance_antechamber`, `central_plains`, `inner_sanctum`).
- **`@place`**: Action nodes and points of interest inside an area (e.g. `the_village`, `room_1_center`, `room_2_north_alcove`).
- **`@transition`**: Pathways, doors, and trails connecting areas with cardinal directions and distances.
- **`@sheet`**: Character sheets and entity IDs bound to places (e.g. `@sheet:hero`, `@sheet:goblin_guard`).

When an engine or player needs physical coordinates, the library resolves them automatically with guaranteed floor walkability and clearance.

---

## 2. Capability Discovery

Before generating a map, query the library to understand available archetypes.

### Overworld Shapers
```javascript
import { listShaperKinds, describeShaperKind } from 'agent_map_gen';

const shapers = listShaperKinds();

const stampedDescription = describeShaperKind('stamped');
```

Available Shaper Kinds:
- `stamped`: Organic continental landmasses with rivers, elevation, and jagged coastlines.
- `archipelago`: Dispersed islands and coastal atolls separated by shallow and deep water.
- `enclosed`: Volcanic craters, mountain valleys, or canyon basins surrounded by impassable ridges.
- `void`: Shattered asteroids and floating islands floating above an abyss.

### Dungeon Kinds
```javascript
import { listDungeonKinds, describeDungeonKind } from 'agent_map_gen';

const dungeonTypes = listDungeonKinds();

const cryptDescription = describeDungeonKind('crypt');
```

Available Dungeon Kinds:
- `standard`: Balanced halls, guard rooms, armories, and structured rectangular corridors.
- `cavern`: Natural underground caves, winding organic tunnels, stalactites, and irregular grottos.
- `crypt`: Symmetrical burial vaults, ossuaries, sarcophagi alcoves, and branching tombs.
- `labyrinth`: Dense maze-like network of dead ends, narrow passages, and deceptive loops.

---

## 3. Map Generation & Semantic Anchor Extraction

Generating a map is a two-step process:
1. Generate the raw procedural terrain or dungeon.
2. Extract semantic anchors (`discoverAnchors`) to create the agent-facing knowledge graph.

### Generating an Overworld
```javascript
import { generateMap, discoverAnchors, toAgentMarkdown } from 'agent_map_gen';

const worldResult = await generateMap({
  shaper: 'stamped',
  seed: 'campaign_alpha',
  width: 64,
  height: 64
});

const worldGraph = discoverAnchors(worldResult, { name: 'Emos Domain' });
```

### Generating a Dungeon
```javascript
import { generateDungeon, discoverAnchors, toAgentMarkdown } from 'agent_map_gen';

const dungeonResult = await generateDungeon({
  kind: 'crypt',
  seed: 'tomb_of_the_ancients',
  width: 50,
  height: 50
});

const dungeonGraph = discoverAnchors(dungeonResult, { name: 'The Sunken Crypt' });
```

---

## 4. Reading Map State into Your Context

Use `toAgentMarkdown` to inject clean markdown into your context window.

### Full Map Overview
Returns the complete list of areas, key places, entry points, and objectives:
```javascript
const mapSummary = toAgentMarkdown(dungeonGraph);
```

Sample output:
```markdown
# World Map: The Sunken Crypt
Kind: dungeon:crypt | Grid: 50x50
Total Areas: 12 | Total Places: 36
Entry Point: @place:entrance_antechamber_center
Objective / Exit: @place:inner_sanctum_center

## Areas

### @area:entrance_antechamber - Entrance Antechamber [entrance, safe]
Type: entrance | Dimensions: 8x8
Places:
  - @place:entrance_antechamber_center (Entrance Antechamber Center) [entry_portal]
  - @place:entrance_antechamber_north_alcove (Entrance Antechamber North Wall) [alcove]
Exits / Transitions:
  - south -> @area:room_2 via corridor (dist: 5)
```

### Zooming into a Single Area
When the player party moves into an Area, request only that Area's state:
```javascript
const currentScene = toAgentMarkdown(dungeonGraph, { areaId: 'entrance_antechamber' });
```

Sample output:
```text
ENTRANCE ANTECHAMBER
path: Entrance Antechamber world: The Sunken Crypt
files: none
now: nothing happening here

Places:
- @place:entrance_antechamber_center (Entrance Antechamber Center) - entry_portal
- @place:entrance_antechamber_north_alcove (Entrance Antechamber North Wall) - alcove

Exits:
- to @area:room_2 via corridor (south)
```

### Zooming into a Specific Place
When focusing on a single edge node:
```javascript
const placeView = toAgentMarkdown(worldGraph, { placeId: 'the_village' });
```

Sample output:
```text
THE VILLAGE
path: The Village world: Emos Domain files: none
now: characters present here:
@sheet:testmw2cemg3
```

---

## 5. Placing and Moving Characters

Manipulate occupants using high-level identifiers without coordinates.

### Spawning an Actor at a Place
```javascript
dungeonGraph.bindSheet('entrance_antechamber_center', '@sheet:warrior_hero', {
  role: 'player'
});

dungeonGraph.bindSheet('entrance_antechamber_north_alcove', '@sheet:skeletal_sentry', {
  role: 'enemy'
});
```

### Querying Occupants
```javascript
const occupantsAtAltar = dungeonGraph.getOccupants('entrance_antechamber_center');

const allRoomOccupants = dungeonGraph.getOccupants('entrance_antechamber');
```

### Moving an Actor
Binding a sheet to a new place automatically updates its location and removes it from its previous place:
```javascript
dungeonGraph.bindSheet('room_2_center', '@sheet:warrior_hero');
```

---

## 6. Resolving Coordinates for the Game Engine

When your narrative dictates an action or spawn that requires exact pixel/grid coordinates, call `resolveCoordinates`:

```javascript
const spawnLocation = dungeonGraph.resolveCoordinates('entrance_antechamber_center');
```

Output:
```json
{
  "x": 24,
  "y": 18,
  "clearance": 3
}
```

The returned coordinates are guaranteed to be walkable floor tiles away from wall barriers.

---

## 7. Standard Agent Execution Flow

1. **Inspect**: Call `describeDungeonKind` or `describeShaperKind` to choose an appropriate map theme for the player's quest.
2. **Generate**: Call `generateDungeon` or `generateMap` with a seed.
3. **Anchor**: Run `discoverAnchors` on the generated result.
4. **Populate**: Use `bindSheet` to place the player at the entrance place and distribute items/enemies at candidate alcoves.
5. **Narrate**: Retrieve `toAgentMarkdown({ areaId })` for the current zone and narrate the scene, visible places, and available exits to the player.
