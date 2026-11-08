import { BARRIER, LAND, VOID } from './LandShape.js';

export const DEFAULT_PALETTE = {
  void: [15, 23, 42],
  barrier: [30, 41, 59],
  rim: [51, 65, 85],
  floor: [34, 197, 94],
  floorDark: [22, 163, 74],
  wall: [15, 23, 42],
  water: [14, 116, 144],
  shallows: [56, 189, 248],
  sand: [234, 179, 8],
  stone: [180, 140, 90],
  mudstone: [120, 53, 15],
  rock: [148, 163, 184],
  river: [125, 211, 252],
  startRoom: '#22c55e',
  endRoom: '#ef4444',
  criticalRoom: '#eab308',
  normalRoom: '#38bdf8',
  roomBorder: 'rgba(255, 255, 255, 0.4)',
  corridorLine: 'rgba(250, 204, 21, 0.6)',
  text: '#ffffff',
};

export function renderMapToCanvas(canvas, mapResult, options = {}) {
  if (!canvas || !mapResult) return;

  const {
    tileSize = null,
    palette = DEFAULT_PALETTE,
    showRooms = true,
    showCorridors = true,
    showLabels = true,
  } = options;

  const width = mapResult.width;
  const height = mapResult.height;
  const isDungeon = !!mapResult.dungeon || !!mapResult.floorMask;
  const rawMask = isDungeon ? mapResult.floorMask : mapResult.mask;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const actualTileSize = tileSize ?? Math.max(1, Math.floor(Math.min(canvas.width / width, canvas.height / height)));
  canvas.width = width * actualTileSize;
  canvas.height = height * actualTileSize;

  const imgData = ctx.createImageData(width * actualTileSize, height * actualTileSize);
  const pixels = imgData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const val = rawMask[idx];
      let color;

      if (isDungeon) {
        color = val ? palette.floor : palette.wall;
      } else {
        if (val === BARRIER || val === VOID) color = palette.water;
        else if (val === 254) color = palette.shallows;
        else if (val === 253) color = palette.sand;
        else if (val >= LAND && val <= 3) {
          if (mapResult.fields?.elevation && mapResult.fields.elevation[idx] > 7) {
            const el = mapResult.fields.elevation[idx];
            color = el > 18 ? palette.rock : (el > 12 ? palette.mudstone : palette.stone);
          } else {
            color = palette.floor;
          }
        } else {
          color = palette.rim;
        }

        if (mapResult.fields?.water && !isNaN(mapResult.fields.water[idx]) && mapResult.fields.water[idx] > 50) {
          color = palette.river;
        }
      }

      for (let py = 0; py < actualTileSize; py++) {
        for (let px = 0; px < actualTileSize; px++) {
          const pixelIdx = ((y * actualTileSize + py) * (width * actualTileSize) + (x * actualTileSize + px)) * 4;
          pixels[pixelIdx] = color[0];
          pixels[pixelIdx + 1] = color[1];
          pixels[pixelIdx + 2] = color[2];
          pixels[pixelIdx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  if (isDungeon && mapResult.rooms?.length && showRooms) {
    if (showCorridors && mapResult.dungeon?.connectionManager) {
      ctx.lineWidth = Math.max(1, Math.floor(actualTileSize * 0.75));
      ctx.strokeStyle = palette.corridorLine;

      for (const conn of mapResult.dungeon.connectionManager.allConnections) {
        ctx.beginPath();
        ctx.moveTo(conn.roomA.center.x * actualTileSize, conn.roomA.center.y * actualTileSize);
        ctx.lineTo(conn.roomB.center.x * actualTileSize, conn.roomB.center.y * actualTileSize);
        ctx.stroke();
      }
    }

    for (const room of mapResult.rooms) {
      const rx = room.bounds.minX * actualTileSize;
      const ry = room.bounds.minY * actualTileSize;
      const rw = room.bounds.width * actualTileSize;
      const rh = room.bounds.height * actualTileSize;

      let roomColor = palette.normalRoom;
      if (room.type === 'start') roomColor = palette.startRoom;
      else if (room.type === 'end') roomColor = palette.endRoom;
      else if (room.isOnCriticalPath) roomColor = palette.criticalRoom;

      ctx.strokeStyle = roomColor;
      ctx.lineWidth = Math.max(1, Math.floor(actualTileSize * 0.5));
      ctx.strokeRect(rx, ry, rw, rh);

      if (showLabels && actualTileSize >= 3) {
        ctx.fillStyle = roomColor;
        ctx.font = `${Math.max(10, Math.floor(actualTileSize * 2))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = room.type === 'start' ? 'START' : room.type === 'end' ? 'END' : `R${room.id}`;
        ctx.fillText(label, (room.bounds.minX + room.bounds.width / 2) * actualTileSize, (room.bounds.minY + room.bounds.height / 2) * actualTileSize);
      }
    }
  }
}

export function pickRoomAtCanvas(canvas, mapResult, clientX, clientY, tileSize = null) {
  if (!canvas || !mapResult?.rooms?.length) return null;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const actualTileSize = tileSize ?? Math.max(1, Math.floor(Math.min(canvas.width / mapResult.width, canvas.height / mapResult.height)));
  const tileX = Math.floor(((clientX - rect.left) * scaleX) / actualTileSize);
  const tileY = Math.floor(((clientY - rect.top) * scaleY) / actualTileSize);

  return mapResult.rooms.find((room) => {
    const b = room.bounds;
    return tileX >= b.minX && tileX < b.minX + b.width && tileY >= b.minY && tileY < b.minY + b.height;
  }) ?? null;
}
