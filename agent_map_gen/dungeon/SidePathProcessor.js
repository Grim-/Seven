import { SidePathChainBuilder } from './SidePathChainBuilder.js';
import { SidePathChainConnector } from './SidePathChainConnector.js';
import { minBy } from '../DungeonRand.js';
import { distanceSquared } from '../CellRect.js';

const MIN_CONNECTIONS = 2;

export class SidePathProcessor {
  constructor(context) {
    this.context = context;
  }

  processSidePaths() {
    const { dungeon, def } = this.context;
    const criticalPathRooms = dungeon.getAllRooms()
      .filter((room) => room.isOnCriticalPath)
      .sort((a, b) => a.criticalPathIndex - b.criticalPathIndex);

    const sidePathRooms = dungeon.getAllRooms().filter((room) => !room.isOnCriticalPath);
    for (const room of sidePathRooms) room.addTag('side_path');
    if (!sidePathRooms.length) return;

    const sidePathChains = new SidePathChainBuilder(this.context).createSidePathChains(sidePathRooms, criticalPathRooms);
    new SidePathChainConnector(this.context).connectSidePathChainsToMainPath(criticalPathRooms, sidePathChains);

    if (def.allowhiddensidepaths && def.hiddensidepathchance > 0) {
      this.hideRandomSidePathChains(sidePathChains, def.hiddensidepathchance);
    }
  }

  ensureAllRoomsConnected() {
    const { dungeon } = this.context;
    const maxDistSq = 35 * 35;

    for (const room of dungeon.getAllRooms()) {
      if (dungeon.connectionManager.getConnectionCount(room) >= MIN_CONNECTIONS) continue;

      const candidates = dungeon.getAllRooms().filter((other) =>
        other !== room &&
        !other.isOnCriticalPath &&
        !other.isConnectedTo(room) &&
        distanceSquared(other.center, room.center) <= maxDistSq
      );

      if (candidates.length) {
        const otherRoom = minBy(candidates, (other) => distanceSquared(other.center, room.center));
        if (otherRoom) dungeon.connectRooms(room, otherRoom);
      }
    }
  }

  hideRandomSidePathChains(chains, hiddenChance) {
    const { dungeon, rng } = this.context;
    const startRoom = dungeon.startRoom;
    if (!startRoom) return;

    for (const room of dungeon.pathfinder.getEndRooms(startRoom)) {
      if (room.roomType === 'end') continue;
      if (rng.float() < hiddenChance) dungeon.markRoomAsHidden(room);
    }
  }
}
