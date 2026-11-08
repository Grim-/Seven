import { BspNode } from './BspNode.js';
import { CellRect } from './CellRect.js';
import { shuffle } from './DungeonRand.js';

export class BspConfig {
  constructor({ minRoomSize, splitBufferRatio, maxElongationRatio, minSplitPosition, maxSplitPosition, maxSplitAttempts }) {
    this.minRoomSize = minRoomSize;
    this.splitBufferRatio = splitBufferRatio;
    this.maxElongationRatio = maxElongationRatio;
    this.minSplitPosition = minSplitPosition;
    this.maxSplitPosition = maxSplitPosition;
    this.maxSplitAttempts = maxSplitAttempts;
  }

  get minSplitBuffer() {
    return Math.trunc(this.minRoomSize / this.splitBufferRatio);
  }

  get minSplittableDimension() {
    return this.minRoomSize * 2 + this.minSplitBuffer * 2;
  }

  withMinRoomSize(minRoomSize) {
    return new BspConfig({ ...this, minRoomSize });
  }
}

export class BspUtility {
  static generateBspTreeWithSideRooms(rng, rootRect, totalRoomCount, mainRoomCount, sideRoomCount, config) {
    const rootNode = BspUtility.generateInitialBspTree(rng, rootRect, totalRoomCount, config);

    let leafNodes = BspUtility.getAllLeafNodes(rootNode);
    if (leafNodes.length < totalRoomCount) {
      leafNodes = BspUtility.attemptToReachTargetRoomCount(rng, rootNode, leafNodes, totalRoomCount, config);
    }

    BspUtility.selectAndMarkRooms(rng, leafNodes, mainRoomCount, sideRoomCount);
    BspUtility.pruneUnmarkedLeafNodes(rootNode);

    return rootNode;
  }

  static generateInitialBspTree(rng, rootRect, targetRoomCount, config) {
    const initialMaxDepth = Math.ceil(Math.log2(targetRoomCount)) + 1;
    const rootNode = new BspNode(rootRect);
    BspUtility.splitNode(rng, rootNode, 0, initialMaxDepth, config);
    return rootNode;
  }

  static attemptToReachTargetRoomCount(rng, rootNode, leafNodes, targetCount, config) {
    let attempts = 0;

    while (leafNodes.length < targetCount && attempts < config.maxSplitAttempts) {
      const largestSplittableNode = BspUtility.findLargestSplittableNode(leafNodes, config);
      if (!largestSplittableNode) break;

      const adaptiveMultiplier = Math.max(0.5, 1 - attempts * 0.01);
      const adaptiveConfig = config.withMinRoomSize(Math.trunc(config.minRoomSize * adaptiveMultiplier));

      BspUtility.splitNode(rng, largestSplittableNode, 0, 1, adaptiveConfig);
      leafNodes = BspUtility.getAllLeafNodes(rootNode);
      attempts++;
    }

    return leafNodes;
  }

  static findLargestSplittableNode(leafNodes, config) {
    let largestNode = null;
    let largestArea = 0;

    for (const node of leafNodes) {
      const area = node.rect.area;
      if (area > largestArea && BspUtility.canSplitNode(node.rect, config)) {
        largestArea = area;
        largestNode = node;
      }
    }

    return largestNode;
  }

  static canSplitNode(rect, config) {
    return BspUtility.canSplitInDirection(rect, true, config) || BspUtility.canSplitInDirection(rect, false, config);
  }

  static selectAndMarkRooms(rng, leafNodes, mainRoomCount, sideRoomCount) {
    if (!leafNodes.length) return;

    shuffle(rng, leafNodes);

    for (const node of leafNodes.slice(0, Math.min(mainRoomCount, leafNodes.length))) {
      node.addTag('keep');
    }

    if (leafNodes.length > mainRoomCount) {
      const actualSideRoomCount = Math.min(sideRoomCount, leafNodes.length - mainRoomCount);
      for (const node of leafNodes.slice(mainRoomCount, mainRoomCount + actualSideRoomCount)) {
        node.addTag('keep');
        node.addTag('side_path');
      }
    }
  }

