import { CellRect } from '../CellRect.js';
import { seedOf } from '../Rng.js';
import { BUILTIN_DUNGEONS, DungeonRegistry } from './DungeonRegistry.js';
import { DungeonGenerator } from './DungeonGenerator.js';

export function listDungeonKinds() {
  return Object.values(BUILTIN_DUNGEONS).map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    roomAmount: def.roomamount,
    sideRoomCount: def.sideroomcount,
    corridorWidth: def.corridoorwidth,
    corridorStyles: def.corridorstyles.map((s) => s.style),
  }));
}

export function describeDungeonKind(id) {
  const def = BUILTIN_DUNGEONS[id];
  if (!def) return `Unknown dungeon kind: "${id}". Available: ${Object.keys(BUILTIN_DUNGEONS).join(', ')}`;

  const styles = def.corridorstyles.map((s) => s.style).join(', ');
  const lines = [
    `### Dungeon Kind: ${def.label} (\`${def.id}\`)`,
    def.description,
    '',
    `- **Room Count:** ${def.roomamount[0]} to ${def.roomamount[1]} rooms`,
    `- **Side Rooms:** ${def.sideroomcount[0]} to ${def.sideroomcount[1]} branches`,
    `- **Corridor Width:** ${def.corridoorwidth} tiles`,
    `- **Corridor Styles:** ${styles}`,
    `- **Allows Hidden Rooms:** ${def.allowhiddensidepaths ? 'Yes' : 'No'}`,
  ];
  return lines.join('\n');
}

export function describeAllDungeonKinds() {
  const parts = [
    '# Dungeon Generator Kinds',
    'These procedural generators create underground spaces with rooms, corridors, and branching structures.',
    ''
  ];
  for (const id of Object.keys(BUILTIN_DUNGEONS)) {
    parts.push(describeDungeonKind(id));
    parts.push('');
  }
  return parts.join('\n');
}

export async function generateDungeon({
  kind = 'standard',
  seed = 12345,
  width = 64,
  height = 64,
  config = {},
  customDefs = {},
  loading = null,
} = {}) {
  const reg = new DungeonRegistry(customDefs);
  if (!reg.has('dungeons', kind)) {
    throw new Error(`agent_map_gen: unknown dungeon kind "${kind}". Available: ${reg.ids('dungeons').join(', ')}`);
  }

  if (Object.keys(config).length) {
    const baseDef = reg.def('dungeons', kind);
    reg.dungeons[kind] = { ...baseDef, ...config };
  }

  const numericSeed = typeof seed === 'number' ? (seed >>> 0) : seedOf(seed);
  const bounds = new CellRect(0, 0, width, height);
  const generator = new DungeonGenerator(reg, kind, bounds, numericSeed);
  const dungeon = await generator.generate(loading);

  const rooms = dungeon.rooms.map((room) => ({
    id: room.id,
    type: room.roomType ?? 'normal',
    tags: [...room.tags],
    isOnCriticalPath: room.isOnCriticalPath,
    criticalPathIndex: room.criticalPathIndex,
    center: room.center,
    bounds: room.roomCellRect.toJSON(),
    connectedRooms: room.connectedRooms.map((c) => c.id),
  }));

  const connections = dungeon.connectionManager.allConnections.map((c) => ({
    roomA: c.roomA.id,
    roomB: c.roomB.id,
    pathLength: c.corridoor?.path.length ?? 0,
  }));

  let floorCells = 0;
  const floorMask = dungeon.floorMask();
  for (let i = 0; i < floorMask.length; i++) {
    if (floorMask[i]) floorCells++;
  }

  const totalCells = width * height;
  const floorRatio = totalCells ? floorCells / totalCells : 0;

  return {
    width,
    height,
    seed: numericSeed,
    dungeonId: kind,
    floorMask,
    dungeon,
    rooms,
    connections,
    stats: {
      totalCells,
      floorCells,
      floorRatio: Number(floorRatio.toFixed(3)),
      totalRooms: dungeon.rooms.length,
      criticalPathRooms: dungeon.getAllCriticalPathRooms().length,
      sidePathRooms: dungeon.getAllSidePathRooms().length,
      hiddenRooms: dungeon.hiddenRooms.size,
      totalConnections: dungeon.connectionManager.allConnections.length,
    },
  };
}
