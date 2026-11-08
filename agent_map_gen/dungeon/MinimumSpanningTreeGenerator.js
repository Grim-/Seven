import { MspUtility } from './MspUtility.js';

export class MinimumSpanningTreeGenerator {
  constructor(dungeon) {
    this.dungeon = dungeon;
  }

  createMinimumSpanningTree() {
    const dungeon = this.dungeon;
    MspUtility.createMinimumSpanningTree(dungeon.leafNodes);

    for (const node of dungeon.leafNodes) {
      const room = dungeon.getRoom(node);
      for (const connectedNode of node.connectedNodes) dungeon.connectRooms(room, dungeon.getRoom(connectedNode));
    }
  }
}
