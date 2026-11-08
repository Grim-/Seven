import { seedOf } from './Rng.js';
import { LandShaper } from './LandShaper.js';
import StampedLandShaper from './StampedLandShaper.js';
import ArchipelagoLandShaper from './ArchipelagoLandShaper.js';
import EnclosedLandShaper from './EnclosedLandShaper.js';
import VoidLandShaper from './VoidLandShaper.js';
import { DEFAULT_SHAPER_CONFIGS } from './defaults.js';
import { BARRIER, LAND, VOID } from './LandShape.js';

import {
  describeAllDungeonKinds,
  describeDungeonKind,
  generateDungeon,
  listDungeonKinds,
} from './dungeon/DungeonKinds.js';
import { Dungeon } from './dungeon/Dungeon.js';
import { DungeonGenerator } from './dungeon/DungeonGenerator.js';
import {
  BUILTIN_AUTOMATA,
  BUILTIN_CORRIDOR_STYLES,
  BUILTIN_DUNGEONS,
  BUILTIN_ROOM_TYPES,
  DungeonRegistry,
} from './dungeon/DungeonRegistry.js';

import { exportToTmj, exportToTmjString } from './exportToTmj.js';
import { DEFAULT_PALETTE, pickRoomAtCanvas, renderMapToCanvas } from './renderMapToCanvas.js';
import {
  AreaKind,
  PlaceKind,
  TransitionKind,
  SemanticMapGraph,
  discoverAnchors,
  toAgentMarkdown,
} from './SemanticAnchors.js';
import {
  WANG_DUNGEON_ROCK,
  WANG_OVERWORLD_WATER_GRASS,
  WANG_OVERWORLD_GRASS_DIRT,
  WANG_OVERWORLD_SAND_WATER,
  resolveDungeonTiles,
  resolveOverworldTiles,
  parseWangTileset,
} from './WangResolver.js';

export const SHAPER_KINDS = {
  stamped: StampedLandShaper,
  archipelago: ArchipelagoLandShaper,
  enclosed: EnclosedLandShaper,
  void: VoidLandShaper,
};

export function listShaperKinds() {
  return Object.entries(SHAPER_KINDS).map(([id, ShaperClass]) => ({
    id,
    label: ShaperClass.LABEL,
    description: ShaperClass.DESCRIPTION,
    fields: ShaperClass.FIELDS,
    defaultConfig: DEFAULT_SHAPER_CONFIGS[id] ?? {},
  }));
}

export function describeShaperKind(id) {
  const ShaperClass = SHAPER_KINDS[id];
  if (!ShaperClass) return `Unknown shaper kind: "${id}". Available: ${Object.keys(SHAPER_KINDS).join(', ')}`;
  return ShaperClass.describe();
}

export function describeAllShaperKinds() {
  const parts = [
    '# Map Generator Shaper Kinds',
    'These procedural land shapers define the gross physical terrain and landmass shape of a map.',
    ''
  ];
  for (const id of Object.keys(SHAPER_KINDS)) {
    parts.push(describeShaperKind(id));
    parts.push('');
  }
  return parts.join('\n');
}

export async function generateMap({
  shaper = 'stamped',
  seed = 12345,
  width = 96,
  height = 96,
  config = {},
  origin = { x: 0, y: 0 },
  context = {},
  loading = null,
} = {}) {
  const ShaperClass = SHAPER_KINDS[shaper];
  if (!ShaperClass) {
    throw new Error(`agent_map_gen: unknown shaper "${shaper}". Available: ${Object.keys(SHAPER_KINDS).join(', ')}`);
  }

  const numericSeed = typeof seed === 'number' ? (seed >>> 0) : seedOf(seed);
  const instance = new ShaperClass(config, null, context);
  const result = await instance.mask(width, height, numericSeed, origin, loading);

  let landCells = 0;
  let barrierCells = 0;
  let rimCells = 0;

  for (let i = 0; i < result.land.length; i++) {
    const val = result.land[i];
    if (val === BARRIER) barrierCells++;
    else if (val >= LAND && val <= 3) landCells++;
    else if (val > 3 && val < BARRIER) rimCells++;
  }

  const totalCells = width * height;
  const landRatio = totalCells ? (landCells / totalCells) : 0;

  return {
    width,
    height,
    seed: numericSeed,
    shaperId: shaper,
    mask: result.land,
    fields: result.fields ?? {},
    stats: {
      totalCells,
      landCells,
      barrierCells,
      rimCells,
      landRatio: Number(landRatio.toFixed(3)),
    },
  };
}

export {
  LandShaper,
  StampedLandShaper,
  ArchipelagoLandShaper,
  EnclosedLandShaper,
  VoidLandShaper,
  LAND,
  VOID,
  BARRIER,
  generateDungeon,
  listDungeonKinds,
  describeDungeonKind,
  describeAllDungeonKinds,
  Dungeon,
  DungeonGenerator,
  DungeonRegistry,
  BUILTIN_DUNGEONS,
  BUILTIN_CORRIDOR_STYLES,
  BUILTIN_AUTOMATA,
  BUILTIN_ROOM_TYPES,
  exportToTmj,
  exportToTmjString,
  renderMapToCanvas,
  pickRoomAtCanvas,
  DEFAULT_PALETTE,
  AreaKind,
  PlaceKind,
  TransitionKind,
  SemanticMapGraph,
  discoverAnchors,
  toAgentMarkdown,
  WANG_DUNGEON_ROCK,
  WANG_OVERWORLD_WATER_GRASS,
  WANG_OVERWORLD_GRASS_DIRT,
  WANG_OVERWORLD_SAND_WATER,
  resolveDungeonTiles,
  resolveOverworldTiles,
  parseWangTileset,
};
