import { BARRIER, LAND, VOID } from './LandShape.js';

export class AreaKind {
  constructor(data = {}) {
    this.id = data.id || 'unnamed_area';
    this.name = data.name || this.id;
    this.kind = 'area';
    this.type = data.type || 'zone';
    this.tags = Array.isArray(data.tags) ? [...data.tags] : [];
    this.bounds = data.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    this.placeIds = Array.isArray(data.placeIds) ? [...data.placeIds] : [];
    this.transitionIds = Array.isArray(data.transitionIds) ? [...data.transitionIds] : [];
    this.properties = data.properties || {};
  }

  describe() {
    const tagList = this.tags.length ? ` [${this.tags.join(', ')}]` : '';
    return `@area:${this.id} (${this.name})${tagList}`;
  }

  toMarkdown(anchors) {
    const lines = [];
    const tagList = this.tags.length ? ` [${this.tags.join(', ')}]` : '';
    lines.push(`### @area:${this.id} - ${this.name}${tagList}`);
    lines.push(`Type: ${this.type} | Dimensions: ${this.bounds.width}x${this.bounds.height}`);

    if (this.placeIds.length) {
      lines.push('Places:');
      for (const pid of this.placeIds) {
        const place = anchors?.places?.[pid];
        if (place) {
          const occ = place.occupants.length ? ` (occupants: ${place.occupants.join(', ')})` : '';
          lines.push(`  - @place:${place.id} (${place.name}) [${place.role}]${occ}`);
        } else {
          lines.push(`  - @place:${pid}`);
        }
      }
    }

    if (this.transitionIds.length && anchors?.transitions) {
      lines.push('Exits / Transitions:');
      for (const tid of this.transitionIds) {
        const t = anchors.transitions[tid];
        if (t) {
          const target = t.toAreaId ? `@area:${t.toAreaId}` : 'exterior';
          lines.push(`  - ${t.direction || 'path'} -> ${target} via ${t.type} (${t.distance ? `dist: ${t.distance}` : 'direct'})`);
        }
      }
    }

    return lines.join('\n');
  }
}

export class PlaceKind {
  constructor(data = {}) {
    this.id = data.id || 'unnamed_place';
    this.name = data.name || this.id;
    this.kind = 'place';
    this.areaId = data.areaId || null;
    this.role = data.role || 'point_of_interest';
    this.x = Number.isInteger(data.x) ? data.x : 0;
    this.y = Number.isInteger(data.y) ? data.y : 0;
    this.clearance = data.clearance ?? 1;
    this.occupants = Array.isArray(data.occupants) ? [...data.occupants] : [];
    this.properties = data.properties || {};
  }

  describe() {
    const occ = this.occupants.length ? ` (occupants: ${this.occupants.join(', ')})` : '';
    return `@place:${this.id} (${this.name}) [${this.role}]${occ}`;
  }

  toMarkdown() {
    const occ = this.occupants.length ? `\nOccupants: ${this.occupants.join(', ')}` : '\nOccupants: none';
    return `**@place:${this.id}**\nName: ${this.name}\nRole: ${this.role}\nArea: @area:${this.areaId}${occ}`;
  }
}

export class TransitionKind {
  constructor(data = {}) {
    this.id = data.id || 'unnamed_transition';
    this.name = data.name || this.id;
    this.kind = 'transition';
    this.fromAreaId = data.fromAreaId || null;
    this.toAreaId = data.toAreaId || null;
    this.type = data.type || 'path';
    this.direction = data.direction || 'passage';
    this.distance = data.distance ?? 1;
    this.blocked = Boolean(data.blocked);
    this.keyRequired = data.keyRequired || null;
    this.properties = data.properties || {};
  }

  describe() {
    const lock = this.blocked ? ' [BLOCKED]' : '';
    return `@transition:${this.id} (@area:${this.fromAreaId} -> @area:${this.toAreaId}) via ${this.type}${lock}`;
  }

  toMarkdown() {
    const lock = this.blocked ? ` | Blocked${this.keyRequired ? ` (Requires: ${this.keyRequired})` : ''}` : '';
    return `- @transition:${this.id}: from @area:${this.fromAreaId} to @area:${this.toAreaId} [${this.direction}, ${this.type}, dist: ${this.distance}${lock}]`;
  }
}

