import { LandShaper } from './LandShaper.js';
import { MAX_EDGE_RINGS, clearEdge, edgeRings, fillEnclosed, keepLargest } from './LandShape.js';
import { randomRange } from './Rng.js';
import { DEFAULT_SHAPER_CONFIGS } from './defaults.js';

const PURPOSE = 'land-shape';

export default class EnclosedLandShaper extends LandShaper {
  static KIND = 'enclosed';
  static LABEL = 'Enclosed Central Island';
  static DESCRIPTION = 'Generates a cohesive central island or landmass with radial distance falloff and customizable stretch angles, surrounded by open water and protective edge margins.';

  static FIELDS = [
    ...LandShaper.FIELDS,
    { id: 'falloff', group: 'Shape', label: 'Falloff', step: 0.05, min: 0, max: 4, description: 'How hard the shape is pulled in toward its centre. Higher gives a smaller, rounder landmass.' },
    { id: 'offset', group: 'Shape', label: 'Offset', step: 0.05, min: 0, max: 1, description: 'Furthest the centre can wander from the middle of the map, as a share of half its size.' },
    { id: 'stretch', group: 'Shape', label: 'Stretch', step: 0.05, min: 0, max: 4, description: 'Most the shape is squashed along a random angle, making it long or lopsided.' },
    { id: 'edgemargin', group: 'Edge', label: 'Edge margin', step: 1, min: 1, max: 48, description: 'Cells at the map edge that are always barrier.' },
    { id: 'rings', group: 'Edge', label: 'Edge rings', step: 1, min: 0, max: MAX_EDGE_RINGS, description: 'Rings between the barrier and the land.' },
  ];

  constructor(cfg = {}, reg = null, context = {}) {
    const merged = { ...DEFAULT_SHAPER_CONFIGS.enclosed, ...cfg };
    super(merged, reg, context);
  }

  prepare(width, height, seed) {
    const angle = randomRange(seed, PURPOSE, 0, Math.PI, 0, 0);
    const offset = this.cfg.offset ?? 0.2;
    const stretch = this.cfg.stretch ?? 0.5;

    this.shape = {
      cx: width / 2 + randomRange(seed, PURPOSE, -offset, offset, 0, 1) * width / 2,
      cy: height / 2 + randomRange(seed, PURPOSE, -offset, offset, 0, 2) * height / 2,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      stretch: 1 + randomRange(seed, PURPOSE, 0, stretch, 0, 3),
      width,
      height,
    };
  }

  value(seed, x, y, origin = { x: 0, y: 0 }) {
    const { cx, cy, cos, sin, stretch, width, height } = this.shape;
    if (this.inEdge(x, y, width, height)) return -Infinity;

    const dx = (x + 0.5 - cx) / (width / 2);
    const dy = (y + 0.5 - cy) / (height / 2);
    const along = (dx * cos + dy * sin) * stretch;
    const across = -dx * sin + dy * cos;
    const distance = along * along + across * across;
    const falloff = this.cfg.falloff ?? 0.4;

    return super.value(seed, x, y, origin) - falloff * distance;
  }

  inEdge(x, y, width, height) {
    const margin = this.cfg.edgemargin ?? 4;
    return x < margin || y < margin || x >= width - margin || y >= height - margin;
  }

  async finish(grid, loading = null) {
    loading?.progress?.('Land mass');
    clearEdge(grid, (x, y) => this.inEdge(x, y, grid.width, grid.height));
    keepLargest(grid);
    fillEnclosed(grid);

    loading?.progress?.('Land edge rings');
    return edgeRings(grid, this.cfg.rings ?? 2, this.interior);
  }
}
