import { AROUND, CARDINALS, DIAGONALS } from '../CellRect.js';

const EDGE_REACH = 2;
const NEAREST_FLOOR_RADIUS = 3;

export class DungeonQueryManager {
  isNearRoomEdge(cell, grid) {
    for (let dx = -EDGE_REACH; dx <= EDGE_REACH; dx++) {
      for (let dy = -EDGE_REACH; dy <= EDGE_REACH; dy++) {
        const check = { x: cell.x + dx, y: cell.y + dy };
        if (grid.inBounds(check) && !grid.get(check)) return true;
      }
    }
    return false;
  }

  isWallNearFloor(cell, grid) {
    for (const dir of AROUND) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && grid.get(neighbor)) return true;
    }
    return false;
  }

  isCornerWall(cell, grid) {
    if (grid.get(cell)) return false;

    let diagonalFloorCount = 0;
    let cardinalWallCount = 0;

    for (const dir of CARDINALS) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && !grid.get(neighbor)) cardinalWallCount++;
    }

    for (const dir of DIAGONALS) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && grid.get(neighbor)) diagonalFloorCount++;
    }

    return cardinalWallCount >= 2 && diagonalFloorCount >= 2;
  }

  countCardinalWallNeighbors(cell, grid) {
    let count = 0;
    for (const dir of CARDINALS) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && !grid.get(neighbor)) count++;
    }
    return count;
  }

  findNearestFloor(cell, grid) {
    for (let radius = 1; radius <= NEAREST_FLOOR_RADIUS; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) > radius) continue;
          const check = { x: cell.x + dx, y: cell.y + dy };
          if (grid.inBounds(check) && grid.get(check)) return check;
        }
      }
    }
    return null;
  }

  isAdjacentToPath(cell, grid, isPathCell) {
    for (const dir of AROUND) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && grid.get(neighbor) && isPathCell(neighbor)) return true;
    }
    return false;
  }

  countFloorNeighbors(cell, grid) {
    let count = 0;
    for (const dir of AROUND) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && grid.get(neighbor)) count++;
    }
    return count;
  }
}
