import { CellRect, cellKey, distanceSquared, flattenCells, sameCell, unflattenCells } from '../CellRect.js';

export class Corridoor {
  constructor(start, end, width = 1) {
    this.start = start;
    this.end = end;
    this.width = width;
    this.path = [];
    this.pathKeys = new Set();
    this.roomAEntryPoint = start;
    this.roomBEntryPoint = end;
  }

  get corridoorDirection() {
    return { x: this.end.x - this.start.x, y: this.end.y - this.start.y };
  }

  corridoorDirectionFrom(origin) {
    const furthestPoint = distanceSquared(origin, this.start) > distanceSquared(origin, this.end) ? this.start : this.end;
    const dx = furthestPoint.x - origin.x;
    const dy = furthestPoint.y - origin.y;
    return Math.abs(dx) > Math.abs(dy) ? { x: 1, y: 0 } : { x: 0, y: -1 };
  }

  get cellRect() {
    return new CellRect(
      Math.min(this.start.x, this.end.x),
      Math.min(this.start.y, this.end.y),
      Math.abs(this.end.x - this.start.x) + 1,
      Math.abs(this.end.y - this.start.y) + 1,
    );
  }

  getNearestCorridorCellTo(cell) {
    let nearest = this.start;
    let nearestDist = distanceSquared(this.start, cell);

    const endDist = distanceSquared(this.end, cell);
    if (endDist < nearestDist) {
      nearest = this.end;
      nearestDist = endDist;
    }

    for (const pathCell of this.path) {
      const pathDist = distanceSquared(pathCell, cell);
      if (pathDist < nearestDist) {
        nearest = pathCell;
        nearestDist = pathDist;
      }
    }

    return nearest;
  }

  cellOnPath(cell) {
    return sameCell(this.start, cell) || sameCell(this.end, cell) || this.pathKeys.has(cellKey(cell.x, cell.y));
  }

  cellIsOnCorridoor(cell) {
    return this.cellOnPath(cell);
  }

  setPath(pathCells) {
    this.path = pathCells;
    this.pathKeys = new Set(pathCells.map((cell) => cellKey(cell.x, cell.y)));
  }

  getAllCorridorCells() {
    const seen = new Set();
    const out = [];
    for (const cell of [this.start, this.end, ...this.path]) {
      const key = cellKey(cell.x, cell.y);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cell);
    }
    return out;
  }

  toJSON() {
    return {
      start: [this.start.x, this.start.y],
      end: [this.end.x, this.end.y],
      width: this.width,
      path: flattenCells(this.path),
    };
  }

  static fromJSON(data) {
    const corridoor = new Corridoor({ x: data.start[0], y: data.start[1] }, { x: data.end[0], y: data.end[1] }, data.width ?? 1);
    corridoor.setPath(unflattenCells(data.path));
    return corridoor;
  }
}
