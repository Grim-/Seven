import { LandShaper } from './LandShaper.js';
import { AROUND, LAND, VOID, regionsOf } from './LandShape.js';
import { randomRange } from './Rng.js';
import { DEFAULT_SHAPER_CONFIGS } from './defaults.js';

const TRAIL_STEPS = 4000;

export default class VoidLandShaper extends LandShaper {
  static KIND = 'void';
  static LABEL = 'Void & Winding Trails';
  static DESCRIPTION = 'Generates clusters of disjointed land platforms or floating islands connected by winding drunkard-walk trails and bridges across an abyss or body of water.';

  static FIELDS = [
    ...LandShaper.FIELDS,
    { id: 'minregion', group: 'Trails', label: 'Min region', step: 1, min: 0, max: 5000, description: 'Land regions smaller than this many cells are removed instead of connected by a trail.' },
    { id: 'drunkenness', group: 'Trails', label: 'Trail wander', step: 0.05, min: 0, max: 1, description: 'How far connecting trails wander off a straight line.' },
    { id: 'trailwidth', group: 'Trails', label: 'Trail width', step: 1, min: 1, max: 12, description: 'Width of connecting trails in tiles.' },
  ];

  constructor(cfg = {}, reg = null, context = {}) {
    const merged = { ...DEFAULT_SHAPER_CONFIGS.void, ...cfg };
    super(merged, reg, context);
  }

  async finish(grid, loading = null) {
    loading?.progress?.('Land trails');
    connect(grid);

    loading?.progress?.('Land rims');
    return ringed(grid.mask, grid.width, grid.height, this.interior);
  }
}

function ringed(mask, width, height, interior) {
  const out = new Uint8Array(width * height).fill(interior);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== VOID) continue;
    out[i] = 0;
    queue[tail++] = i;
  }

  while (head < tail) {
    const cell = queue[head++];
    const distance = out[cell] + 1;
    if (distance >= interior) continue;

    const x = cell % width;
    const y = (cell - x) / width;

    for (const [dx, dy] of AROUND) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const next = ny * width + nx;
      if (out[next] <= distance) continue;

      out[next] = distance;
      queue[tail++] = next;
    }
  }

  return out;
}

function connect(grid) {
  const { mask, width, height, seed, cfg } = grid;
  const regions = regionsOf(mask, width, height);
  const minRegion = cfg.minregion ?? 16;
  const kept = regions.filter((cells) => cells.length >= minRegion);

  const keptCells = new Set();
  for (const region of kept) for (const cell of region) keptCells.add(cell);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === LAND && !keptCells.has(i)) mask[i] = VOID;
  }

  if (kept.length < 2) return;

  const points = kept.map((cells) => centre(cells, width));
  const links = minimumSpanningTree(points);

  links.forEach(([a, b], linkIndex) => {
    carveTrail(mask, width, height, points[a], points[b], seed, linkIndex, cfg);
  });
}

function centre(cells, width) {
  let sx = 0;
  let sy = 0;
  for (const cell of cells) {
    sx += cell % width;
    sy += Math.floor(cell / width);
  }
  return { x: Math.round(sx / cells.length), y: Math.round(sy / cells.length) };
}

function minimumSpanningTree(points) {
  const inTree = [0];
  const out = [];

  while (inTree.length < points.length) {
    let bestDist = Infinity;
    let bestA = -1;
    let bestB = -1;

    for (const a of inTree) {
      const pa = points[a];
      for (let b = 0; b < points.length; b++) {
        if (inTree.includes(b)) continue;
        const pb = points[b];
        const dist = (pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestA = a;
          bestB = b;
        }
      }
    }

    if (bestB < 0) break;
    inTree.push(bestB);
    out.push([bestA, bestB]);
  }

  return out;
}

function carveTrail(mask, width, height, from, to, seed, stream, cfg) {
  let at = { ...from };
  const trailwidth = cfg.trailwidth ?? 2;
  const drunkenness = cfg.drunkenness ?? 0.3;
  const half = Math.floor(trailwidth / 2);

  const stamp = (p) => {
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
          mask[ny * width + nx] = LAND;
        }
      }
    }
  };

  stamp(at);

  for (let step = 0; step < TRAIL_STEPS && (at.x !== to.x || at.y !== to.y); step++) {
    const dx = to.x - at.x;
    const dy = to.y - at.y;
    const direct = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };

    const wanderStep = randomRange(seed, 'void-wander', 0, 1, stream, step);
    let stepDir = direct;
    if (wanderStep < drunkenness) {
      const axis = (randomRange(seed, 'void-axis', 0, 1, stream, step) < 0.5) ? 'x' : 'y';
      const dir = (randomRange(seed, 'void-dir', 0, 1, stream, step) < 0.5) ? -1 : 1;
      stepDir = axis === 'x' ? { x: dir, y: 0 } : { x: 0, y: dir };
    }

    const next = { x: at.x + stepDir.x, y: at.y + stepDir.y };
    if (next.x >= 0 && next.y >= 0 && next.x < width && next.y < height) {
      at = next;
      stamp(at);
    } else {
      at = { x: at.x + direct.x, y: at.y + direct.y };
      stamp(at);
    }
  }
}
