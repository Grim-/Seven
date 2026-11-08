import { BspStructureGenerator } from './BspStructureGenerator.js';
import { DungeonRoom } from './DungeonRoom.js';
import { floatInRange, randomElement } from '../DungeonRand.js';
import { CARDINALS, cellKey, distance } from '../CellRect.js';
import { CellularAutomataManager } from './AutomataWorkers.js';
import { MinimumSpanningTreeGenerator } from './MinimumSpanningTreeGenerator.js';
import { SidePathProcessor } from './SidePathProcessor.js';
import { roomTypeWorker } from './RoomWorkers.js';
import { CorridoorUtility } from './CorridoorUtility.js';

export class MapInitializationStep {
  get label() {
    return 'Initialize';
  }

  execute(context) {}
}

export class BspStructureGenerationStep {
  get label() {
    return 'Splitting BSP tree';
  }

  execute(context) {
    new BspStructureGenerator(context).generate();
  }
}

export class RoomCreationStep {
  get label() {
    return 'Creating rooms';
  }

  execute(context) {
    const availableRoomTypes = context.def.availableroomtypes ?? [];
    if (!availableRoomTypes.length) throw new Error(`dungeon ${context.dungeon.defId} lists no availableroomtypes`);

    this.sortNodesBySize(context);
    const assignedNodes = new Set();
    const roomTypeCount = new Map(availableRoomTypes.map((layout) => [layout, 0]));

    this.assignRoomsWithRequirements(context, availableRoomTypes, assignedNodes, roomTypeCount);
    this.assignRemainingRooms(context, availableRoomTypes, assignedNodes, roomTypeCount);
  }

  sortNodesBySize(context) {
    context.dungeon.leafNodes.sort((a, b) => b.rect.area - a.rect.area);
  }

  maxCount(context, layout) {
    return context.reg.def('roomtypes', layout.roomtype)?.maxroomtypecount ?? 0;
  }

  assignRoomsWithRequirements(context, availableRoomTypes, assignedNodes, roomTypeCount) {
    for (const layout of availableRoomTypes.filter((entry) => entry.minsizerequired)) {
      if (roomTypeCount.get(layout) >= this.maxCount(context, layout)) continue;

      const bestNode = this.findSuitableNode(context, assignedNodes, layout);
      if (bestNode) this.createAndAddRoom(context, bestNode, layout, assignedNodes, roomTypeCount);
    }
  }

  assignRemainingRooms(context, availableRoomTypes, assignedNodes, roomTypeCount) {
    const flexibleRoomTypes = availableRoomTypes.filter((entry) => !entry.minsizerequired);

    for (const node of context.dungeon.leafNodes) {
      if (assignedNodes.has(node)) continue;
      const layout = this.selectRoomType(context, availableRoomTypes, flexibleRoomTypes, roomTypeCount);
      this.createAndAddRoom(context, node, layout, assignedNodes, roomTypeCount);
    }
  }

  findSuitableNode(context, assignedNodes, layout) {
    const padding = (context.def.minroompadding ?? 2) * 2;
    return context.dungeon.leafNodes.find((node) => !assignedNodes.has(node)
      && node.rect.width >= layout.minsizerequired[0] + padding
      && node.rect.height >= layout.minsizerequired[1] + padding) ?? null;
  }

  selectRoomType(context, availableRoomTypes, flexibleRoomTypes, roomTypeCount) {
    const under = (entry) => roomTypeCount.get(entry) < this.maxCount(context, entry);

    const availableFlexibleTypes = flexibleRoomTypes.filter(under);
    if (availableFlexibleTypes.length) return randomElement(context.rng, availableFlexibleTypes);

    const availableTypes = availableRoomTypes.filter(under);
    if (availableTypes.length) return randomElement(context.rng, availableTypes);

    return randomElement(context.rng, availableRoomTypes);
  }

