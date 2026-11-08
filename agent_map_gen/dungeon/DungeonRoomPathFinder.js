import { randomElement } from '../DungeonRand.js';

export class DungeonRoomPathFinder {
  getFurthestRoom(start) {
    const queue = [[start, 0]];
    const visited = new Set();
    let furthest = start;
    let maxDist = 0;

    for (let head = 0; head < queue.length; head++) {
      const [room, dist] = queue[head];
      if (visited.has(room)) continue;
      visited.add(room);

      if (dist > maxDist) {
        maxDist = dist;
        furthest = room;
      }

      for (const neighbor of room.connectedRooms) queue.push([neighbor, dist + 1]);
    }

    return furthest;
  }

  findPathBetween(start, end) {
    const queue = [start];
    const cameFrom = new Map([[start, null]]);
    const visited = new Set([start]);

    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (current === end) break;

      for (const neighbor of current.connectedRooms) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        cameFrom.set(neighbor, current);
        queue.push(neighbor);
      }
    }

    const path = [];
    for (let at = end; at; at = cameFrom.has(at) ? cameFrom.get(at) : null) path.unshift(at);
    return path;
  }

  getPathDistance(start, end) {
    const path = this.findPathBetween(start, end);
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i].center;
      const b = path[i + 1].center;
      totalDistance += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
    return totalDistance;
  }

  getRoomsAccessibleFrom(start, excludeRoom = null) {
    const accessibleRooms = new Set();
    if (!start) return accessibleRooms;

    const queue = [start];
    accessibleRooms.add(start);

    for (let head = 0; head < queue.length; head++) {
      for (const neighbor of queue[head].connectedRooms) {
        if (neighbor === excludeRoom || accessibleRooms.has(neighbor)) continue;
        accessibleRooms.add(neighbor);
        queue.push(neighbor);
      }
    }

    return accessibleRooms;
  }

  getEndRooms(start) {
    const visited = new Set([start]);
    const queue = [start];
    const endRooms = new Set();

    for (let head = 0; head < queue.length; head++) {
      for (const neighbor of queue[head].connectedRooms) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
        if (neighbor.connectedRooms.length === 1) endRooms.add(neighbor);
      }
    }

    return endRooms;
  }

  findAccessibleRoomsBefore(rng, targetRoom, startRoom) {
    if (startRoom === targetRoom) return startRoom;

    const accessibleRooms = new Set([startRoom]);
    const queue = [startRoom];

    for (let head = 0; head < queue.length; head++) {
      for (const neighbor of queue[head].connectedRooms) {
        if (neighbor === targetRoom || accessibleRooms.has(neighbor)) continue;
        accessibleRooms.add(neighbor);
        queue.push(neighbor);
      }
    }

    let rooms = [...accessibleRooms];
    if (targetRoom.isOnCriticalPath) {
      rooms = rooms.filter((room) => !(room.isOnCriticalPath && room.criticalPathIndex > targetRoom.criticalPathIndex));
    }

    return randomElement(rng, rooms) ?? startRoom;
  }
}
