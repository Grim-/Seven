import { LandShaper } from './LandShaper.js';
import { AROUND, LAND, MAX_EDGE_RINGS, VOID, clearEdge, edgeRings, fillEnclosed, keepLargest } from './LandShape.js';
import { CellRect } from './CellRect.js';
import { noiseAt } from './Noise.js';
import { randomChance, randomFloat, randomRange, randomWeighted } from './Rng.js';
import { ROOM_SHAPE_CLASSES } from './RoomShapes.js';
import { DEFAULT_ROOM_DEFS, DEFAULT_SHAPER_CONFIGS } from './defaults.js';

const PURPOSE = 'land-stamp';
const SHAPE_SEED_STEP = 7919;
const COAST_NOISE_OFFSET = 9173;
const MIN_ASPECT = 0.6;
const MAX_ASPECT = 1.4;
const ELEVATION_NOISE_OFFSET = 4421;
const RIVER_PURPOSE = 'land-river';
const RIVER_STEPS = 4000;
const ELEVATION_MAX = 100;
const WATER_MAX = 100;
const ISLAND_SEED_STEP = 104729;
const RIVER_STREAM_STEP = 1000;
const DEFAULT_WATER_DEPTH = 0.4;

export default class StampedLandShaper extends LandShaper {
  static KIND = 'stamped';
  static LABEL = 'Stamped Continental Landmass';
  static DESCRIPTION = 'Constructs an organic, contiguous continent or island by stamping and blending procedural geometric and noise-deformed shapes. Features detailed noise-broken coastlines, realistic elevation rise toward inland peaks, and meandering rivers cut from the coast into the interior with walkable ford bridges.';

  static FIELDS = [
    ...LandShaper.FIELDS.filter((field) => field.id !== 'threshold'),
    { id: 'mincount', group: 'Shape', label: 'Min shapes', step: 1, min: 1, max: 200, description: 'Fewest shapes laid down to build the land.' },
    { id: 'maxcount', group: 'Shape', label: 'Max shapes', step: 1, min: 1, max: 200, description: 'Most shapes laid down to build the land.' },
    { id: 'minsize', group: 'Shape', label: 'Min size', step: 1, min: 3, max: 256, description: 'Smallest shape, in tiles across.' },
    { id: 'maxsize', group: 'Shape', label: 'Max size', step: 1, min: 3, max: 256, description: 'Largest shape, in tiles across.' },
    { id: 'offset', group: 'Shape', label: 'Offset', step: 0.05, min: 0, max: 1, description: 'Furthest the first shape can land from the middle of the map, as a share of half its size.' },
    { id: 'carvechance', group: 'Shape', label: 'Carve chance', step: 0.05, min: 0, max: 1, description: 'Chance each shape after the first cuts barrier out of the land instead of adding land, making bays and inlets.' },
    { id: 'roughness', group: 'Coast', label: 'Coast roughness', step: 0.05, min: 0, max: 0.5, description: 'How much of the coastline is broken up by noise. 0 leaves the shapes as they are.' },
    { id: 'roughwidth', group: 'Coast', label: 'Rough width', step: 1, min: 1, max: 12, description: 'How far either side of the coast the roughening reaches, in tiles.' },
    { id: 'octaves', group: 'Coast', label: 'Coast octaves', step: 1, min: 1, max: 6, description: 'Layers of noise in the roughening. More gives finer detail on top of broad bites.' },
    { id: 'edgemargin', group: 'Edge', label: 'Edge margin', step: 1, min: 1, max: 48, description: 'Cells at the map edge that are always barrier.' },
    { id: 'rings', group: 'Edge', label: 'Edge rings', step: 1, min: 0, max: MAX_EDGE_RINGS, description: 'Rings between the barrier and the land.' },
    { id: 'freeboard', group: 'Elevation', label: 'Freeboard', step: 0.5, min: 0, max: 50, description: 'How far the coast sits above the barrier water level.' },
    { id: 'rise', group: 'Elevation', label: 'Rise', step: 0.5, min: 0, max: 60, description: 'How much higher the land gets moving inland.' },
    { id: 'peakdistance', group: 'Elevation', label: 'Peak distance', step: 1, min: 1, max: 200, description: 'Tiles from the coast at which the land reaches its full rise.' },
    { id: 'elevationnoise', group: 'Elevation', label: 'Elevation noise', step: 0.5, min: 0, max: 30, description: 'Most the land elevation wanders up or down.' },
    { id: 'minrivers', group: 'Rivers', label: 'Min rivers', step: 1, min: 0, max: 20, description: 'Fewest rivers cut in from the coast.' },
    { id: 'maxrivers', group: 'Rivers', label: 'Max rivers', step: 1, min: 0, max: 20, description: 'Most rivers cut in from the coast.' },
    { id: 'riverreach', group: 'Rivers', label: 'River reach', step: 1, min: 1, max: 200, description: 'Tiles from the coast a river heads for.' },
    { id: 'riverwidth', group: 'Rivers', label: 'River width', step: 1, min: 1, max: 16, description: 'Width of a river channel in tiles.' },
    { id: 'bankwidth', group: 'Rivers', label: 'Bank width', step: 1, min: 0, max: 8, description: 'Width of the shallower bank either side of the channel.' },
    { id: 'wander', group: 'Rivers', label: 'River wander', step: 0.05, min: 0, max: 1, description: 'How far a river winds off a straight line.' },
    { id: 'riverwater', group: 'Rivers', label: 'Channel water', step: 1, min: 0, max: 100, description: 'Water the channel settles at.' },
    { id: 'bankwater', group: 'Rivers', label: 'Bank water', step: 1, min: 0, max: 100, description: 'Water the banks settle at.' },
    { id: 'bridgespacing', group: 'Rivers', label: 'Bridge spacing', step: 1, min: 0, max: 200, description: 'Steps along a river between land bridges. 0 makes none.' },
    { id: 'bridgelength', group: 'Rivers', label: 'Bridge length', step: 1, min: 1, max: 20, description: 'Steps along a river each land bridge covers.' },
  ];

