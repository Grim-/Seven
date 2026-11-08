import { BARRIER, LAND, VOID } from './LandShape.js';
import { WANG_TERRAIN_DATA } from './terrainWangData.js';

export const WANG_DUNGEON_ROCK = {
  '0000': 15653,
  '0001': 13264,
  '0010': 13256,
  '0011': 13254,
  '0100': 13216,
  '0101': 13214,
  '0110': 13206,
  '0111': 13204,
  '1000': 13024,
  '1001': 13022,
  '1010': 13014,
  '1011': 13012,
  '1100': 12978,
  '1101': 12976,
  '1110': 12970,
  '1111': 15646,
};

export const WANG_OVERWORLD_WATER_GRASS = {
  '0000': 15748,
  '0001': 16628,
  '0010': 16630,
  '0011': 16634,
  '0100': 16629,
  '0101': 16632,
  '0110': 16635,
  '0111': 16637,
  '1000': 16631,
  '1001': 16636,
  '1010': 16633,
  '1011': 16638,
  '1100': 16639,
  '1101': 16640,
  '1110': 16641,
  '1111': 15705,
};

export const WANG_OVERWORLD_GRASS_DIRT = {
  '0000': 15657,
  '0001': 294,
  '0010': 309,
  '0011': 312,
  '0100': 399,
  '0101': 402,
  '0110': 417,
  '0111': 420,
  '1000': 937,
  '1001': 940,
  '1010': 955,
  '1011': 958,
  '1100': 1045,
  '1101': 1048,
  '1110': 1063,
  '1111': 15632,
};

export const WANG_OVERWORLD_SAND_WATER = {
  '0000': 15705,
  '0001': 13939,
  '0010': 13942,
  '0011': 13947,
  '0100': 13941,
  '0101': 13944,
  '0110': 13949,
  '0111': 13951,
  '1000': 13940,
  '1001': 13946,
  '1010': 13948,
  '1011': 13952,
  '1100': 13945,
  '1101': 13950,
  '1110': 13953,
  '1111': 15670,
};

const DEFAULT_INDEX = {};
WANG_TERRAIN_DATA.colors.forEach((c, i) => { DEFAULT_INDEX[c] = i; });

function fastHash(seed, x, y) {
  let h = (seed ^ (x * 374761393) ^ (y * 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function resolveDungeonTiles(dungeonResult, options = {}) {
  const { firstGid = 1, wallGid = 15653, floorGid = 15646 } = options;
  const width = dungeonResult.width;
  const height = dungeonResult.height;
  const mask = dungeonResult.floorMask || dungeonResult.mask;

  const groundTiles = new Array(width * height);
  const collisionTiles = new Array(width * height);

  const getCell = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return mask[y * width + x] ? 1 : 0;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const own = getCell(x, y);

      const tl = x > 0 && y > 0 ? getCell(x - 1, y - 1) : (x > 0 ? getCell(x - 1, y) : (y > 0 ? getCell(x, y - 1) : own));
      const tr = y > 0 ? getCell(x, y - 1) : own;
      const bl = x > 0 ? getCell(x - 1, y) : own;
      const br = own;

      const key = `${tl}${tr}${bl}${br}`;
      const tileId = WANG_DUNGEON_ROCK[key] ?? (own ? floorGid : wallGid);

      groundTiles[idx] = tileId + firstGid;
      collisionTiles[idx] = own ? 0 : 1;
    }
  }

  return { groundTiles, collisionTiles, width, height };
}

export function resolveOverworldTiles(mapResult, options = {}) {
  const { firstGid = 1, wangData = null, xml = null } = options;
  const width = mapResult.width;
  const height = mapResult.height;
  const mask = mapResult.mask;
  const seed = mapResult.seed ?? 12345;
  const fields = mapResult.fields ?? {};

  let activeData = WANG_TERRAIN_DATA;
  let activeIndex = DEFAULT_INDEX;

  if (xml) {
    const parsed = parseWangTileset(xml);
    if (parsed) {
      activeData = {
        colors: parsed.colors,
        byCorners: Object.fromEntries(parsed.byCorners),
        solid: Object.fromEntries(parsed.solid),
      };
      activeIndex = parsed.index;
    }
  } else if (wangData) {
    activeData = wangData;
    activeIndex = {};
    activeData.colors.forEach((c, i) => { activeIndex[c] = i; });
  }

  const byCorners = activeData.byCorners;
  const solid = activeData.solid;

  const groundTiles = new Array(width * height);
  const collisionTiles = new Array(width * height);

  const getTerrainAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 'Water_Sea';
    const v = mask[y * width + x];
    if (v === BARRIER || v === VOID) return 'Water_Sea';
    if (v === 254) return 'Water_Shallows_Sand';
    if (v === 253) return 'Sand';

    if (fields.water && !isNaN(fields.water[y * width + x])) {
      const w = fields.water[y * width + x];
      if (w >= 85) return 'Water';
      if (w >= 65) return 'Water_Shallows_Dirt';
      return 'Dirt_Tan';
    }

    if (fields.elevation) {
      const el = fields.elevation[y * width + x];
      if (el > 18) return 'Rock_Gray';
      if (el > 12) return 'Mudstone_Brown';
      if (el > 7) return 'Stone_Tan';
    }

    if (v === 2) return 'Dirt_Tan';

    const h = (fastHash(seed, x, y) % 1000) / 1000;
    if (h < 0.15) return 'Dirt_Tan';
    if (h < 0.28) return 'Grass_Light';
    if (h < 0.35) return 'Dirt_Brown';
    return 'Grass';
  };

  const cornerKey = (corners) => corners.map((n) => activeIndex[n] ?? -1).join(',');

  const pickTile = (corners, own, x, y) => {
    const key = cornerKey(corners);
    const exact = byCorners[key];
    if (exact && exact.length > 0) {
      const h = fastHash(seed, x, y);
      return exact[h % exact.length];
    }

    const foreign = corners.map((name, i) => (name === own ? -1 : i)).filter((i) => i >= 0);
    const subsets = [];
    for (let maskBit = 1; maskBit < 1 << foreign.length; maskBit++) {
      subsets.push(foreign.filter((_, bit) => maskBit & (1 << bit)));
    }
    subsets.sort((a, b) => a.length - b.length);

    for (const replace of subsets) {
      const rCorners = corners.map((name, i) => (replace.includes(i) ? own : name));
      const rKey = cornerKey(rCorners);
      const rMatches = byCorners[rKey];
      if (rMatches && rMatches.length > 0) {
        const h = fastHash(seed, x, y);
        return rMatches[h % rMatches.length];
      }
    }

    const ownIdx = activeIndex[own];
    const solids = solid[ownIdx];
    if (solids && solids.length > 0) {
      const h = fastHash(seed, x, y);
      return solids[h % solids.length];
    }

    return 0;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const own = getTerrainAt(x, y);

      const tl = getTerrainAt(x - 1, y - 1);
      const tr = getTerrainAt(x, y - 1);
      const bl = getTerrainAt(x - 1, y);
      const br = own;

      const tileId = pickTile([tl, tr, bl, br], own, x, y);

      groundTiles[idx] = tileId + firstGid;
      const isBlocking = own === 'Water_Sea' || own === 'Water' || own === 'Water_Deep' || own === 'Lava';
      collisionTiles[idx] = isBlocking ? 1 : 0;
    }
  }

  return { groundTiles, collisionTiles, width, height };
}