  static splitNode(rng, node, depth, maxDepth, config) {
    if (depth >= maxDepth || !node) return;

    const splitHorizontal = BspUtility.shouldSplitHorizontally(rng, node.rect, config);
    if (!BspUtility.canSplitInDirection(node.rect, splitHorizontal, config)) return;

    const splitPos = BspUtility.calculateSplitPosition(rng, node.rect, splitHorizontal, config);
    BspUtility.createChildNodes(node, splitHorizontal, splitPos);

    BspUtility.splitNode(rng, node.left, depth + 1, maxDepth, config);
    BspUtility.splitNode(rng, node.right, depth + 1, maxDepth, config);
  }

  static shouldSplitHorizontally(rng, rect, config) {
    const aspectRatio = rect.width / rect.height;

    if (aspectRatio > config.maxElongationRatio) return true;
    if (aspectRatio < 1 / config.maxElongationRatio) return false;

    return rect.width > rect.height ? rng.float() < 0.6 : rng.float() < 0.4;
  }

  static splitBounds(rect, horizontal, config) {
    const reach = config.minSplitBuffer + config.minRoomSize;
    return horizontal
      ? { low: rect.minX + reach, high: rect.maxX - reach }
      : { low: rect.minY + reach, high: rect.maxY - reach };
  }

  static canSplitInDirection(rect, horizontal, config) {
    const dimension = horizontal ? rect.width : rect.height;
    if (dimension < config.minSplittableDimension) return false;

    const { low, high } = BspUtility.splitBounds(rect, horizontal, config);
    return low <= high;
  }

  static calculateSplitPosition(rng, rect, horizontal, config) {
    const splitRatio = rng.range(config.minSplitPosition, config.maxSplitPosition);
    const { low, high } = BspUtility.splitBounds(rect, horizontal, config);
    const split = horizontal
      ? rect.minX + Math.trunc(rect.width * splitRatio)
      : rect.minY + Math.trunc(rect.height * splitRatio);

    return Math.max(low, Math.min(high, split));
  }

  static createChildNodes(node, horizontal, splitPos) {
    const rect = node.rect;

    if (horizontal) {
      node.left = new BspNode(new CellRect(rect.minX, rect.minY, splitPos - rect.minX, rect.height));
      node.right = new BspNode(new CellRect(splitPos, rect.minY, rect.maxX - splitPos, rect.height));
    } else {
      node.left = new BspNode(new CellRect(rect.minX, rect.minY, rect.width, splitPos - rect.minY));
      node.right = new BspNode(new CellRect(rect.minX, splitPos, rect.width, rect.maxY - splitPos));
    }
  }

  static getAllLeafNodes(rootNode) {
    const leafNodes = [];
    BspUtility.collectLeafNodes(rootNode, leafNodes);
    return leafNodes;
  }

  static collectLeafNodes(node, leafNodes) {
    if (!node) return;

    if (node.isLeaf()) {
      leafNodes.push(node);
      return;
    }

    BspUtility.collectLeafNodes(node.left, leafNodes);
    BspUtility.collectLeafNodes(node.right, leafNodes);
  }

  static pruneUnmarkedLeafNodes(node) {
    if (!node) return false;
    if (node.isLeaf()) return node.hasTag('keep');

    const keepLeft = BspUtility.pruneUnmarkedLeafNodes(node.left);
    const keepRight = BspUtility.pruneUnmarkedLeafNodes(node.right);

    if (!keepLeft) node.left = null;
    if (!keepRight) node.right = null;
    return node.left !== null || node.right !== null;
  }

  static getLeafNodes(node, leafNodes) {
    BspUtility.collectLeafNodes(node, leafNodes);
  }

  static eachNode(node, visit) {
    if (!node) return;
    visit(node);
    BspUtility.eachNode(node.left, visit);
    BspUtility.eachNode(node.right, visit);
  }
}
