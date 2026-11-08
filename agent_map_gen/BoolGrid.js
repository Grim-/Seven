export class BoolGrid {
  constructor(bounds, values = null) {
    this.bounds = bounds;
    this.values = values ?? new Uint8Array(bounds.width * bounds.height);
  }

  inBounds(cell) {
    return this.bounds.contains(cell);
  }

  offsetOf(cell) {
    return (cell.y - this.bounds.minY) * this.bounds.width + (cell.x - this.bounds.minX);
  }

  get(cell) {
    return this.inBounds(cell) && this.values[this.offsetOf(cell)] === 1;
  }

  set(cell, value) {
    if (!this.inBounds(cell)) return;
    this.values[this.offsetOf(cell)] = value ? 1 : 0;
  }

  copy() {
    return new BoolGrid(this.bounds, this.values.slice());
  }

  allCells() {
    return this.bounds.cells();
  }

  toJSON() {
    const set = [];
    for (let i = 0; i < this.values.length; i++) if (this.values[i]) set.push(i);
    return set;
  }

  static fromJSON(bounds, set = []) {
    const grid = new BoolGrid(bounds);
    for (const i of set) if (i >= 0 && i < grid.values.length) grid.values[i] = 1;
    return grid;
  }
}
