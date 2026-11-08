import { BoolGrid } from '../BoolGrid.js';
import { AROUND } from '../CellRect.js';

export class DungeonGridManager {
  constructor(bounds) {
    this.bounds = bounds;
    this.dungeonGrid = new BoolGrid(bounds);
    this.protectionGrid = new BoolGrid(bounds);
  }

  inBounds(cell) {
    return this.bounds.contains(cell);
  }

  markCellAsFloor(cell) {
    this.dungeonGrid.set(cell, true);
  }

  markCellAsWall(cell) {
    this.dungeonGrid.set(cell, false);
  }

  isCellFloor(cell) {
    return this.dungeonGrid.get(cell);
  }

  markCellProtected(cell, isProtected) {
    this.protectionGrid.set(cell, isProtected);
  }

  markCellsProtected(cells, isProtected) {
    for (const cell of cells) this.protectionGrid.set(cell, isProtected);
  }

  isCellProtected(cell) {
    return this.protectionGrid.get(cell);
  }

  isIsolatedWall(cell) {
    for (const dir of AROUND) {
      const adj = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (!this.inBounds(adj) || !this.isCellFloor(adj)) return false;
    }
    return true;
  }

  toJSON() {
    return { floor: this.dungeonGrid.toJSON(), protection: this.protectionGrid.toJSON() };
  }

  static fromJSON(bounds, data = {}) {
    const manager = new DungeonGridManager(bounds);
    manager.dungeonGrid = BoolGrid.fromJSON(bounds, data.floor);
    manager.protectionGrid = BoolGrid.fromJSON(bounds, data.protection);
    return manager;
  }
}