  constructor(cfg = {}, reg = null, context = {}) {
    const merged = { ...DEFAULT_SHAPER_CONFIGS.stamped, ...cfg };
    super(merged, reg, context);
  }

  inEdge(x, y, width, height) {
    const margin = this.cfg.edgemargin ?? 6;
    return x < margin || y < margin || x >= width - margin || y >= height - margin;
  }

  seeded(width, height, seed) {
    const mask = new Uint8Array(width * height);
    this.stampIsland(mask, width, height, seed, new CellRect(0, 0, width, height), 0, 1);
    return mask;
  }

  layouts() {
    const custom = this.cfg.layouts ?? { blob: 6, circular: 3, cross: 1, rectangle: 0 };
    return Object.entries(custom)
      .filter(([id, weight]) => weight > 0 && ROOM_SHAPE_CLASSES[id])
      .map(([id, weight]) => ({ value: id, weight }));
  }

  stampIsland(mask, width, height, mapSeed, area, island, scale) {
    const cfg = this.cfg;
    const layouts = this.layouts();
    if (!layouts.length) return;

    const seed = mapSeed + island * ISLAND_SEED_STEP;
    const rolled = Math.round(randomRange(seed, PURPOSE, cfg.mincount, Math.max(cfg.mincount, cfg.maxcount), 0, 0));
    const count = Math.max(1, Math.round(rolled * scale * scale));
    const centre = {
      x: Math.floor(area.minX + area.width / 2 + randomRange(seed, PURPOSE, -cfg.offset, cfg.offset, 0, 1) * area.width / 2),
      y: Math.floor(area.minY + area.height / 2 + randomRange(seed, PURPOSE, -cfg.offset, cfg.offset, 0, 2) * area.height / 2),
    };

    for (let i = 0; i < count; i++) {
      const at = i === 0 ? centre : this.coastCell(mask, width, height, seed, i, area) ?? centre;
      const carve = i > 0 && randomChance(seed, PURPOSE, cfg.carvechance, 1, i);
      const size = randomRange(seed, PURPOSE, cfg.minsize, Math.max(cfg.minsize, cfg.maxsize), 2, i) * scale;
      const aspect = randomRange(seed, PURPOSE, MIN_ASPECT, MAX_ASPECT, 3, i);
      const shapeWidth = Math.max(3, Math.round(size * aspect));
      const shapeHeight = Math.max(3, Math.round(size / aspect));

      const shapeId = randomWeighted(seed, PURPOSE, layouts, 4, i);
      const ShapeClass = ROOM_SHAPE_CLASSES[shapeId];
      const def = this.context.roomDefs?.[shapeId] ?? DEFAULT_ROOM_DEFS[shapeId] ?? {};
      const shape = new ShapeClass(def);
      const bounds = new CellRect(at.x - Math.floor(shapeWidth / 2), at.y - Math.floor(shapeHeight / 2), shapeWidth, shapeHeight);

      for (const cell of shape.generateRoomCells({ seed: seed + i * SHAPE_SEED_STEP }, bounds, def.layoutsizemultiplier ?? 1)) {
        if (!area.contains(cell)) continue;
        if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) continue;
        if (this.inEdge(cell.x, cell.y, width, height)) continue;
        mask[cell.y * width + cell.x] = carve ? VOID : LAND;
      }
    }
  }

  coastCell(mask, width, height, seed, i, area) {
    const coast = [];

    for (let y = area.minY; y <= area.maxY; y++) {
      for (let x = area.minX; x <= area.maxX; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (mask[y * width + x] !== LAND) continue;
        if (this.touchesVoid(mask, width, height, x, y)) coast.push({ x, y });
      }
    }

    if (!coast.length) return null;
    return coast[Math.min(coast.length - 1, Math.floor(randomFloat(seed, PURPOSE, 5, i) * coast.length))];
  }

  touchesVoid(mask, width, height, x, y) {
    for (const [dx, dy] of AROUND) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (mask[ny * width + nx] === VOID) return true;
    }
    return false;
  }

  async tidy(grid, loading = null) {
    if (this.cfg.roughness > 0) {
      loading?.progress?.('Land coast');
      this.roughen(grid);
    }
    await super.tidy(grid, loading);
  }

  coastNoise(seed, x, y) {
    let total = 0;
    let amplitude = 1;
    let weights = 0;
    let scale = this.cfg.scale ?? 0.08;

    for (let octave = 0; octave < (this.cfg.octaves ?? 3); octave++) {
      total += noiseAt(seed + COAST_NOISE_OFFSET + octave, x, y, scale) * amplitude;
      weights += amplitude;
      amplitude *= 0.5;
      scale *= 2;
    }

    return total / weights;
  }

  roughen(grid) {
    const { mask, width, height, seed, cfg } = grid;
    const next = mask.slice();
    const reach = cfg.roughwidth ?? 3;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const here = mask[y * width + x];
        if (!this.nearOther(mask, width, height, x, y, here, reach)) continue;

        const noise = this.coastNoise(seed, x, y);
        if (here === LAND && noise < cfg.roughness) next[y * width + x] = VOID;
        else if (here === VOID && noise > 1 - cfg.roughness) next[y * width + x] = LAND;
      }
    }

    grid.mask = next;
  }

  nearOther(mask, width, height, x, y, here, reach) {
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (mask[ny * width + nx] !== here) return true;
      }
    }
    return false;
  }

  levelFor(water) {
    const depth = this.context.waterDepth ?? DEFAULT_WATER_DEPTH;
    return (this.context.head ?? 0) - water * depth;
  }

  settledWater(level) {
    const depth = this.context.waterDepth ?? DEFAULT_WATER_DEPTH;
    return Math.max(0, Math.min(WATER_MAX, ((this.context.head ?? 0) - level) / depth));
  }

  elevation(grid, coast) {
    const { mask, width, height, seed, cfg } = grid;
    const base = (this.context.head ?? 0) + (cfg.freeboard ?? 4);
    const out = new Float32Array(width * height).fill(NaN);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (mask[i] === VOID) continue;

        const rise = (cfg.rise ?? 8) * Math.min(1, coast[i] / (cfg.peakdistance ?? 30));
        const wobble = (noiseAt(seed + ELEVATION_NOISE_OFFSET, x, y, cfg.scale ?? 0.08) - 0.5) * 2 * (cfg.elevationnoise ?? 3);
        out[i] = Math.max(0, Math.min(ELEVATION_MAX, base + rise + wobble));
      }
    }

    return out;
  }

  rollRivers(seed, island) {
    const cfg = this.cfg;
    return Math.round(randomRange(seed, RIVER_PURPOSE, cfg.minrivers ?? 1, Math.max(cfg.minrivers ?? 1, cfg.maxrivers ?? 3), 0, island));
  }

  rivers(grid, coast, elevation, water) {
    this.riversWithin(grid, coast, elevation, water, null, this.rollRivers(grid.seed, 0), 0);
  }

  riversWithin(grid, coast, elevation, water, area, count, island) {
    const { mask, width, seed, cfg } = grid;
    if (count <= 0) return;

    const mouths = [];
    const inland = [];
    let deepest = -1;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] !== LAND) continue;
      if (area && !area.contains({ x: i % width, y: Math.floor(i / width) })) continue;
      if (coast[i] === 1) mouths.push(i);
      if (coast[i] >= (cfg.riverreach ?? 30)) inland.push(i);
      if (deepest < 0 || coast[i] > coast[deepest]) deepest = i;
    }
    if (!mouths.length || deepest < 0) return;

    for (let r = 0; r < count; r++) {
      const stream = island * RIVER_STREAM_STEP + r;
      const mouth = mouths[Math.min(mouths.length - 1, Math.floor(randomFloat(seed, RIVER_PURPOSE, 1, stream) * mouths.length))];
      const source = inland.length
        ? inland[Math.min(inland.length - 1, Math.floor(randomFloat(seed, RIVER_PURPOSE, 2, stream) * inland.length))]
        : deepest;
      this.carveRiver(grid, this.riverPath(grid, mouth, source, stream), elevation, water);
    }
  }

  riverPath(grid, fromCell, toCell, stream) {
    const { mask, width, height, seed, cfg } = grid;
    const end = { x: toCell % width, y: Math.floor(toCell / width) };
    let current = { x: fromCell % width, y: Math.floor(fromCell / width) };
    const path = [current];

    for (let step = 0; step < RIVER_STEPS && (current.x !== end.x || current.y !== end.y); step++) {
      const toward = normalise(end.x - current.x, end.y - current.y);
      const wander = normalise(
        randomRange(seed, RIVER_PURPOSE, -1, 1, 3 + stream, step * 2),
        randomRange(seed, RIVER_PURPOSE, -1, 1, 3 + stream, step * 2 + 1),
      );
      const drift = normalise(
        toward.x + (wander.x - toward.x) * (cfg.wander ?? 0.35),
        toward.y + (wander.y - toward.y) * (cfg.wander ?? 0.35),
      );

      const next = { x: current.x + Math.round(drift.x), y: current.y + Math.round(drift.y) };
      if (next.x === current.x && next.y === current.y) next.x += Math.sign(end.x - current.x) || 1;
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) break;
      if (step > (cfg.riverwidth ?? 3) && mask[next.y * width + next.x] === VOID) break;

      current = next;
      path.push(current);
    }

    return path;
  }

  carveRiver(grid, path, elevation, water) {
    const { mask, width, height, cfg } = grid;
    const channel = Math.max(0, this.levelFor(cfg.riverwater ?? 90));
    const bank = Math.max(0, this.levelFor(cfg.bankwater ?? 70));
    const inner = (cfg.riverwidth ?? 3) / 2;
    const outer = inner + (cfg.bankwidth ?? 2);
    const reach = Math.ceil(outer);

    const around = (point, radius, fn) => {
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const distance = Math.hypot(dx, dy);
          if (distance > radius) continue;

          const x = point.x + dx;
          const y = point.y + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;

          const i = y * width + x;
          if (mask[i] !== VOID) fn(i, distance);
        }
      }
    };

    const set = (i, level) => {
      elevation[i] = level;
      water[i] = this.settledWater(level);
    };

    for (const point of path) {
      around(point, outer, (i, distance) => {
        const level = distance <= inner ? channel : bank;
        if (level < elevation[i]) set(i, level);
      });
    }

    if ((cfg.bridgespacing ?? 28) <= 0) return;

    path.forEach((point, step) => {
      if (step === 0 || step % (cfg.bridgespacing ?? 28) >= (cfg.bridgelength ?? 3)) return;
      around(point, inner, (i) => set(i, bank));
    });
  }

  keepLand(grid) {
    keepLargest(grid);
  }

  async finish(grid, loading = null) {
    loading?.progress?.('Land mass');
    clearEdge(grid, (x, y) => this.inEdge(x, y, grid.width, grid.height));
    this.keepLand(grid);
    fillEnclosed(grid);

    loading?.progress?.('Land elevation');
    const coast = coastDistance(grid);
    const elevation = this.elevation(grid, coast);
    const water = new Float32Array(grid.width * grid.height).fill(NaN);

    loading?.progress?.('Rivers');
    this.rivers(grid, coast, elevation, water);
    grid.fields = { elevation, water };

    loading?.progress?.('Land edge rings');
    return edgeRings(grid, this.cfg.rings ?? 2, this.interior);
  }
}

function coastDistance(grid) {
  const { mask, width, height } = grid;
  const distance = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== VOID) continue;
    distance[i] = 0;
    queue[tail++] = i;
  }

  while (head < tail) {
    const cell = queue[head++];
    const x = cell % width;
    const y = (cell - x) / width;

    for (const [dx, dy] of AROUND) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const next = ny * width + nx;
      if (distance[next] >= 0) continue;
      distance[next] = distance[cell] + 1;
      queue[tail++] = next;
    }
  }

  return distance;
}

function normalise(x, y) {
  const length = Math.hypot(x, y);
  if (!length) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}
