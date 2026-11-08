import { ROOM_SHAPE_CLASSES } from '../RoomShapes.js';
import { CORRIDOR_PATH_CLASSES } from './CorridorPaths.js';
import { CRITICAL_PATH_CLASSES } from './CriticalPathProcessors.js';
import { AUTOMATA_WORKER_CLASSES } from './AutomataWorkers.js';
import { ROOM_WORKER_CLASSES } from './RoomWorkers.js';
import { DEFAULT_ROOM_DEFS } from '../defaults.js';

export const BUILTIN_CORRIDOR_STYLES = {
  straight: { label: 'Straight', workerclass: 'StraightCorridorPath' },
  lshaped: { label: 'L-shaped', workerclass: 'LShapedCorridorPath', cornerrounding: 0, preferhorizontalfirst: false },
  curved: { label: 'Curved', workerclass: 'CurvedCorridorPath', mindistance: 10, curvature: 0.3, stepsperdistance: 1.5 },
  doublel: { label: 'Double L', workerclass: 'DoubleLCorridorPath', midpointoffset: 0.5 },
  jagged: { label: 'Jagged', workerclass: 'JaggedCorridorPath', deviationdivisor: 6, jagchance: 0.4 },
  zigzag: { label: 'Zigzag', workerclass: 'ZigzagCorridorPath', mindistance: 10, segments: 4, zigzagoffset: 3 },
  organic: { label: 'Organic', workerclass: 'OrganicCorridorPath', noise: 0.3, smoothingpasses: 2, noisefrequency: 0.2, seedoffset: 777 },
  drunkwalk: { label: 'Drunk walk', workerclass: 'DrunkWalkCorridorPath', drunkeness: 0.3, maxsteps: 2000 },
  branching: { label: 'Branching', workerclass: 'BranchingCorridorPath', branchcount: 2, branchlength: 4 },
  pathfinder: { label: 'Pathfinder', workerclass: 'PathfinderCorridorPath' },
};

export const BUILTIN_AUTOMATA = {
  smooth_corners: { label: 'Smooth corners', workerclass: 'CAWorker_SmoothCorners', randomchance: 0.7 },
  fill_small_gaps: { label: 'Fill small gaps', workerclass: 'CAWorker_FillSmallGaps', wallcount: 5 },
  remove_islands: { label: 'Remove islands', workerclass: 'CAWorker_RemoveIslands', neighbourkillcount: 2 },
  natural_walls: { label: 'Natural walls', workerclass: 'CAWorker_NaturalWalls', birththreshold: 4, deaththreshold: 3, randomchance: 0.5, growthchancefactor: 0.5 },
  add_alcoves: { label: 'Add alcoves', workerclass: 'CAWorker_AddAlcoves', randomchance: 0.3 },
  cave_decorator: { label: 'Cave decorator', workerclass: 'CAWorker_CaveDecorator', randomchance: 0.3 },
};

export const BUILTIN_ROOM_TYPES = {
  empty: { label: 'Empty', roomtype: 'normal', workerclass: 'EmptyRoom', canmodifyfloor: false, canmodifywalls: false, canmodifyterrain: false },
  start: { label: 'Start', roomtype: 'start', workerclass: 'StartRoom', maxroomtypecount: 1 },
  end: { label: 'End', roomtype: 'end', workerclass: 'EndRoom', maxroomtypecount: 1 },
};

