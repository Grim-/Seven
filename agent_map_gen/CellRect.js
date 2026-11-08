const KEY_OFFSET = 32768;
const KEY_SPAN = 65536;

export const CARDINALS = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }];
export const DIAGONALS = [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
export const AROUND = [...CARDINALS, ...DIAGONALS];

export function cellKey(x, y) {
  return (x + KEY_OFFSET) * KEY_SPAN + (y + KEY_OFFSET);
}

export function cellOfKey(key) {
  return { x: Math.floor(key / KEY_SPAN) - KEY_OFFSET, y: (key % KEY_SPAN) - KEY_OFFSET };
}

export function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

export function distance(a, b) {
  return Math.sqrt(distanceSquared(a, b));
}

export function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function flattenCells(cells) {
  const out = new Array(cells.length * 2);
  cells.forEach((cell, i) => {
    out[i * 2] = cell.x;
    out[i * 2 + 1] = cell.y;
  });
  return out;
}

export function unflattenCells(flat = []) {
  const out = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i], y: flat[i + 1] });
  return out;
}

export class CellRect {
  constructor(minX, minY, width, height) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = minX + width - 1;
    this.maxY = minY + height - 1;
  }

  static fromBounds(minX, minY, maxX, maxY) {
    return new CellRect(minX, minY, maxX - minX + 1, maxY - minY + 1);
  }

  static fromCellList(cells) {
    if (!cells.length) return new CellRect(0, 0, 0, 0);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const cell of cells) {
      minX = Math.min(minX, cell.x);
      minY = Math.min(minY, cell.y);
      maxX = Math.max(maxX, cell.x);
      maxY = Math.max(maxY, cell.y);
    }
    return CellRect.fromBounds(minX, minY, maxX, maxY);
  }

  get width() {
    return this.maxX - this.minX + 1;
  }

  get height() {
    return this.maxY - this.minY + 1;
  }

  get area() {
    return this.width * this.height;
  }

  get centerCell() {
    return { x: this.minX + Math.trunc(this.width / 2), y: this.minY + Math.trunc(this.height / 2) };
  }

  contains(cell) {
    return cell.x >= this.minX && cell.x <= this.maxX && cell.y >= this.minY && cell.y <= this.maxY;
  }

  expandedBy(amount) {
    return CellRect.fromBounds(this.minX - amount, this.minY - amount, this.maxX + amount, this.maxY + amount);
  }

  cells() {
    const out = [];
    for (let x = this.minX; x <= this.maxX; x++) {
      for (let y = this.minY; y <= this.maxY; y++) out.push({ x, y });
    }
    return out;
  }

  toJSON() {
    return { minX: this.minX, minY: this.minY, width: this.width, height: this.height };
  }

  static fromJSON(data) {
    return new CellRect(data.minX, data.minY, data.width, data.height);
  }
}
