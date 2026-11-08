import { CARDINALS, cellKey } from '../CellRect.js';

export class CorridorPathBase {
  constructor(def = {}) {
    this.def = def;
    this.smoothCorners = true;
  }

  fitnessTest(context, start, end) {
    return true;
  }

  generatePath(context, start, end) {
    return [];
  }

  generatePathWithWidth(context, start, end, width = 1) {
    const spinePath = this.generatePath(context, start, end);
    if (width <= 1) return spinePath;

    const widePath = this.expandPathToWidth(spinePath, width);
    return this.smoothCorners ? this.smoothCornerCells(widePath) : widePath;
  }

  addPointsAlongLine(path, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      path.push({ x: start.x + roundHalfEven(dx * t), y: start.y + roundHalfEven(dy * t) });
    }
  }

  expandPathToWidth(spinePath, width) {
    if (width <= 1) return spinePath;

    const expanded = new Map(spinePath.map((cell) => [cellKey(cell.x, cell.y), cell]));
    const add = (x, y) => {
      const key = cellKey(x, y);
      if (!expanded.has(key)) expanded.set(key, { x, y });
    };

    spinePath.forEach((cell, index) => {
      const localDirection = this.getLocalDirection(index, spinePath);
      const perpendicular = { x: -localDirection.y, y: localDirection.x };
      const lengthSquared = perpendicular.x ** 2 + perpendicular.y ** 2;
      if (lengthSquared <= 0) return;

      const length = Math.sqrt(lengthSquared);
      const normal = { x: roundHalfEven(perpendicular.x / length), y: roundHalfEven(perpendicular.y / length) };
      const additionalCells = width - 1;
      const leftSide = Math.trunc(additionalCells / 2);
      const rightSide = additionalCells - leftSide;

      for (let i = 1; i <= leftSide; i++) add(cell.x - i * normal.x, cell.y - i * normal.y);
      for (let i = 1; i <= rightSide; i++) add(cell.x + i * normal.x, cell.y + i * normal.y);
    });

    return [...expanded.values()];
  }

  getLocalDirection(index, path) {
    const current = path[index];

    if (index === 0 && path.length > 1) {
      return { x: path[1].x - current.x, y: path[1].y - current.y };
    }
    if (index === path.length - 1 && path.length > 1) {
      return { x: current.x - path[index - 1].x, y: current.y - path[index - 1].y };
    }
    if (index > 0 && index < path.length - 1) {
      const toPrev = { x: current.x - path[index - 1].x, y: current.y - path[index - 1].y };
      const toNext = { x: path[index + 1].x - current.x, y: path[index + 1].y - current.y };
      return { x: Math.trunc((toPrev.x + toNext.x) / 2), y: Math.trunc((toPrev.y + toNext.y) / 2) };
    }
    return { x: 0, y: 1 };
  }

  smoothCornerCells(path) {
    const pathKeys = new Set(path.map((cell) => cellKey(cell.x, cell.y)));
    const smoothed = new Map(path.map((cell) => [cellKey(cell.x, cell.y), cell]));

    for (const cell of path) {
      let connectionCount = 0;
      for (const dir of CARDINALS) if (pathKeys.has(cellKey(cell.x + dir.x, cell.y + dir.y))) connectionCount++;
      if (connectionCount < 2) continue;

      for (const dir of CARDINALS) {
        const key = cellKey(cell.x + dir.x, cell.y + dir.y);
        if (!smoothed.has(key)) smoothed.set(key, { x: cell.x + dir.x, y: cell.y + dir.y });
      }
    }

    return [...smoothed.values()];
  }
}

export function roundHalfEven(value) {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function distinctCells(cells) {
  const seen = new Set();
  const out = [];
  for (const cell of cells) {
    const key = cellKey(cell.x, cell.y);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}