export class SemanticMapGraph {
  constructor(data = {}) {
    this.kind = data.kind || 'generic';
    this.name = data.name || 'Unnamed World';
    this.width = data.width || 0;
    this.height = data.height || 0;
    this.areas = {};
    this.places = {};
    this.transitions = {};
    this.sheets = {};
    this.metadata = data.metadata || {};

    if (data.areas) {
      for (const [k, v] of Object.entries(data.areas)) {
        this.areas[k] = v instanceof AreaKind ? v : new AreaKind(v);
      }
    }
    if (data.places) {
      for (const [k, v] of Object.entries(data.places)) {
        this.places[k] = v instanceof PlaceKind ? v : new PlaceKind(v);
      }
    }
    if (data.transitions) {
      for (const [k, v] of Object.entries(data.transitions)) {
        this.transitions[k] = v instanceof TransitionKind ? v : new TransitionKind(v);
      }
    }
  }

  addArea(area) {
    const instance = area instanceof AreaKind ? area : new AreaKind(area);
    this.areas[instance.id] = instance;
    return instance;
  }

  addPlace(place) {
    const instance = place instanceof PlaceKind ? place : new PlaceKind(place);
    this.places[instance.id] = instance;
    if (instance.areaId && this.areas[instance.areaId]) {
      const area = this.areas[instance.areaId];
      if (!area.placeIds.includes(instance.id)) {
        area.placeIds.push(instance.id);
      }
    }
    return instance;
  }

  addTransition(trans) {
    const instance = trans instanceof TransitionKind ? trans : new TransitionKind(trans);
    this.transitions[instance.id] = instance;
    if (instance.fromAreaId && this.areas[instance.fromAreaId]) {
      const fromArea = this.areas[instance.fromAreaId];
      if (!fromArea.transitionIds.includes(instance.id)) {
        fromArea.transitionIds.push(instance.id);
      }
    }
    return instance;
  }

  bindSheet(placeId, sheetId, metadata = {}) {
    const normSheetId = sheetId.startsWith('@sheet:') ? sheetId : `@sheet:${sheetId}`;
    const normPlaceId = placeId.startsWith('@place:') ? placeId.slice(7) : placeId;

    const place = this.places[normPlaceId];
    if (!place) {
      throw new Error(`Cannot bind sheet to unknown place: "${normPlaceId}"`);
    }

    this.unbindSheet(normSheetId);

    if (!place.occupants.includes(normSheetId)) {
      place.occupants.push(normSheetId);
    }

    this.sheets[normSheetId] = {
      sheetId: normSheetId,
      placeId: normPlaceId,
      areaId: place.areaId,
      metadata,
    };

    return {
      sheetId: normSheetId,
      placeId: normPlaceId,
      areaId: place.areaId,
      x: place.x,
      y: place.y,
    };
  }

  unbindSheet(sheetId) {
    const normSheetId = sheetId.startsWith('@sheet:') ? sheetId : `@sheet:${sheetId}`;
    const existing = this.sheets[normSheetId];
    if (!existing) return null;

    const place = this.places[existing.placeId];
    if (place) {
      place.occupants = place.occupants.filter((id) => id !== normSheetId);
    }

    delete this.sheets[normSheetId];
    return existing;
  }

  resolveCoordinates(placeId) {
    const normPlaceId = placeId.startsWith('@place:') ? placeId.slice(7) : placeId;
    const place = this.places[normPlaceId];
    if (!place) return null;
    return { x: place.x, y: place.y, clearance: place.clearance };
  }

  getOccupants(targetId) {
    if (targetId.startsWith('@area:')) targetId = targetId.slice(6);
    if (targetId.startsWith('@place:')) targetId = targetId.slice(7);

    if (this.places[targetId]) {
      return [...this.places[targetId].occupants];
    }
    if (this.areas[targetId]) {
      const area = this.areas[targetId];
      const results = [];
      for (const pid of area.placeIds) {
        const p = this.places[pid];
        if (p && p.occupants?.length) {
          results.push(...p.occupants);
        }
      }
      return results;
    }
    return [];
  }

  toPlaceMarkdown(placeId) {
    if (placeId.startsWith('@place:')) placeId = placeId.slice(7);
    const place = this.places[placeId];
    if (!place) return `Unknown place: "${placeId}"`;

    const area = this.areas[place.areaId];
    const areaName = area ? area.name : 'Unknown';

    const lines = [];
    lines.push(place.name.toUpperCase());
    lines.push(`path: ${place.name} world: ${this.name} files: none`);

    if (place.occupants.length) {
      lines.push(`now: characters present here:\n${place.occupants.join('\n')}`);
    } else {
      lines.push('now: nothing happening here');
    }

    return lines.join('\n');
  }

