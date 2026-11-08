import { distanceSquared } from '../CellRect.js';
import { minBy } from '../DungeonRand.js';

export class SidePathChainConnector {
  constructor(context) {
    this.context = context;
  }

  connectSidePathChainsToMainPath(criticalPathRooms, chains) {
    if (!chains.length || !criticalPathRooms.length) return;

    for (const chain of chains) {
      if (!chain.length) continue;

      const chainEntrance = this.selectChainEntrance(chain, criticalPathRooms);
      const nearestMainRoom = minBy(criticalPathRooms, (room) => distanceSquared(room.center, chainEntrance.center));

      this.context.dungeon.connectRooms(chainEntrance, nearestMainRoom);
      this.preventForwardConnectionsForChain(chain, nearestMainRoom, criticalPathRooms);
    }
  }

  selectChainEntrance(chain, criticalPathRooms) {
    return minBy(chain, (room) => Math.min(...criticalPathRooms.map((critical) => distanceSquared(critical.center, room.center))));
  }

  preventForwardConnectionsForChain(chain, connectedMainRoom, criticalPathRooms) {
    const forwardRooms = criticalPathRooms.filter((room) => room.criticalPathIndex > connectedMainRoom.criticalPathIndex);

    for (const chainRoom of chain) {
      for (const forwardRoom of forwardRooms) {
        if (chainRoom.isConnectedTo(forwardRoom)) this.context.dungeon.disconnectRooms(chainRoom, forwardRoom);
      }
    }
  }
}
