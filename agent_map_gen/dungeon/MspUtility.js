import { distance } from '../CellRect.js';

const PATH_INDEX_TAG = 'path_index_';

export class MspUtility {
  static createMinimumSpanningTree(nodes) {
    if (nodes.length <= 1) return;

    for (const node of nodes) {
      node.connectedNodes = node.hasTag('critical_path')
        ? node.connectedNodes.filter((connected) => connected.hasTag('critical_path') && MspUtility.isCriticalPathAdjacent(node, connected))
        : [];
    }

    const nonCriticalNodes = nodes.filter((node) => !node.hasTag('critical_path'));
    const connectedNodes = new Set(nodes.filter((node) => node.hasTag('critical_path')));

    if (connectedNodes.size === 0) {
      connectedNodes.add(nodes[0]);
      nonCriticalNodes.splice(nonCriticalNodes.indexOf(nodes[0]), 1);
    }

    while (nonCriticalNodes.length) {
      let bestNode1 = null;
      let bestNode2 = null;
      let shortestDistance = Infinity;

      for (const connectedNode of connectedNodes) {
        for (const unconnectedNode of nonCriticalNodes) {
          const d = distance(connectedNode.rect.centerCell, unconnectedNode.rect.centerCell);
          if (d < shortestDistance) {
            shortestDistance = d;
            bestNode1 = connectedNode;
            bestNode2 = unconnectedNode;
          }
        }
      }

      if (!bestNode1 || !bestNode2) break;

      bestNode1.connectedNodes.push(bestNode2);
      bestNode2.connectedNodes.push(bestNode1);
      connectedNodes.add(bestNode2);
      nonCriticalNodes.splice(nonCriticalNodes.indexOf(bestNode2), 1);
    }
  }

  static isCriticalPathAdjacent(node1, node2) {
    const index1 = MspUtility.pathIndex(node1);
    const index2 = MspUtility.pathIndex(node2);
    return index1 >= 0 && index2 >= 0 && Math.abs(index1 - index2) === 1;
  }

  static pathIndex(node) {
    for (const tag of node.tags) {
      if (!tag.startsWith(PATH_INDEX_TAG)) continue;
      const index = Number.parseInt(tag.slice(PATH_INDEX_TAG.length), 10);
      if (Number.isInteger(index)) return index;
    }
    return -1;
  }
}
