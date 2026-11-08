# Developer Agent Onboarding: agent_map_gen

Guide for AI agents tasked with maintaining, improving, or extending the `agent_map_gen` codebase.

---

## 1. Project Mission & Invariants

`agent_map_gen` is a zero-dependency, standalone procedural map and dungeon generation library designed for both human visualization and autonomous AI agent consumption.

### Strict Invariants
1. **Zero Comments in Code**: Do not include single-line (`//`) or multi-line (`/* */`) comments in any `.js`, `.jsx`, or `.ts` file. Code must be self-describing through clean naming and structure.
2. **Read-Only Parent Directory**: Never modify, delete, or touch files in `../` (`vpet`). All work is confined to `agent_map_gen/`.
3. **No External Runtime Dependencies**: Core generation, TMJ export, and anchor discovery must remain pure Node/browser JavaScript. React is strictly limited to the optional preview component (`MapPreview.jsx`).
4. **Agent-First Abstractions**: Agents must never be expected to parse 2D arrays or tile coordinates. All spatial data must be projected into semantic Kinds (`AreaKind`, `PlaceKind`, `TransitionKind`).
5. **Deterministic Seeding**: Every generator must accept an integer or string seed and produce identical maps for identical seeds.

---

## 2. Architecture & File Structure

```
agent_map_gen/
├── package.json
├── index.js                     # Root entry point re-exporting all modules
├── defaults.js                  # Default configurations for shapers & room types
├── Rng.js                       # Deterministic Mulberry32 & string seed hashing
├── Noise.js                     # 2D Perlin noise generator
├── CellRect.js                  # 2D integer bounding box utility
├── DungeonRand.js               # Weighted choices, chance, and range utilities
├── LandShape.js                 # Overworld tile constants & region masks
├── LandShaper.js                # Base class for overworld shapers
├── StampedLandShaper.js         # Stamp-based terrain shaper
├── ArchipelagoLandShaper.js     # Island cluster terrain shaper
├── EnclosedLandShaper.js        # Crater/valley enclosed terrain shaper
├── VoidLandShaper.js            # Floating void/asteroid terrain shaper
├── SemanticAnchors.js           # Area, Place, Transition graph & sheet binding
├── exportToTmj.js               # Bounded and chunked Tiled JSON (.tmj) exporter
├── renderMapToCanvas.js         # Headless/canvas pixel renderer & hit-tester
├── MapPreview.jsx               # React canvas inspector component
├── dungeon/
│   ├── Dungeon.js               # Core dungeon data structure
│   ├── DungeonGenerator.js      # Procedural generation pipeline orchestrator
│   ├── DungeonGenerationContext.js # Ephemeral step state container
│   ├── DungeonSteps.js          # 15 discrete procedural generation steps
│   ├── DungeonRegistry.js       # Registry for dungeons, rooms, automata, corridors
│   ├── DungeonKinds.js          # High-level presets (standard, cavern, crypt, labyrinth)
│   ├── DungeonRoom.js           # Room model with ports, bounds, and tags
│   ├── DungeonGridManager.js    # Spatial occupancy grid
│   ├── DungeonQueryManager.js   # Room search and spatial queries
│   ├── DungeonConnectionManager.js # Room graph and door connections
│   ├── DungeonRoomPathFinder.js # Corridor pathfinding on grid
│   ├── MinimumSpanningTreeGenerator.js # MST generation for critical paths
│   ├── RoomShapes.js            # Shape definitions (rectangle, cross, circular, blob)
│   ├── RoomWorkers.js           # Shape carving workers
│   ├── CorridorPaths.js         # 10 corridor drawing algorithms
│   ├── CriticalPathProcessors.js # 5 critical path solver strategies
│   ├── AutomataWorkers.js       # Cellular automata smoothing & erosion
│   ├── SidePathProcessor.js     # Branching side room generation
│   ├── SidePathChainBuilder.js  # Branching room chain builder
│   └── SidePathChainConnector.js# Branching room connector
└── documents/
    ├── INTEGRATION_GUIDE.md     # Installation & consumer workflows
    ├── DEV_AGENT_ONBOARDING.md  # This developer agent guide
    └── AGENT_TOOL_GUIDE.md      # Tool manual for agent DMs
```

