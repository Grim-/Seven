import { BARRIER, LAND, VOID } from './LandShape.js';
import { resolveDungeonTiles, resolveOverworldTiles } from './WangResolver.js';

export function exportToTmj(mapResult, options = {}) {
  const {
    tileWidth = 32,
    tileHeight = 32,
    tilesetSource = 'terrain-map-v7.tsx',
    firstGid = 1,
    wallGid,
    floorGid,
    waterGid,
    infinite = false,
    chunkSize = 16,
    useWang = true,
  } = options;

  const width = mapResult.width;
  const height = mapResult.height;
  const isDungeon = !!mapResult.dungeon || !!mapResult.floorMask;
  const rawMask = isDungeon ? mapResult.floorMask : mapResult.mask;

  let groundData;
  let collisionData;

  const isCustomGid = wallGid !== undefined || floorGid !== undefined || waterGid !== undefined;

  if (useWang && !isCustomGid) {
    if (isDungeon) {
      const resolved = resolveDungeonTiles(mapResult, { firstGid });
      groundData = resolved.groundTiles;
      collisionData = resolved.collisionTiles;
    } else {
      const resolved = resolveOverworldTiles(mapResult, { firstGid });
      groundData = resolved.groundTiles;
      collisionData = resolved.collisionTiles;
    }
  } else {
    const fGid = floorGid ?? 2;
    const wGid = wallGid ?? 1;
    const wtGid = waterGid ?? 3;

    groundData = new Array(width * height);
    collisionData = new Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const val = rawMask[idx];

        if (isDungeon) {
          if (val) {
            groundData[idx] = fGid;
            collisionData[idx] = 0;
          } else {
            groundData[idx] = wGid;
            collisionData[idx] = 1;
          }
        } else {
          if (val === BARRIER || val === VOID) {
            groundData[idx] = wtGid;
            collisionData[idx] = 1;
          } else if (val >= LAND && val <= 3) {
            groundData[idx] = fGid;
            collisionData[idx] = 0;
          } else {
            groundData[idx] = wGid;
            collisionData[idx] = 0;
          }
        }
      }
    }
  }

  const layers = [];
  let nextLayerId = 1;
  let nextObjectId = 1;

  if (infinite) {
    layers.push({
      id: nextLayerId++,
      name: 'Ground',
      type: 'tilelayer',
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      width,
      height,
      startx: 0,
      starty: 0,
      chunks: buildChunks(groundData, width, height, chunkSize),
    });

    layers.push({
      id: nextLayerId++,
      name: 'Collision',
      type: 'tilelayer',
      visible: false,
      opacity: 1,
      x: 0,
      y: 0,
      width,
      height,
      startx: 0,
      starty: 0,
      chunks: buildChunks(collisionData, width, height, chunkSize),
    });
  } else {
    layers.push({
      id: nextLayerId++,
      name: 'Ground',
      type: 'tilelayer',
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      width,
      height,
      data: groundData,
    });

    layers.push({
      id: nextLayerId++,
      name: 'Collision',
      type: 'tilelayer',
      visible: false,
      opacity: 1,
      x: 0,
      y: 0,
      width,
      height,
      data: collisionData,
    });
  }

  if (isDungeon && mapResult.rooms?.length) {
    const objects = [];

    for (const room of mapResult.rooms) {
      const b = room.bounds;
      const props = [
        { name: 'roomId', type: 'int', value: room.id },
        { name: 'roomType', type: 'string', value: room.type },
        { name: 'tags', type: 'string', value: room.tags.join(',') },
        { name: 'criticalPath', type: 'bool', value: room.isOnCriticalPath },
        { name: 'criticalPathIndex', type: 'int', value: room.criticalPathIndex },
      ];

      objects.push({
        id: nextObjectId++,
        name: `Room_${room.id}`,
        type: room.type === 'start' ? 'entrance' : room.type === 'end' ? 'exit' : 'area',
        x: b.minX * tileWidth,
        y: b.minY * tileHeight,
        width: b.width * tileWidth,
        height: b.height * tileHeight,
        visible: true,
        properties: props,
      });

      if (room.type === 'start' || room.type === 'end') {
        objects.push({
          id: nextObjectId++,
          name: room.type === 'start' ? 'Dungeon_Entrance' : 'Dungeon_Exit',
          type: 'interactor',
          x: room.center.x * tileWidth,
          y: room.center.y * tileHeight,
          point: true,
          visible: true,
          properties: [
            { name: 'action', type: 'string', value: 'switch_map' },
            { name: 'role', type: 'string', value: room.type },
          ],
        });
      }
    }

    if (mapResult.connections?.length) {
      for (const conn of mapResult.connections) {
        objects.push({
          id: nextObjectId++,
          name: `Corridor_${conn.roomA}_${conn.roomB}`,
          type: 'corridor',
          point: true,
          visible: true,
          properties: [
            { name: 'roomA', type: 'int', value: conn.roomA },
            { name: 'roomB', type: 'int', value: conn.roomB },
            { name: 'length', type: 'int', value: conn.pathLength },
          ],
        });
      }
    }

    layers.push({
      id: nextLayerId++,
      name: 'Structures',
      type: 'objectgroup',
      draworder: 'topdown',
      visible: true,
      opacity: 1,
      x: 0,
      y: 0,
      objects,
    });
  }

  const tmj = {
    compressionlevel: -1,
    height,
    width,
    infinite,
    layers,
    nextlayerid: nextLayerId,
    nextobjectid: nextObjectId,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: tileHeight,
    tilewidth: tileWidth,
    type: 'map',
    version: '1.10',
    tilesets: [
      {
        firstgid: firstGid,
        source: tilesetSource,
      },
    ],
  };

  return tmj;
}

export function exportToTmjString(mapResult, options = {}) {
  return JSON.stringify(exportToTmj(mapResult, options), null, 2);
}

function buildChunks(data, mapWidth, mapHeight, chunkSize) {
  const chunks = [];
  const chunksX = Math.ceil(mapWidth / chunkSize);
  const chunksY = Math.ceil(mapHeight / chunkSize);

  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const chunkX = cx * chunkSize;
      const chunkY = cy * chunkSize;
      const chunkData = new Array(chunkSize * chunkSize).fill(0);

      for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
          const mx = chunkX + x;
          const my = chunkY + y;
          if (mx < mapWidth && my < mapHeight) {
            chunkData[y * chunkSize + x] = data[my * mapWidth + mx];
          }
        }
      }

      chunks.push({
        x: chunkX,
        y: chunkY,
        width: chunkSize,
        height: chunkSize,
        data: chunkData,
      });
    }
  }

  return chunks;
}
