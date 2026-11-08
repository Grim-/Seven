import { noiseAt } from './Noise.js';
import { randomChance } from './Rng.js';
import { AROUND, CARDINALS, DIAGONALS, LAND, VOID, interiorLand } from './LandShape.js';

const NOISE_OFFSET = 7717;
const GAP_VOID_NEIGHBOURS = 5;
const PATH_LAND_NEIGHBOURS = 2;
const CORNER_VOID_CARDINALS = 2;
const CORNER_LAND_DIAGONALS = 2;
const SPECK_VOID_CARDINALS = 2;

export class LandShaper {
  static KIND = 'base';
  static LABEL = 'Base Land Shaper';
  static DESCRIPTION = 'Base procedural land generator using thresholded noise and cellular smoothing passes.';

  static FIELDS = [
    { id: 'enabled', group: 'Shape', label: 'Enabled', kind: 'toggle', description: 'Off gives solid land with nothing shaped at all.' },
    { id: 'threshold', group: 'Shape', label: 'Threshold', step: 0.01, min: 0, max: 1, description: 'Shape values below this are not land. Higher means less land.' },
    { id: 'scale', group: 'Shape', label: 'Scale', step: 0.005, min: 0.005, max: 0.5, description: 'Noise frequency. Lower makes bigger, broader shapes.' },
    { id: 'gaps', group: 'Tidying', label: 'Gap passes', step: 1, min: 0, max: 10, description: 'Passes trimming land nubs that poke out, sparing narrow necks.' },
    { id: 'smooth', group: 'Tidying', label: 'Smooth passes', step: 1, min: 0, max: 10, description: 'Passes filling corners to round off stair-steps.' },
    { id: 'cornerchance', group: 'Tidying', label: 'Corner chance', step: 0.05, min: 0, max: 1, description: 'Chance a corner is filled on each smooth pass.' },
    { id: 'specks', group: 'Tidying', label: 'Speck passes', step: 1, min: 0, max: 10, description: 'Passes filling single-cell pocks inside land.' },
    { id: 'margin', group: 'Tidying', label: 'Margin', step: 1, min: 0, max: 24, description: 'Cells at the world edge the tidying passes leave alone.' },
    { id: 'rim', group: 'Edge', label: 'Rim rings', step: 1, min: 0, max: 2, description: 'Rings of rock then dirt between land and void.' },
  ];

  static describe() {
    const lines = [
      `### Shaper Kind: ${this.LABEL} (\`${this.KIND}\`)`,
      this.DESCRIPTION,
      '',
      '#### Configurable Properties:'
    ];
    for (const f of this.FIELDS) {
      lines.push(`- **${f.id}** (${f.group} / ${f.label}): ${f.description || ''}`);
    }
    return lines.join('\n');
  }

  constructor(cfg = {}, reg = null, context = {}) {
    this.cfg = cfg;
    this.reg = reg;
    this.context = context;
    this.interior = interiorLand(cfg);
  }

  async mask(width, height, seed, origin = { x: 0, y: 0 }, loading = null) {
    if (this.cfg.enabled === false) {
      return { land: new Uint8Array(width * height).fill(this.interior), fields: {} };
    }

    loading?.progress?.('Land noise');
    this.prepare(width, height, seed);
    const grid = { mask: this.seeded(width, height, seed, origin), width, height, cfg: this.cfg, seed, fields: {} };

    await this.tidy(grid, loading);
    const land = await this.finish(grid, loading);
    return { land, fields: grid.fields };
  }

  prepare(width, height, seed) {
  }

  value(seed, x, y, origin = { x: 0, y: 0 }) {
    return noiseAt(seed + NOISE_OFFSET, origin.x + x, origin.y + y, this.cfg.scale ?? 0.08);
  }

  seeded(width, height, seed, origin = { x: 0, y: 0 }) {
    const mask = new Uint8Array(width * height);
    const threshold = this.cfg.threshold ?? 0.35;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        mask[y * width + x] = this.value(seed, x, y, origin) >= threshold ? LAND : VOID;
      }
    }

    return mask;
  }

  async tidy(grid, loading = null) {
    const { cfg } = grid;
    const passes = [
      ...Array.from({ length: cfg.gaps ?? 1 }, (_, pass) => ({ label: `Land gap pass ${pass + 1}`, worker: fillGaps, pass })),
      ...Array.from({ length: cfg.smooth ?? 2 }, (_, pass) => ({ label: `Land smooth pass ${pass + 1}`, worker: smoothCorners, pass })),
      ...Array.from({ length: cfg.specks ?? 1 }, (_, pass) => ({ label: `Land speck pass ${pass + 1}`, worker: dissolveSpecks, pass })),
    ];

    for (const { label, worker, pass } of passes) {
      loading?.progress?.(label);
      run(grid, worker, pass);
    }
  }

  async finish(grid, loading = null) {
    return grid.mask;
  }
}

function run(grid, worker, pass) {
  const { mask, width, height, cfg } = grid;
  const next = mask.slice();
  const margin = cfg.margin ?? 1;

  for (let y = margin; y < height - margin; y++) {
    for (let x = margin; x < width - margin; x++) {
      worker(grid, next, x, y, pass);
    }
  }

  grid.mask = next;
}

export function at(grid, x, y) {
  const { mask, width, height } = grid;
  if (x < 0 || y < 0 || x >= width || y >= height) return VOID;
  return mask[y * width + x];
}

function around(grid, x, y, dirs, want) {
  let found = 0;
  for (const [dx, dy] of dirs) if (at(grid, x + dx, y + dy) === want) found++;
  return found;
}

function isTrail(grid, x, y) {
  return around(grid, x, y, CARDINALS, LAND) <= PATH_LAND_NEIGHBOURS;
}

function fillGaps(grid, next, x, y) {
  if (at(grid, x, y) !== LAND) return;
  if (around(grid, x, y, AROUND, VOID) < GAP_VOID_NEIGHBOURS) return;
  if (isTrail(grid, x, y)) return;

  next[y * grid.width + x] = VOID;
}

function smoothCorners(grid, next, x, y, pass) {
  if (at(grid, x, y) !== VOID) return;
  if (around(grid, x, y, CARDINALS, VOID) < CORNER_VOID_CARDINALS) return;
  if (around(grid, x, y, DIAGONALS, LAND) < CORNER_LAND_DIAGONALS) return;
  if (!randomChance(grid.seed, 'land-corner', grid.cfg.cornerchance ?? 0.7, pass, y * grid.width + x)) return;

  next[y * grid.width + x] = LAND;
}

function dissolveSpecks(grid, next, x, y) {
  if (at(grid, x, y) !== VOID) return;
  if (around(grid, x, y, CARDINALS, VOID) >= SPECK_VOID_CARDINALS) return;

  next[y * grid.width + x] = LAND;
}