  createAndAddRoom(context, node, layout, assignedNodes, roomTypeCount) {
    const room = DungeonRoom.fromBspNode(
      context.dungeon,
      node,
      context,
      layout,
      context.def.minroompadding ?? 2,
      floatInRange(context.rng, context.def.roomsizefactor ?? [0.9, 1]),
    );
    context.dungeon.addRoom(node, room);
    assignedNodes.add(node);
    roomTypeCount.set(layout, roomTypeCount.get(layout) + 1);
  }
}

export class EarlyAutomataStep {
  get label() {
    return 'Early automata';
  }

  execute(context) {
    if (context.def.earlyautomata?.length) CellularAutomataManager.applyRules(context, context.def.earlyautomata);
  }
}

export class MinimumSpanningTreeStep {
  get label() {
    return 'Spanning tree';
  }

  execute(context) {
    new MinimumSpanningTreeGenerator(context.dungeon).createMinimumSpanningTree();
  }
}

export class ConnectionGenerationStep {
  get label() {
    return 'Room connections';
  }

  execute(context) {
    context.dungeon.connectionManager.generateConnectionsFromRoomGraph();
  }
}

export class CriticalPathDesignationStep {
  get label() {
    return 'Critical path';
  }

  execute(context) {
    const Processor = context.reg.dungeonClass('criticalpath', context.def.criticalpathprocessor);
    new Processor(context, context.dungeon).designateCriticalPath(context, context.dungeon);
  }
}

export class SidePathProcessingStep {
  get label() {
    return 'Side paths';
  }

  execute(context) {
    const processor = new SidePathProcessor(context);
    processor.processSidePaths();
    processor.ensureAllRoomsConnected();
  }
}

export class RoomTypeAssignmentStep {
  get label() {
    return 'Room types';
  }

  execute(context) {
    const dungeon = context.dungeon;
    const startRoom = dungeon.startRoom;

    for (const node of dungeon.leafNodes) {
      const room = dungeon.getRoom(node);
      if (!room || room.def) continue;

      if (room.isOnCriticalPath) this.assignRoomType(context, room, context.def.noroomchancecriticalpath ?? 0.2, context.def.availableroomtypes);
      else this.assignRoomType(context, room, context.def.noroomchancesidepath ?? 0.5, context.def.availablesideroomtypes);

      if (startRoom) room.distanceFromStart = distance(room.center, startRoom.center);
    }
  }

  assignRoomType(context, room, noRoomChance, layouts) {
    if (context.rng.chance(noRoomChance)) return;

    const layout = RoomTypeAssignmentStep.roomTypeFor(context, room, layouts ?? []);
    if (!layout) return;

    room.setDef(context.reg, layout.roomtype);
  }

  static roomTypeFor(context, room, layouts) {
    const candidates = layouts.filter((layout) => {
      const worker = roomTypeWorker(context.reg, layout.roomtype, room);
      return worker.def.roomtype === 'normal' && worker.canApply(context, room);
    });
    return randomElement(context.rng, candidates);
  }
}

export class SideRoomTypeUpdateStep {
  get label() {
    return 'Side room types';
  }

  execute(context) {
    const layouts = context.def.availablesideroomtypes ?? [];
    if (!layouts.length) return;

    const sidePathRooms = context.dungeon.getAllSidePathRooms().filter((room) => !room.def);
    if (!sidePathRooms.length) return;

    const sized = layouts.filter((layout) => layout.minsizerequired);
    const flexible = layouts.filter((layout) => !layout.minsizerequired);

    for (const room of sidePathRooms) {
      let layout = sized.find((entry) => room.roomCellRect.width >= entry.minsizerequired[0]
        && room.roomCellRect.height >= entry.minsizerequired[1]) ?? null;

      if (!layout && flexible.length) layout = randomElement(context.rng, flexible);
      if (!layout) layout = randomElement(context.rng, layouts);
      if (layout) room.setDef(context.reg, layout.roomtype);
    }
  }
}

