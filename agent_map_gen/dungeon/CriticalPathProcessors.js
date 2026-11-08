import { randomElement } from '../DungeonRand.js';

export class CriticalPathProcessorBase {
  constructor(context, dungeon) {
    this.context = context;
    this.dungeon = dungeon;
  }

  designateCriticalPath(context, dungeon) {}

  markStart(room) {
    room.setDef(this.context.reg, this.context.def.startroom);
    room.addTag('start');
    room.setCriticalPathIndex(0);
  }

  markEnd(room) {
    room.setDef(this.context.reg, this.context.def.endroom);
    room.addTag('end');
  }

  markPath(path) {
    path.forEach((room, i) => {
      room.setCriticalPathIndex(i);
      room.removeTag('side_path');
      room.addTag('main_path');
    });
  }

  connectPath(path) {
    for (let i = 0; i < path.length - 1; i++) this.dungeon.connectRooms(path[i], path[i + 1]);
  }

  setEndpoints(startRoom, endRoom) {
    this.dungeon.setCriticalPathEndpoints(this.dungeon.getNode(startRoom), this.dungeon.getNode(endRoom));
  }
}

export class CriticalPathProcessor extends CriticalPathProcessorBase {
  designateCriticalPath(context, dungeon) {
    const firstRoom = randomElement(context.rng, dungeon.getAllRooms());
    const startRoom = dungeon.getFurthestRoom(firstRoom);
    const endRoom = dungeon.getFurthestRoom(startRoom);

    this.markStart(startRoom);
    this.markEnd(endRoom);
    this.setEndpoints(startRoom, endRoom);

    const path = dungeon.findPathBetween(startRoom, endRoom);
    this.markPath(path);
    endRoom.setCriticalPathIndex(path.length - 1);
    this.connectPath(path);
  }
}

export class CriticalPathProcessorFlexibleLength extends CriticalPathProcessorBase {
  designateCriticalPath(context, dungeon) {
    const mainPathLength = context.mainPathLength;
    const allRooms = dungeon.getAllRooms();
    let bestPath = null;
    let bestSideRoomCount = 0;

    for (let attempt = 0; attempt < (context.def.criticalpathattempts ?? 5); attempt++) {
      const path = this.buildPathOfLength(context, allRooms, mainPathLength);
      if (!path) continue;

      const sideRoomCount = allRooms.length - path.length;
      if (sideRoomCount > bestSideRoomCount) {
        bestPath = path;
        bestSideRoomCount = sideRoomCount;
      }
    }

    if (!bestPath) {
      const start = randomElement(context.rng, allRooms);
      const end = dungeon.getFurthestRoom(start);
      bestPath = dungeon.findPathBetween(start, end).slice(0, mainPathLength);
    }

    this.applyPath(bestPath);
  }

  buildPathOfLength(context, allRooms, targetLength) {
    const start = randomElement(context.rng, allRooms);
    const path = [start];
    const used = new Set(path);

    while (path.length < targetLength) {
      const nextOptions = path[path.length - 1].connectedRooms.filter((room) => !used.has(room));
      if (!nextOptions.length) break;

      const next = randomElement(context.rng, nextOptions);
      path.push(next);
      used.add(next);
    }

    return path.length === targetLength ? path : null;
  }

  applyPath(path) {
    const startRoom = path[0];
    const endRoom = path[path.length - 1];

    this.markStart(startRoom);
    this.markEnd(endRoom);
    this.markPath(path);
    endRoom.setCriticalPathIndex(path.length - 1);
    this.connectPath(path);
    this.setEndpoints(startRoom, endRoom);
  }
}