  toAreaMarkdown(areaId) {
    if (areaId.startsWith('@area:')) areaId = areaId.slice(6);
    const area = this.areas[areaId];
    if (!area) return `Unknown area: "${areaId}"`;

    const lines = [];
    lines.push(area.name.toUpperCase());
    lines.push(`path: ${area.name} world: ${this.name}`);
    lines.push('files: none');

    const occupants = this.getOccupants(areaId);
    if (occupants.length) {
      lines.push(`now: characters present here:\n${occupants.join('\n')}`);
    } else {
      lines.push('now: nothing happening here');
    }

    lines.push('\nPlaces:');
    for (const pid of area.placeIds) {
      const p = this.places[pid];
      if (p) {
        const occ = p.occupants.length ? ` [${p.occupants.join(', ')}]` : '';
        lines.push(`- @place:${p.id} (${p.name}) - ${p.role}${occ}`);
      }
    }

    if (area.transitionIds.length) {
      lines.push('\nExits:');
      for (const tid of area.transitionIds) {
        const t = this.transitions[tid];
        if (t) {
          lines.push(`- to @area:${t.toAreaId} via ${t.type} (${t.direction})`);
        }
      }
    }

    return lines.join('\n');
  }

  toMarkdown() {
    const lines = [];
    lines.push(`# World Map: ${this.name}`);
    lines.push(`Kind: ${this.kind} | Grid: ${this.width}x${this.height}`);
    lines.push(`Total Areas: ${Object.keys(this.areas).length} | Total Places: ${Object.keys(this.places).length}`);

    if (this.metadata.entrancePlaceId) {
      lines.push(`Entry Point: @place:${this.metadata.entrancePlaceId}`);
    }
    if (this.metadata.exitPlaceId) {
      lines.push(`Objective / Exit: @place:${this.metadata.exitPlaceId}`);
    }

    lines.push('\n## Areas');
    for (const area of Object.values(this.areas)) {
      lines.push('\n' + area.toMarkdown(this));
    }

    return lines.join('\n');
  }

  describe() {
    return this.toMarkdown();
  }
}

const DUNGEON_THEME_NAMES = {
  crypt: [
    'Entrance Antechamber',
    'Hall of Pillars',
    'Mausoleum Vault',
    'Ossuary Gallery',
    'Guarded Tomb',
    'Sepulcher Crossing',
    'Crypt Alcove',
    'Inner Sanctum',
  ],
  cavern: [
    'Cave Mouth',
    'Echoing Cavern',
    'Mushroom Grotto',
    'Chasm Crossroads',
    'Flooded Hollow',
    'Stalactite Gallery',
    'Underground Lake',
    'Abyssal Chamber',
  ],
  labyrinth: [
    'Outer Gatehouse',
    'Winding Vestibule',
    'Puzzled Crossing',
    'Mirror Gallery',
    'Dead End Alcove',
    'False Vault',
    'Twisted Corridors',
    'Central Daedalus Chamber',
  ],
  standard: [
    'Dungeon Entrance',
    'Guard Room',
    'Armory Hall',
    'Grand Crossing',
    'Prison Cells',
    'Storage Vault',
    'Barracks Chamber',
    'Throne Room',
  ],
};

function getDirection(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  }
  return dy > 0 ? 'south' : 'north';
}