export function parseWangTileset(xml) {
  const wangsetMatch = xml.match(/<wangset[\s\S]*?<\/wangset>/);
  if (!wangsetMatch) return null;
  const ws = wangsetMatch[0];
  const colors = [...ws.matchAll(/<wangcolor name="([^"]+)" color="([^"]+)" tile="([^"]+)"/g)].map((m) => m[1]);
  const index = {};
  colors.forEach((c, i) => { index[c] = i; });

  const byCorners = new Map();
  const solid = new Map();
  const tiles = [...ws.matchAll(/<wangtile tileid="([^"]+)" wangid="([^"]+)"/g)];
  for (const t of tiles) {
    const id = Number(t[1]);
    const wang = t[2].split(',').map((n) => Number(n.trim()));
    if (wang.length !== 8) continue;
    const parts = [wang[7] - 1, wang[1] - 1, wang[5] - 1, wang[3] - 1];
    const key = parts.map((p) => (p < 0 ? '' : p)).join(',');
    if (!byCorners.has(key)) byCorners.set(key, []);
    byCorners.get(key).push(id);
    if (parts[0] >= 0 && new Set(parts).size === 1) {
      if (!solid.has(parts[0])) solid.set(parts[0], []);
      solid.get(parts[0]).push(id);
    }
  }

  function cornerKey(names) {
    return names.map((n) => (n == null ? -1 : index[n] ?? -1)).join(',');
  }

  function solidTile(name) {
    const i = index[name];
    if (i === undefined) return null;
    const fills = solid.get(i);
    return fills && fills.length ? fills[0] : null;
  }

  function bestTileForCorners(cornerNames, own) {
    const exact = byCorners.get(cornerKey(cornerNames));
    if (exact && exact.length) return exact[0];
    const foreign = cornerNames.map((name, i) => (name === own ? -1 : i)).filter((i) => i >= 0);
    const subsets = [];
    for (let mask = 1; mask < 1 << foreign.length; mask++) {
      subsets.push(foreign.filter((_, bit) => mask & (1 << bit)));
    }
    subsets.sort((a, b) => a.length - b.length);
    for (const replace of subsets) {
      const names = cornerNames.map((name, i) => (replace.includes(i) ? own : name));
      const found = byCorners.get(cornerKey(names));
      if (found && found.length) return found[0];
    }
    return solidTile(own);
  }

  return { colors, index, byCorners, solid, solidTile, bestTileForCorners };
}