export class CriticalPathProcessorBidirectional extends CriticalPathProcessorBase {
  designateCriticalPath(context, dungeon) {
    const mainPathLength = context.mainPathLength;
    const allRooms = dungeon.getAllRooms();
    const firstRoom = randomElement(context.rng, allRooms);
    const lastRoom = dungeon.getFurthestRoom(firstRoom);

    const path = [firstRoom, lastRoom];
    const usedRooms = new Set(path);
    let extendFromStart = true;

    while (path.length < mainPathLength && usedRooms.size < allRooms.length) {
      const targetRoom = extendFromStart ? path[0] : path[path.length - 1];
      const connectedUnused = targetRoom.connectedRooms.filter((room) => !usedRooms.has(room));

      if (connectedUnused.length) {
        const newRoom = randomElement(context.rng, connectedUnused);
        if (extendFromStart) path.unshift(newRoom);
        else path.push(newRoom);
        usedRooms.add(newRoom);
      }

      extendFromStart = !extendFromStart;

      const exhausted = (room) => room.connectedRooms.every((connected) => usedRooms.has(connected));
      if (exhausted(path[0]) && exhausted(path[path.length - 1])) break;
    }

    this.applyPath(path);
  }

  applyPath(path) {
    const startRoom = path[0];
    const endRoom = path[path.length - 1];

    this.markStart(startRoom);
    this.markEnd(endRoom);
    this.markPath(path);
    endRoom.setCriticalPathIndex(path.length - 1);
    this.setEndpoints(startRoom, endRoom);
  }
}

export class CriticalPathProcessorBestForSideRooms extends CriticalPathProcessorBase {
  designateCriticalPath(context, dungeon) {
    const mainPathLength = context.mainPathLength;
    const allRooms = dungeon.getAllRooms();
    const candidatePaths = [];

    for (let attempt = 0; attempt < (context.def.criticalpathattempts ?? 5); attempt++) {
      const startCandidate = randomElement(context.rng, allRooms);
      const endCandidate = dungeon.getFurthestRoom(startCandidate);
      const fullPath = dungeon.findPathBetween(startCandidate, endCandidate);
      if (fullPath.length >= mainPathLength) candidatePaths.push(fullPath.slice(0, mainPathLength));
    }

    if (!candidatePaths.length) {
      new CriticalPathProcessor(context, dungeon).designateCriticalPath(context, dungeon);
      return;
    }

    let bestPath = candidatePaths[0];
    let bestRooms = allRooms.length - bestPath.length;
    let bestSides = this.countPotentialSideConnections(bestPath, allRooms);

    for (const path of candidatePaths.slice(1)) {
      const rooms = allRooms.length - path.length;
      const sides = this.countPotentialSideConnections(path, allRooms);
      if (rooms > bestRooms || (rooms === bestRooms && sides > bestSides)) {
        bestPath = path;
        bestRooms = rooms;
        bestSides = sides;
      }
    }

    this.applyPath(bestPath);
  }

  countPotentialSideConnections(mainPath, allRooms) {
    const sideRooms = allRooms.filter((room) => !mainPath.includes(room));
    let connections = 0;
    for (const mainRoom of mainPath) connections += mainRoom.connectedRooms.filter((room) => sideRooms.includes(room)).length;
    return connections;
  }

  applyPath(path) {
    const startRoom = path[0];
    const endRoom = path[path.length - 1];

    this.markStart(startRoom);
    this.markEnd(endRoom);
    this.markPath(path);
    endRoom.setCriticalPathIndex(path.length - 1);
    this.connectPath(path);
    this.setEndpoints(startRoom, endRoom);
  }
}

export class CriticalPathProcessorMainPathLimited extends CriticalPathProcessorBase {
  designateCriticalPath(context, dungeon) {
    const firstRoom = randomElement(context.rng, dungeon.getAllRooms());
    const startRoom = dungeon.getFurthestRoom(firstRoom);
    const endRoom = dungeon.getFurthestRoom(startRoom);

    this.markStart(startRoom);

    const path = dungeon.findPathBetween(startRoom, endRoom).slice(0, context.mainPathLength);
    this.markPath(path);

    const actualEndRoom = path[path.length - 1];
    this.markEnd(actualEndRoom);
    actualEndRoom.setCriticalPathIndex(path.length - 1);
    this.setEndpoints(startRoom, actualEndRoom);

    this.connectPath(path);
  }
}

export const CRITICAL_PATH_CLASSES = {
  CriticalPathProcessor,
  CriticalPathProcessorFlexibleLength,
  CriticalPathProcessorBidirectional,
  CriticalPathProcessorBestForSideRooms,
  CriticalPathProcessorMainPathLimited,
};
