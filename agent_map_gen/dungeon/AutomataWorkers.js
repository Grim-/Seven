import { AROUND, CARDINALS } from '../CellRect.js';

const PATH_FLOOR_NEIGHBOURS = 2;

export class CellularAutomataWorker {
  constructor(def = {}) {
    this.def = def;
  }

  apply(context, dungeonGrid, currentState) {}

  canAffectCell(context, cell) {
    const { bounds, mapMargin, dungeon } = context;
    if (cell.x - bounds.minX < mapMargin || cell.y - bounds.minY < mapMargin) return false;
    if (bounds.maxX - cell.x < mapMargin || bounds.maxY - cell.y < mapMargin) return false;
    return !dungeon.gridManager.isCellProtected(cell);
  }

  countWallNeighbors(cell, grid) {
    let count = 0;
    for (const dir of CARDINALS) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && !grid.get(neighbor)) count++;
    }
    return count;
  }

  isPathCell(cell, grid) {
    if (!grid.get(cell)) return false;

    let cardinalFloorNeighbors = 0;
    for (const dir of CARDINALS) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && grid.get(neighbor)) cardinalFloorNeighbors++;
    }
    return cardinalFloorNeighbors <= PATH_FLOOR_NEIGHBOURS;
  }
}

export class CAWorker_SmoothCorners extends CellularAutomataWorker {
  apply(context, dungeonGrid, currentState) {
    const query = context.dungeon.queryManager;

    for (const cell of dungeonGrid.allCells()) {
      if (!this.canAffectCell(context, cell)) continue;
      if (currentState.get(cell)) continue;
      if (query.isCornerWall(cell, currentState) && context.rng.chance(this.def.randomchance ?? 0.7)) dungeonGrid.set(cell, true);
    }
  }
}

export class CAWorker_FillSmallGaps extends CellularAutomataWorker {
  apply(context, dungeonGrid, currentState) {
    const dungeon = context.dungeon;
    const isCorridorCell = (c) => dungeon.connectionManager.allConnections.some((conn) => conn.corridoor?.cellIsOnCorridoor(c));

    for (const cell of dungeonGrid.allCells()) {
      if (!this.canAffectCell(context, cell)) continue;
      if (!currentState.get(cell)) continue;
      if (isCorridorCell(cell)) continue;
      if (this.isSmallFloorGap(cell, currentState) && !this.isPathCell(cell, currentState)) dungeonGrid.set(cell, false);
    }
  }

  isSmallFloorGap(cell, grid) {
    if (!grid.get(cell)) return false;

    let wallCount = 0;
    for (const dir of AROUND) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      if (grid.inBounds(neighbor) && !grid.get(neighbor)) wallCount++;
    }
    return wallCount >= (this.def.wallcount ?? 5);
  }
}

export class CAWorker_RemoveIslands extends CellularAutomataWorker {
  apply(context, dungeonGrid, currentState) {
    const query = context.dungeon.queryManager;

    for (const cell of dungeonGrid.allCells()) {
      if (!this.canAffectCell(context, cell)) continue;
      if (currentState.get(cell)) continue;
      if (query.countCardinalWallNeighbors(cell, currentState) < (this.def.neighbourkillcount ?? 2)) dungeonGrid.set(cell, true);
    }
  }
}

export class CAWorker_NaturalWalls extends CellularAutomataWorker {
  apply(context, dungeonGrid, currentState) {
    const birththreshold = this.def.birththreshold ?? 4;
    const deaththreshold = this.def.deaththreshold ?? 3;
    const randomchance = this.def.randomchance ?? 0.5;
    const growthchancefactor = this.def.growthchancefactor ?? 0.5;
    const query = context.dungeon.queryManager;
    const rng = context.rng;

    for (const cell of dungeonGrid.allCells()) {
      if (!this.canAffectCell(context, cell)) continue;

      const floor = currentState.get(cell);
      if (floor && (!query.isNearRoomEdge(cell, currentState) || this.isPathCell(cell, currentState))) continue;

      const wallNeighbors = this.countWallNeighbors(cell, currentState);

      if (floor) {
        if (wallNeighbors >= birththreshold && rng.chance(randomchance)) dungeonGrid.set(cell, false);
      } else if (wallNeighbors <= deaththreshold && rng.chance(randomchance * growthchancefactor)) {
        if (query.countFloorNeighbors(cell, currentState) >= 1) dungeonGrid.set(cell, true);
      }
    }
  }
}

export class CAWorker_AddAlcoves extends CellularAutomataWorker {
  apply(context, dungeonGrid, currentState) {
    for (const cell of dungeonGrid.allCells()) {
      if (!this.canAffectCell(context, cell)) continue;
      if (currentState.get(cell)) continue;
      if (this.isSuitableForAlcove(cell, currentState) && context.rng.chance(this.def.randomchance ?? 0.3)) dungeonGrid.set(cell, true);
    }
  }

  isSuitableForAlcove(cell, grid) {
    if (grid.get(cell)) return false;

    for (const dir of CARDINALS) {
      const neighbor = { x: cell.x + dir.x, y: cell.y + dir.y };
      const twoAway = { x: cell.x + dir.x * 2, y: cell.y + dir.y * 2 };
      if (grid.inBounds(neighbor) && grid.inBounds(twoAway) && grid.get(neighbor) && grid.get(twoAway)) return true;
    }
    return false;
  }
}

export class CAWorker_CaveDecorator extends CellularAutomataWorker {
  apply(context, dungeonGrid, currentState) {
    const query = context.dungeon.queryManager;

    for (const cell of dungeonGrid.allCells()) {
      if (!this.canAffectCell(context, cell)) continue;
      if (currentState.get(cell) || !query.isWallNearFloor(cell, currentState)) continue;
      if (!context.rng.chance(this.def.randomchance ?? 0.3)) continue;

      const nearestFloor = query.findNearestFloor(cell, currentState);
      if (!nearestFloor) continue;

      const nextCell = { x: cell.x + Math.sign(nearestFloor.x - cell.x), y: cell.y + Math.sign(nearestFloor.y - cell.y) };
      if (!this.canAffectCell(context, nextCell)) continue;
      if (currentState.inBounds(nextCell) && !currentState.get(nextCell)) dungeonGrid.set(nextCell, true);
    }
  }
}

export class CellularAutomataManager {
  static applyRules(context, steps) {
    const reg = context.reg;
    const dungeonGrid = context.dungeon.gridManager.dungeonGrid;
    const ordered = [...steps].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));

    for (const step of ordered) {
      const def = reg.def('automata', step.automata);
      const Cls = reg.dungeonClass('automataworker', def.workerclass);
      const worker = new Cls(def);

      for (let i = 0; i < (step.iterations ?? 1); i++) {
        worker.apply(context, dungeonGrid, dungeonGrid.copy());
      }
    }
  }
}

export const AUTOMATA_WORKER_CLASSES = {
  CAWorker_SmoothCorners,
  CAWorker_FillSmallGaps,
  CAWorker_RemoveIslands,
  CAWorker_NaturalWalls,
  CAWorker_AddAlcoves,
  CAWorker_CaveDecorator,
};
