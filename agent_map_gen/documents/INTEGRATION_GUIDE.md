# Integration Guide: agent_map_gen

Guide for integrating `agent_map_gen` into your app or AI agent harness.

---

## 1. Installation / Linking

### Option A: Local File Path
In your target project's `package.json`:
```json
{
  "dependencies": {
    "agent_map_gen": "file:../path/to/vpet/agent_map_gen"
  }
}
```
Then run:
```bash
npm install
```

### Option B: npm link
In `agent_map_gen/`:
```bash
npm link
```
In your consumer project:
```bash
npm link agent_map_gen
```

---

## 2. Integration Workflows

### Workflow A: Generate Tiled TMJ for Existing Map Loaders
If your game engine or canvas renders maps from Tiled JSON (`.tmj` / `.json`), generate map files programmatically.

```javascript
import fs from 'node:fs';
import { generateDungeon, exportToTmj } from 'agent_map_gen';

const dungeon = generateDungeon({
  kind: 'crypt',
  width: 64,
  height: 64,
  seed: 'campaign-floor-1'
});

const tmjData = exportToTmj(dungeon, {
  name: 'Floor 1 - The Crypt',
  infinite: false,
  tileWidth: 16,
  tileHeight: 16
});

fs.writeFileSync('./assets/maps/floor_1.tmj', JSON.stringify(tmjData, null, 2));
```

The exported TMJ contains:
- `Ground` (Tile Layer): Floor tile indices.
- `Collision` (Tile Layer): Wall/barrier collision masks.
- `Structures` (Object Layer): Vector bounding boxes for rooms, corridors, and entrance/exit interactors.

---

### Workflow B: React Live Preview
To render an interactive map inspector or real-time generator preview:

```jsx
import React, { useState } from 'react';
import { generateDungeon } from 'agent_map_gen';
import { MapPreview } from 'agent_map_gen/MapPreview.jsx';

export function MapViewer() {
  const [mapResult, setMapResult] = useState(() =>
    generateDungeon({ kind: 'labyrinth', width: 48, height: 48 })
  );
  const [selectedRoom, setSelectedRoom] = useState(null);

  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      <MapPreview
        result={mapResult}
        pixelSize={10}
        showGrid={true}
        onRoomClick={(room) => setSelectedRoom(room)}
      />
      {selectedRoom && (
        <div>
          <h3>Room {selectedRoom.id}</h3>
          <p>Dimensions: {selectedRoom.width} x {selectedRoom.height}</p>
        </div>
      )}
    </div>
  );
}
```

---

### Workflow C: In-Memory Bridge to Agent Harness
Bridge raw map topology to agent-facing semantic Kinds (`@area`, `@place`, `@sheet`):

```javascript
import { generateDungeon, discoverAnchors, toAgentMarkdown } from 'agent_map_gen';

const result = generateDungeon({
  kind: 'standard',
  width: 50,
  height: 50,
  seed: 'ruins-run-4'
});

const anchors = discoverAnchors(result);

const agentPromptContext = toAgentMarkdown(anchors);

const spawnX = anchors.places['entrance_hall_center'].x;
const spawnY = anchors.places['entrance_hall_center'].y;
```

---

## 3. Library Surface

- `generateLand(options)`: Generates overworld terrain masks (land, water, elevation, rivers).
- `generateDungeon(options)`: Generates rooms, corridors, and connectivity graph.
- `exportToTmj(result, options)`: Converts overworld or dungeon data into Tiled `.tmj` format.
- `renderMapToCanvas(canvas, result, options)`: Pure JavaScript canvas rendering helper.
- `discoverAnchors(result)`: Extracts high-level Areas, Places, and Transitions for agent comprehension.
- `toAgentMarkdown(anchors)`: Compact markdown description of the map for agent context windows.
- `MapPreview`: Interactive React canvas component.