export const BUILTIN_DUNGEONS = {
  standard: {
    id: 'standard',
    label: 'Standard Dungeon',
    description: 'Structured underground dungeon with BSP partitioned rooms, spanning tree corridors, critical path from entrance to exit, and side branches.',
    difficultyrange: [1, 5],
    noroomchancecriticalpath: 0,
    noroomchancesidepath: 0,
    mapmargin: 4,
    corridoorwidth: 3,
    smoothcorridoorcorners: true,
    roomsize: [8, 8],
    minroompadding: 2,
    roomsizefactor: [0.9, 1],
    roomamount: [5, 12],
    sideroomcount: [3, 6],
    splitbufferratio: 2,
    maxelongationratio: 1.5,
    minsplitposition: 0.3,
    maxsplitposition: 0.6,
    maxsplitattempts: 400,
    criticalpathprocessor: 'CriticalPathProcessorFlexibleLength',
    criticalpathattempts: 5,
    startroom: 'start',
    endroom: 'end',
    allowhiddensidepaths: false,
    hiddensidepathchance: 0.3,
    sidepathlength: [1, 3],
    longsidepathchance: 0.4,
    meanderingchance: 0,
    meanderingmaxdistance: 30,
    allowbranchingsidepaths: true,
    branchingchance: 0.7,
    availableroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: [] }],
    availablesideroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: [] }],
    corridorstyles: [{ style: 'straight', weight: 1 }],
    earlyautomata: [],
    postgenautomata: [],
  },
  cavern: {
    id: 'cavern',
    label: 'Natural Cavern & Grotto',
    description: 'Organic, rough-hewn cave system with winding, irregular passages, blob-shaped chambers, natural wall erosion, and alcoves.',
    difficultyrange: [1, 5],
    noroomchancecriticalpath: 0,
    noroomchancesidepath: 0,
    mapmargin: 4,
    corridoorwidth: 3,
    smoothcorridoorcorners: true,
    roomsize: [10, 10],
    minroompadding: 2,
    roomsizefactor: [0.8, 1],
    roomamount: [4, 10],
    sideroomcount: [2, 5],
    splitbufferratio: 2,
    maxelongationratio: 1.6,
    minsplitposition: 0.25,
    maxsplitposition: 0.65,
    maxsplitattempts: 400,
    criticalpathprocessor: 'CriticalPathProcessorFlexibleLength',
    criticalpathattempts: 5,
    startroom: 'start',
    endroom: 'end',
    allowhiddensidepaths: true,
    hiddensidepathchance: 0.4,
    sidepathlength: [1, 4],
    longsidepathchance: 0.5,
    meanderingchance: 0.3,
    meanderingmaxdistance: 30,
    allowbranchingsidepaths: true,
    branchingchance: 0.8,
    availableroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: ['blob', 'circular'] }],
    availablesideroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: ['blob'] }],
    corridorstyles: [
      { style: 'organic', weight: 3 },
      { style: 'drunkwalk', weight: 2 },
      { style: 'curved', weight: 1 },
    ],
    earlyautomata: [
      { automata: 'natural_walls', iterations: 1, order: 1 },
      { automata: 'smooth_corners', iterations: 2, order: 2 },
    ],
    postgenautomata: [
      { automata: 'cave_decorator', iterations: 2, order: 1 },
      { automata: 'add_alcoves', iterations: 2, order: 2 },
      { automata: 'fill_small_gaps', iterations: 1, order: 3 },
    ],
  },
  crypt: {
    id: 'crypt',
    label: 'Ancient Crypt & Catacombs',
    description: 'Orderly, claustrophobic stone tomb with rectangular chambers, straight hallways, burial alcoves, and hidden secret vaults.',
    difficultyrange: [2, 5],
    noroomchancecriticalpath: 0,
    noroomchancesidepath: 0,
    mapmargin: 4,
    corridoorwidth: 2,
    smoothcorridoorcorners: false,
    roomsize: [7, 7],
    minroompadding: 2,
    roomsizefactor: [0.9, 1],
    roomamount: [6, 14],
    sideroomcount: [4, 8],
    splitbufferratio: 2,
    maxelongationratio: 1.4,
    minsplitposition: 0.35,
    maxsplitposition: 0.65,
    maxsplitattempts: 500,
    criticalpathprocessor: 'CriticalPathProcessorFlexibleLength',
    criticalpathattempts: 5,
    startroom: 'start',
    endroom: 'end',
    allowhiddensidepaths: true,
    hiddensidepathchance: 0.5,
    sidepathlength: [1, 3],
    longsidepathchance: 0.3,
    meanderingchance: 0,
    meanderingmaxdistance: 25,
    allowbranchingsidepaths: true,
    branchingchance: 0.6,
    availableroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: ['rectangle', 'cross'] }],
    availablesideroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: ['rectangle'] }],
    corridorstyles: [
      { style: 'straight', weight: 4 },
      { style: 'lshaped', weight: 3 },
    ],
    earlyautomata: [],
    postgenautomata: [
      { automata: 'add_alcoves', iterations: 3, order: 1 },
      { automata: 'fill_small_gaps', iterations: 1, order: 2 },
    ],
  },
  labyrinth: {
    id: 'labyrinth',
    label: 'Twisting Labyrinth',
    description: 'Disorienting maze of narrow corridors with many winding branch connections, double-L turns, dead ends, and sparse chambers.',
    difficultyrange: [3, 5],
    noroomchancecriticalpath: 0,
    noroomchancesidepath: 0,
    mapmargin: 3,
    corridoorwidth: 2,
    smoothcorridoorcorners: false,
    roomsize: [6, 6],
    minroompadding: 2,
    roomsizefactor: [0.8, 1],
    roomamount: [8, 16],
    sideroomcount: [5, 10],
    splitbufferratio: 1.5,
    maxelongationratio: 1.8,
    minsplitposition: 0.25,
    maxsplitposition: 0.75,
    maxsplitattempts: 500,
    criticalpathprocessor: 'CriticalPathProcessorBidirectional',
    criticalpathattempts: 5,
    startroom: 'start',
    endroom: 'end',
    allowhiddensidepaths: false,
    hiddensidepathchance: 0.2,
    sidepathlength: [2, 5],
    longsidepathchance: 0.7,
    meanderingchance: 0.4,
    meanderingmaxdistance: 40,
    allowbranchingsidepaths: true,
    branchingchance: 0.9,
    availableroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: ['rectangle', 'circular'] }],
    availablesideroomtypes: [{ roomtype: 'empty', minsizerequired: null, layouts: ['rectangle'] }],
    corridorstyles: [
      { style: 'doublel', weight: 4 },
      { style: 'lshaped', weight: 3 },
    ],
    earlyautomata: [],
    postgenautomata: [
      { automata: 'remove_islands', iterations: 1, order: 1 },
    ],
  },
};

