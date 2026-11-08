import { AROUND, cellKey } from './CellRect.js';
import { noiseAt } from './Noise.js';

export class RoomShapeBase {
  constructor(def = {}) {
    this.def = def;
  }

  generateRoomCells(context, bounds, sizeMultiplier) {
    return [];
  }
}

export class RectangleRoomShape extends RoomShapeBase {
  generateRoomCells(context, bounds, sizeMultiplier) {
    const cells = [];
    const center = bounds.centerCell;
    const minSize = this.def.minsize ?? 3;
    const scaledWidth = Math.max(minSize, bounds.width);
    const scaledHeight = Math.max(minSize, bounds.height);

    const minX = center.x - Math.trunc(scaledWidth / 2);
    const maxX = center.x + Math.trunc(scaledWidth / 2);
    const minY = center.y - Math.trunc(scaledHeight / 2);
    const maxY = center.y + Math.trunc(scaledHeight / 2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const cell = { x, y };
        if (bounds.contains(cell)) cells.push(cell);
      }
    }

    return cells;
  }
}

export class CircularRoomShape extends RoomShapeBase {
  generateRoomCells(context, bounds, sizeMultiplier) {
    const center = bounds.centerCell;
    const maxRadius = Math.min(Math.trunc(bounds.width / 2), Math.trunc(bounds.height / 2)) - 1;
    const radius = Math.min(Math.trunc(maxRadius * sizeMultiplier), maxRadius);
    if (radius < 0) return [];

    const allCells = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy <= radius * radius) allCells.push({ x: center.x + dx, y: center.y + dy });
      }
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const cell of allCells) {
      minX = Math.min(minX, cell.x);
      maxX = Math.max(maxX, cell.x);
      minY = Math.min(minY, cell.y);
      maxY = Math.max(maxY, cell.y);
    }

    return allCells.filter((cell) => !(
      (cell.y === maxY && cell.x === center.x)
      || (cell.y === minY && cell.x === center.x)
      || (cell.x === maxX && cell.y === center.y)
      || (cell.x === minX && cell.y === center.y)
    ));
  }
}

const ISOLATED_NEIGHBOURS = 2;

export class BlobRoomShape extends RoomShapeBase {
  generateRoomCells(context, bounds, sizeMultiplier) {
    const irregularity = this.def.irregularity ?? 0.3;
    const seedoffset = this.def.seedoffset ?? 12345;
    const noiseoctaves = this.def.noiseoctaves ?? 3;
    const noisescale = this.def.noisescale ?? 0.1;
    const seed = context.seed + seedoffset;
    const cells = [];
    const center = bounds.centerCell;
    const baseRadiusX = (bounds.width / 2) * sizeMultiplier;
    const baseRadiusY = (bounds.height / 2) * sizeMultiplier;

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const dx = x - center.x;
        const dy = y - center.y;

        if (dx === 0 && dy === 0) {
          cells.push({ x, y });
          continue;
        }

        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);
        let noise = 0;
        let amplitude = irregularity;
        let frequency = 1;

        for (let octave = 0; octave < noiseoctaves; octave++) {
          const sampleX = Math.cos(angle * frequency) * distance * noisescale;
          const sampleY = Math.sin(angle * frequency) * distance * noisescale;
          noise += noiseAt(seed, sampleX, sampleY, 1) * amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }

        const radiusVariation = 1 + (noise - 0.5) * 2;
        const effectiveRadiusX = baseRadiusX * radiusVariation;
        const effectiveRadiusY = baseRadiusY * radiusVariation;
        const normalizedDistance = (dx * dx) / (effectiveRadiusX * effectiveRadiusX) + (dy * dy) / (effectiveRadiusY * effectiveRadiusY);

        if (normalizedDistance <= 1) cells.push({ x, y });
      }
    }

    return this.ensureMinimumSize(this.removeIsolatedCells(cells), center);
  }

  removeIsolatedCells(cells) {
    const cellSet = new Set(cells.map((cell) => cellKey(cell.x, cell.y)));
    return cells.filter((cell) => {
      let neighborCount = 0;
      for (const dir of AROUND) if (cellSet.has(cellKey(cell.x + dir.x, cell.y + dir.y))) neighborCount++;
      return neighborCount >= ISOLATED_NEIGHBOURS;
    });
  }

  ensureMinimumSize(cells, center) {
    const out = [...cells];
    const cellSet = new Set(cells.map((cell) => cellKey(cell.x, cell.y)));

    for (const dir of [{ x: 0, y: 0 }, ...AROUND]) {
      const x = center.x + dir.x;
      const y = center.y + dir.y;
      const key = cellKey(x, y);
      if (cellSet.has(key)) continue;
      cellSet.add(key);
      out.push({ x, y });
    }

    return out;
  }
}

export class CrossRoomShape extends RoomShapeBase {
  generateRoomCells(context, bounds, sizeMultiplier) {
    const cells = [];
    const seen = new Set();
    const center = bounds.centerCell;
    const minDim = Math.min(bounds.width, bounds.height);
    const armWidth = Math.max(4, Math.trunc(minDim * 0.45));
    const halfArm = Math.trunc(armWidth / 2);

    const add = (x, y) => {
      const cell = { x, y };
      const key = cellKey(x, y);
      if (!bounds.contains(cell) || seen.has(key)) return;
      seen.add(key);
      cells.push(cell);
    };

    const hArmLength = Math.trunc(Math.trunc(bounds.width / 2) * sizeMultiplier);
    for (let x = center.x - hArmLength; x <= center.x + hArmLength; x++) {
      for (let y = center.y - halfArm; y <= center.y + halfArm; y++) add(x, y);
    }

    const vArmLength = Math.trunc(Math.trunc(bounds.height / 2) * sizeMultiplier);
    for (let y = center.y - vArmLength; y <= center.y + vArmLength; y++) {
      for (let x = center.x - halfArm; x <= center.x + halfArm; x++) add(x, y);
    }

    return cells;
  }
}

export const ROOM_SHAPE_CLASSES = {
  blob: BlobRoomShape,
  circular: CircularRoomShape,
  cross: CrossRoomShape,
  rectangle: RectangleRoomShape,
  BlobRoomShape,
  CircularRoomShape,
  CrossRoomShape,
  RectangleRoomShape,
};