export class GenerateCorridoorsStep {
  get label() {
    return 'Corridors';
  }

  execute(context) {
    for (const connection of context.dungeon.connectionManager.allConnections) {
      connection.setCorridoor(CorridoorUtility.generateCorridor(
        context,
        connection.roomA,
        connection.roomB,
        context.corridoorWidth,
        context.def.smoothcorridoorcorners ?? true,
      ));
    }
  }
}

export class GridApplicationStep {
  get label() {
    return 'Carving floor';
  }

  execute(context) {
    GridApplicationStep.drawGrid(context);
  }

  static drawGrid(context) {
    const dungeon = context.dungeon;
    dungeon.connectionManager.applyConnectionsToGrid();

    for (const room of dungeon.rooms) {
      for (const cell of room.roomCells) dungeon.markCellAsFloor(cell);

      for (const connection of dungeon.connectionManager.getConnectionsForRoom(room)) {
        for (const cell of connection.getAllCells()) dungeon.markCellAsFloor(cell);
      }
    }
  }
}

export class PostAutomataStep {
  get label() {
    return 'Post automata';
  }

  execute(context) {
    if (context.def.postgenautomata?.length) CellularAutomataManager.applyRules(context, context.def.postgenautomata);
  }
}

export class RoomWorkerApplicationStep {
  get label() {
    return 'Room workers';
  }

  execute(context) {
    for (const room of context.dungeon.getAllRooms()) {
      if (!room.defId) continue;

      const worker = roomTypeWorker(context.reg, room.defId, room);
      if (worker.canApply(context, room)) worker.applyRoom(context, room);
    }
  }
}

export class HiddenRoomSealingStep {
  get label() {
    return 'Sealing hidden rooms';
  }

  execute(context) {
    const hiddenRooms = context.dungeon.getAllRooms().filter((room) => room.hasTag('hidden'));
    for (const hiddenRoom of hiddenRooms) this.sealRoomConnections(context, hiddenRoom);
  }

  sealRoomConnections(context, hiddenRoom) {
    const manager = context.dungeon.connectionManager;
    const shared = new Set();

    for (const connection of manager.allConnections) {
      if (connection.involves(hiddenRoom) || !connection.corridoor) continue;
      for (const cell of connection.corridoor.getAllCorridorCells()) shared.add(cellKey(cell.x, cell.y));
    }

    for (const connection of manager.getConnectionsForRoom(hiddenRoom)) {
      this.sealConnection(context, connection, hiddenRoom, shared);
    }
  }

  sealConnection(context, connection, hiddenRoom, shared) {
    const corridoor = connection.corridoor;
    if (!corridoor) return;

    const visibleRoom = connection.otherRoom(hiddenRoom);
    const corridorKeys = new Set(corridoor.path.map((cell) => cellKey(cell.x, cell.y)));
    const sealPoints = corridoor.path.filter((cell) => CARDINALS.some((dir) => visibleRoom.containsCell({ x: cell.x + dir.x, y: cell.y + dir.y })));

    for (const sealPoint of sealPoints) this.sealCorridorAtPoint(context, sealPoint, corridoor, corridorKeys, shared);
  }

  sealCorridorAtPoint(context, sealPoint, corridoor, corridorKeys, shared) {
    this.placeWall(context, sealPoint, shared);
    if (corridoor.width <= 1) return;

    for (const dir of CARDINALS) this.buildWallsToEdge(context, sealPoint, dir, corridorKeys, shared);
  }

  buildWallsToEdge(context, startCell, direction, corridorKeys, shared) {
    let current = startCell;

    while (corridorKeys.has(cellKey(current.x, current.y)) && context.bounds.contains(current)) {
      this.placeWall(context, current, shared);
      current = { x: current.x + direction.x, y: current.y + direction.y };
    }
  }

  placeWall(context, cell, shared) {
    if (shared.has(cellKey(cell.x, cell.y))) return;
    context.dungeon.markCellAsWall(cell);
  }
}