---

## 3. Core Pipelines

### A. Overworld Generation
1. `generateMap(options)` parses parameters (`shaper`, `width`, `height`, `seed`, `config`).
2. Instantiates target `LandShaper` subclass.
3. Carves initial land shape onto a 1D `Uint8Array` mask using deterministic noise and random walk stamps.
4. Applies tidying passes: gap filling, smoothing, speck removal, and rim carving.
5. Generates rivers (if configured) flowing downhill to coastlines.
6. Returns `{ width, height, mask, elevation, rivers, shaper, bounds, durationMs }`.

### B. Dungeon Generation
1. `generateDungeon(options)` selects preset from `BUILTIN_DUNGEONS` in `DungeonRegistry`.
2. Creates `DungeonGenerationContext` and runs 15 discrete steps:
   - Initial layout generation & bounding boxes
   - Room placement & overlap resolution
   - Cellular automata carving (for caverns/blobs)
   - Minimum spanning tree calculation for critical path
   - Corridor pathfinding and carving
   - Side path & dead-end room creation
   - Hidden room insertion
   - Entrance / exit assignment
3. Returns `{ width, height, dungeonId, floorMask, dungeon, rooms, connections, stats }`.

### C. Semantic Anchor Extraction
1. `discoverAnchors(result)` inspects raw map topology.
2. Dungeon:
   - Creates `AreaKind` per room with thematic naming and narrative tags.
   - Places candidate `PlaceKind` nodes at room centers and perimeter alcoves with verified walkable floor coordinates.
   - Extracts `TransitionKind` edges connecting rooms with direction and distance.
   - Assigns start room as entrance and goal room as inner sanctum.
3. Overworld:
   - Partitions terrain into geographic zones (`central_plains`, `coastal_reach`, `river_basin`).
   - Populates candidate settlement points, piers, and fords.
4. Returns a `SemanticMapGraph` instance with `.bindSheet()`, `.resolveCoordinates()`, and `.toMarkdown()`.

---

## 4. How to Extend the Library

### Adding a New Land Shaper
1. Create `MyNewLandShaper.js` extending `LandShaper`.
2. Define static metadata:
   - `static ID = 'mynew'`
   - `static LABEL = 'My New Shaper'`
   - `static DESCRIPTION = '...'`
   - `static FIELDS = { ... }`
3. Implement `carveLand()` mutating `this.shape`.
4. Implement `static describe()` returning markdown for agent inspection.
5. Register in `SHAPER_KINDS` in `index.js`.

### Adding a New Dungeon Kind
1. In `dungeon/DungeonRegistry.js`, add a preset definition to `BUILTIN_DUNGEONS`.
2. Define room amounts, side room ranges, corridor widths, and corridor style configurations.
3. The kind automatically becomes available via `generateDungeon({ kind: 'my_dungeon' })` and `describeDungeonKind('my_dungeon')`.

### Adding a New Corridor Style
1. Extend `CorridorPathBase` in `dungeon/CorridorPaths.js`.
2. Implement `generatePath(start, end, context)`.
3. Register style name in `BUILTIN_CORRIDOR_STYLES` in `dungeon/DungeonRegistry.js`.

---

## 5. Verification & Test Commands

Before completing any task, execute all test suites from the repository root:

```bash
node agent_map_gen/test.js
node agent_map_gen/test_stage4.js
node agent_map_gen/test_stage3.js
```

### Verification Checklist
- All tests pass with exit code 0.
- No comments in any code file.
- Node.js ESM imports resolve cleanly without experimental flags or loaders.
- `MapPreview.jsx` remains decoupled from Node CLI entry points.
