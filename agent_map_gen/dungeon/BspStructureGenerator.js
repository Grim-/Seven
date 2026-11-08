import { BspConfig, BspUtility } from '../BspUtility.js';
import { CellRect } from '../CellRect.js';
import { randomInRange } from '../DungeonRand.js';

export class BspStructureGenerator {
  constructor(context) {
    this.context = context;
  }

  generate() {
    const { bounds, mapMargin, def, rng, dungeon } = this.context;
    const half = Math.trunc(mapMargin / 2);
    const mapArea = new CellRect(bounds.minX + half, bounds.minY + half, bounds.width - mapMargin, bounds.height - mapMargin);

    const mapDim = Math.max(bounds.width, bounds.height);
    const areaScale = Math.max(1, Math.round(mapDim / 64));
    let mainPathLength = this.context.mainPathLength;
    let sideRoomCount = randomInRange(rng, def.sideroomcount ?? [3, 6]);

    if (!this.context.hasExplicitRoomAmount && areaScale > 1) {
      mainPathLength = Math.min(80, Math.round(mainPathLength * areaScale));
      sideRoomCount = Math.min(50, Math.round(sideRoomCount * areaScale));
      this.context.mainPathLength = mainPathLength;
    }

    const config = new BspConfig({
      minRoomSize: randomInRange(rng, def.roomsize ?? [8, 8]),
      splitBufferRatio: def.splitbufferratio ?? 2,
      maxElongationRatio: def.maxelongationratio ?? 1.5,
      minSplitPosition: def.minsplitposition ?? 0.3,
      maxSplitPosition: def.maxsplitposition ?? 0.6,
      maxSplitAttempts: def.maxsplitattempts ?? 400,
    });

    const rootNode = BspUtility.generateBspTreeWithSideRooms(rng, mapArea, mainPathLength + sideRoomCount, mainPathLength, sideRoomCount, config);
    const leafNodes = BspUtility.getAllLeafNodes(rootNode).filter((n) => n.hasTag('keep'));

    for (const node of leafNodes) {
      if (node.hasTag('side_path')) dungeon.addSidePathNode(node);
    }

    dungeon.setBspStructure(rootNode, leafNodes);
  }
}