export class DungeonRegistry {
  constructor(customDefs = {}) {
    this.dungeons = { ...BUILTIN_DUNGEONS, ...(customDefs.dungeons ?? {}) };
    this.roomtypes = { ...BUILTIN_ROOM_TYPES, ...(customDefs.roomtypes ?? {}) };
    this.roomlayouts = { ...DEFAULT_ROOM_DEFS, ...(customDefs.roomlayouts ?? {}) };
    this.corridorstyles = { ...BUILTIN_CORRIDOR_STYLES, ...(customDefs.corridorstyles ?? {}) };
    this.automata = { ...BUILTIN_AUTOMATA, ...(customDefs.automata ?? {}) };

    this.classes = {
      roomshape: ROOM_SHAPE_CLASSES,
      corridorpath: CORRIDOR_PATH_CLASSES,
      criticalpath: CRITICAL_PATH_CLASSES,
      automataworker: AUTOMATA_WORKER_CLASSES,
      roomworker: ROOM_WORKER_CLASSES,
    };
  }

  def(category, id) {
    const table = this[category];
    const item = table?.[id];
    if (!item) throw new Error(`DungeonRegistry: no def "${id}" in "${category}"`);
    return item;
  }

  ids(category) {
    const table = this[category];
    return table ? Object.keys(table) : [];
  }

  has(category, id) {
    const table = this[category];
    return !!table && id in table;
  }

  dungeonClass(kind, className) {
    const table = this.classes[kind];
    const Cls = table?.[className];
    if (!Cls) throw new Error(`DungeonRegistry: unknown class "${className}" for kind "${kind}"`);
    return Cls;
  }
}