function discoverDungeonAnchors(result, options = {}) {
  const width = result.width;
  const height = result.height;
  const kind = result.kind || result.dungeonId || 'standard';
  const name = options.name || (kind ? `${kind.charAt(0).toUpperCase() + kind.slice(1)} Dungeon` : 'Procedural Dungeon');

  const graph = new SemanticMapGraph({
    kind: `dungeon:${kind}`,
    name,
    width,
    height,
  });

  const rooms = result.rooms || [];
  const themeNames = DUNGEON_THEME_NAMES[kind] || DUNGEON_THEME_NAMES.standard;

  let entrancePlaceId = null;
  let exitPlaceId = null;

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const isStart = room.type === 'start';
    const isEnd = room.type === 'end';
    const isCritical = Boolean(room.isOnCriticalPath);

    let areaName;
    if (isStart) {
      areaName = themeNames[0];
    } else if (isEnd) {
      areaName = themeNames[themeNames.length - 1];
    } else {
      const idx = 1 + (i % (themeNames.length - 2));
      areaName = `${themeNames[idx]} ${room.id}`;
    }

    const areaId = isStart ? 'entrance_antechamber' : isEnd ? 'inner_sanctum' : `room_${room.id}`;

    const tags = [];
    if (isStart) tags.push('entrance', 'safe');
    if (isEnd) tags.push('exit', 'boss', 'objective');
    if (isCritical) tags.push('critical_path');
    if (room.tags?.length) {
      for (const t of room.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }

    const b = room.bounds || {
      minX: room.x || 0,
      minY: room.y || 0,
      maxX: (room.x || 0) + (room.width || 1),
      maxY: (room.y || 0) + (room.height || 1),
      width: room.width || 1,
      height: room.height || 1,
    };

    const area = graph.addArea({
      id: areaId,
      name: areaName,
      type: isStart ? 'entrance' : isEnd ? 'sanctum' : 'chamber',
      tags,
      bounds: b,
      properties: {
        roomId: room.id,
        roomType: room.type,
        criticalPathIndex: room.criticalPathIndex,
      },
    });

    const centerX = room.center ? room.center.x : Math.floor((b.minX + b.maxX) / 2);
    const centerY = room.center ? room.center.y : Math.floor((b.minY + b.maxY) / 2);

    const centerPlace = graph.addPlace({
      id: `${areaId}_center`,
      name: `${areaName} Center`,
      areaId: area.id,
      role: isStart ? 'entry_portal' : isEnd ? 'boss_altar' : 'focal_point',
      x: centerX,
      y: centerY,
      clearance: Math.min(b.width, b.height) / 2,
    });

    if (isStart) entrancePlaceId = centerPlace.id;
    if (isEnd) exitPlaceId = centerPlace.id;

    if (b.width >= 5 && b.height >= 5) {
      const alcoveNorth = graph.addPlace({
        id: `${areaId}_north_alcove`,
        name: `${areaName} North Wall`,
        areaId: area.id,
        role: 'alcove',
        x: centerX,
        y: Math.max(b.minY + 1, centerY - Math.floor(b.height / 3)),
        clearance: 1,
      });

      const alcoveSouth = graph.addPlace({
        id: `${areaId}_south_alcove`,
        name: `${areaName} South Wall`,
        areaId: area.id,
        role: 'alcove',
        x: centerX,
        y: Math.min(b.maxY - 2, centerY + Math.floor(b.height / 3)),
        clearance: 1,
      });
    }
  }

  const roomToAreaId = {};
  for (const r of rooms) {
    if (r.type === 'start') roomToAreaId[r.id] = 'entrance_antechamber';
    else if (r.type === 'end') roomToAreaId[r.id] = 'inner_sanctum';
    else roomToAreaId[r.id] = `room_${r.id}`;
  }

  if (result.connections?.length) {
    for (let c = 0; c < result.connections.length; c++) {
      const conn = result.connections[c];
      const areaA = roomToAreaId[conn.roomA];
      const areaB = roomToAreaId[conn.roomB];
      if (!areaA || !areaB) continue;

      const rA = rooms.find((r) => r.id === conn.roomA);
      const rB = rooms.find((r) => r.id === conn.roomB);

      const dirAtoB = rA && rB ? getDirection(rA.center.x, rA.center.y, rB.center.x, rB.center.y) : 'passage';
      const dirBtoA = rA && rB ? getDirection(rB.center.x, rB.center.y, rA.center.x, rA.center.y) : 'passage';

      graph.addTransition({
        id: `trans_${areaA}_${areaB}`,
        name: `Passage from ${areaA} to ${areaB}`,
        fromAreaId: areaA,
        toAreaId: areaB,
        type: 'corridor',
        direction: dirAtoB,
        distance: conn.pathLength || 1,
      });

      graph.addTransition({
        id: `trans_${areaB}_${areaA}`,
        name: `Passage from ${areaB} to ${areaA}`,
        fromAreaId: areaB,
        toAreaId: areaA,
        type: 'corridor',
        direction: dirBtoA,
        distance: conn.pathLength || 1,
      });
    }
  }

  graph.metadata.entrancePlaceId = entrancePlaceId;
  graph.metadata.exitPlaceId = exitPlaceId;

  return graph;
}

