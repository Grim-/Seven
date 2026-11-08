import StampedLandShaper from './StampedLandShaper.js';
import { LAND, VOID, regionsOf } from './LandShape.js';
import { CellRect } from './CellRect.js';
import { BspConfig, BspUtility } from './BspUtility.js';
import { BspNode } from './BspNode.js';
import { Rng, randomRange } from './Rng.js';
import { DEFAULT_SHAPER_CONFIGS } from './defaults.js';

const PURPOSE = 'land-archipelago';
const MIN_SCALE = 0.1;
const MAX_SCALE = 2;

export default class ArchipelagoLandShaper extends StampedLandShaper {
  static KIND = 'archipelago';
  static LABEL = 'Archipelago Island Chain';
  static DESCRIPTION = 'Splits the world into separate island parcels using space partitioning (BSP). Produces isolated islands with guaranteed open sea buffers between them, with support for a large primary island and secondary atolls.';

  static FIELDS = [
    ...StampedLandShaper.FIELDS,
    { id: 'minislands', group: 'Islands', label: 'Min islands', step: 1, min: 1, max: 64, description: 'Fewest islands the map is split into.' },
    { id: 'maxislands', group: 'Islands', label: 'Max islands', step: 1, min: 1, max: 64, description: 'Most islands the map is split into.' },
    { id: 'minleaf', group: 'Split', label: 'Min island area', step: 1, min: 8, max: 512, description: 'Smallest side, in tiles, of the area an island is given when the map is split.' },
    { id: 'splitbuffer', group: 'Split', label: 'Split buffer', step: 0.5, min: 1, max: 16, description: 'Divides the smallest area side to get how far a split must stay from an area edge.' },
    { id: 'maxelongation', group: 'Split', label: 'Max elongation', step: 0.1, min: 1, max: 6, description: 'How long and thin an area can get before it is always split across its long side.' },
    { id: 'minsplit', group: 'Split', label: 'Min split', step: 0.05, min: 0.1, max: 0.9, description: 'Earliest point along an area a split can fall, as a share of its length.' },
    { id: 'maxsplit', group: 'Split', label: 'Max split', step: 0.05, min: 0.1, max: 0.9, description: 'Latest point along an area a split can fall, as a share of its length.' },
    { id: 'splitattempts', group: 'Split', label: 'Split attempts', step: 1, min: 0, max: 500, description: 'Extra splits tried when the first pass makes too few areas.' },
    { id: 'islandmargin', group: 'Islands', label: 'Island margin', step: 1, min: 1, max: 64, description: 'Tiles of sea kept inside the edge of each island area so neighbouring islands never touch.' },
    { id: 'islandspan', group: 'Islands', label: 'Island span', step: 1, min: 8, max: 1024, description: 'Area side, in tiles, at which an island uses the shape count and sizes as set.' },
    { id: 'minislandsize', group: 'Islands', label: 'Min island size', step: 1, min: 0, max: 100000, description: 'Islands with fewer land tiles than this are sunk.' },
    { id: 'mainisland', group: 'Islands', label: 'Main island', kind: 'toggle', description: 'Set aside one large area for a main island before the rest of the map is split.' },
    { id: 'mainshare', group: 'Islands', label: 'Main share', step: 0.05, min: 0.2, max: 0.9, description: 'Share of the map long side the main island area takes.' },
    { id: 'riversperisland', group: 'Rivers', label: 'Rivers per island', kind: 'toggle', description: 'On rolls the river count for every island.' },
  ];

  constructor(cfg = {}, reg = null, context = {}) {
    const merged = { ...DEFAULT_SHAPER_CONFIGS.archipelago, ...cfg };
    super(merged, reg, context);
  }

  seeded(width, height, seed) {
    const mask = new Uint8Array(width * height);
    this.areas = this.splitMap(width, height, seed);

    this.areas.forEach((area, island) => {
      const margin = this.cfg.islandmargin ?? 8;
      const inner = CellRect.fromBounds(
        area.minX + margin,
        area.minY + margin,
        area.maxX - margin,
        area.maxY - margin,
      );
      if (inner.width < 3 || inner.height < 3) return;

      const span = this.cfg.islandspan ?? 120;
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(inner.width, inner.height) / span));
      this.stampIsland(mask, width, height, seed, inner, island, scale);
    });

    return mask;
  }

  splitMap(width, height, seed) {
    const cfg = this.cfg;
    const margin = cfg.edgemargin ?? 6;
    const whole = new CellRect(margin, margin, width - margin * 2, height - margin * 2);
    const minIslands = cfg.minislands ?? 2;
    const maxIslands = cfg.maxislands ?? 3;
    const count = Math.max(1, Math.round(randomRange(seed, PURPOSE, minIslands, Math.max(minIslands, maxIslands), 0, 0)));
    const rng = new Rng(seed, Rng.stream(PURPOSE));
    const config = new BspConfig({
      minRoomSize: cfg.minleaf ?? 60,
      splitBufferRatio: cfg.splitbuffer ?? 4,
      maxElongationRatio: cfg.maxelongation ?? 2,
      minSplitPosition: Math.min(cfg.minsplit ?? 0.35, cfg.maxsplit ?? 0.65),
      maxSplitPosition: Math.max(cfg.minsplit ?? 0.35, cfg.maxsplit ?? 0.65),
      maxSplitAttempts: cfg.splitattempts ?? 50,
    });

    if (!cfg.mainisland || count === 1) return this.leaves(rng, whole, count, config);

    const across = whole.width >= whole.height;
    const mainShare = cfg.mainshare ?? 0.5;
    const cut = Math.trunc((across ? whole.width : whole.height) * mainShare);
    const main = across
      ? new CellRect(whole.minX, whole.minY, cut, whole.height)
      : new CellRect(whole.minX, whole.minY, whole.width, cut);
    const rest = across
      ? CellRect.fromBounds(whole.minX + cut, whole.minY, whole.maxX, whole.maxY)
      : CellRect.fromBounds(whole.minX, whole.minY + cut, whole.maxX, whole.maxY);

    return [main, ...this.leaves(rng, rest, count - 1, config)];
  }

  leaves(rng, area, count, config) {
    if (area.width <= 0 || area.height <= 0 || count <= 0) return [];
    const root = new BspNode(area);
    if (count > 1) BspUtility.attemptToReachTargetRoomCount(rng, root, [root], count, config);
    return BspUtility.getAllLeafNodes(root).map((node) => node.rect);
  }

  areaOf(x, y) {
    return this.areas.findIndex((area) => area.contains({ x, y }));
  }

  keepLand(grid) {
    const { mask, width, height, cfg } = grid;
    const largest = new Map();
    const regions = regionsOf(mask, width, height);
    const minSize = cfg.minislandsize ?? 60;

    for (const region of regions) {
      const first = region[0];
      const island = this.areaOf(first % width, Math.floor(first / width));
      const held = largest.get(island);
      if (island >= 0 && region.length >= minSize && (!held || region.length > held.length)) largest.set(island, region);
    }

    const keep = new Set();
    for (const region of largest.values()) {
      for (const cell of region) keep.add(cell);
    }

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === LAND && !keep.has(i)) mask[i] = VOID;
    }
  }

  rivers(grid, coast, elevation, water) {
    if (!this.cfg.riversperisland) {
      super.rivers(grid, coast, elevation, water);
      return;
    }

    this.areas.forEach((area, island) => {
      this.riversWithin(grid, coast, elevation, water, area, this.rollRivers(grid.seed, island), island);
    });
  }
}