function discoverOverworldAnchors(result, options = {}) {
  const width = result.width;
  const height = result.height;
  const name = options.name || 'Overworld Region';

  const graph = new SemanticMapGraph({
    kind: `overworld:${result.shaper || 'stamped'}`,
    name,
    width,
    height,
  });

  const mask = result.mask;
  const rivers = result.rivers || [];

  let landCount = 0;
  let highLandCount = 0;
  let sumLandX = 0;
  let sumLandY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = mask[y * width + x];
      if (v >= LAND && v <= 3) {
        landCount++;
        sumLandX += x;
        sumLandY += y;
        if (v > LAND) highLandCount++;
      }
    }
  }

  const avgX = landCount ? Math.floor(sumLandX / landCount) : Math.floor(width / 2);
  const avgY = landCount ? Math.floor(sumLandY / landCount) : Math.floor(height / 2);

  const centralPlains = graph.addArea({
    id: 'central_plains',
    name: 'Central Lowlands',
    type: 'plains',
    tags: ['habitable', 'central', 'open'],
    bounds: {
      minX: Math.max(0, avgX - 16),
      minY: Math.max(0, avgY - 16),
      maxX: Math.min(width, avgX + 16),
      maxY: Math.min(height, avgY + 16),
      width: 32,
      height: 32,
    },
  });

  const settlementPlace = graph.addPlace({
    id: 'the_village',
    name: 'The Village',
    areaId: centralPlains.id,
    role: 'settlement',
    x: avgX,
    y: avgY,
    clearance: 4,
  });

  const coastalArea = graph.addArea({
    id: 'coastal_reach',
    name: 'Coastal Reach',
    type: 'coast',
    tags: ['water_access', 'perimeter'],
    bounds: {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
      width,
      height,
    },
  });

  const shorePoint = graph.addPlace({
    id: 'coastal_pier',
    name: 'Fishing Pier',
    areaId: coastalArea.id,
    role: 'landmark',
    x: Math.max(1, avgX - 12),
    y: Math.max(1, avgY - 12),
    clearance: 2,
  });

  graph.addTransition({
    id: 'trans_plains_coast',
    name: 'Trail to the Coast',
    fromAreaId: centralPlains.id,
    toAreaId: coastalArea.id,
    type: 'trail',
    direction: 'west',
    distance: 12,
  });

  graph.addTransition({
    id: 'trans_coast_plains',
    name: 'Road to the Village',
    fromAreaId: coastalArea.id,
    toAreaId: centralPlains.id,
    type: 'trail',
    direction: 'east',
    distance: 12,
  });

  if (rivers.length > 0) {
    const riverArea = graph.addArea({
      id: 'river_basin',
      name: 'River Basin',
      type: 'river',
      tags: ['freshwater', 'crossing'],
      bounds: {
        minX: 0,
        minY: 0,
        maxX: width,
        maxY: height,
        width,
        height,
      },
    });

    const riverPoint = rivers[0]?.points?.[0] || { x: avgX + 8, y: avgY };
    graph.addPlace({
      id: 'river_ford',
      name: 'River Ford Crossing',
      areaId: riverArea.id,
      role: 'crossing',
      x: riverPoint.x,
      y: riverPoint.y,
      clearance: 1,
    });

    graph.addTransition({
      id: 'trans_plains_river',
      name: 'River Crossing Trail',
      fromAreaId: centralPlains.id,
      toAreaId: riverArea.id,
      type: 'ford',
      direction: 'east',
      distance: 8,
    });
  }

  graph.metadata.entrancePlaceId = settlementPlace.id;

  return graph;
}

export function discoverAnchors(mapResult, options = {}) {
  const isDungeon = Boolean(mapResult.dungeon || mapResult.floorMask || mapResult.rooms);
  if (isDungeon) {
    return discoverDungeonAnchors(mapResult, options);
  }
  return discoverOverworldAnchors(mapResult, options);
}

export function toAgentMarkdown(anchors, options = {}) {
  if (options.placeId) {
    return anchors.toPlaceMarkdown(options.placeId);
  }
  if (options.areaId) {
    return anchors.toAreaMarkdown(options.areaId);
  }
  return anchors.toMarkdown();
}
