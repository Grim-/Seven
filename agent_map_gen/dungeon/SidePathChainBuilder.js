import { distanceSquared } from '../CellRect.js';
import { minBy, randomElement, randomInRange, rangeExclusive } from '../DungeonRand.js';

export class SidePathChainBuilder {
  constructor(context) {
    this.context = context;
  }

  createSidePathChains(sidePathRooms, criticalPathRooms) {
    const chains = [];
    const usedRooms = new Set();

    while (sidePathRooms.some((room) => !usedRooms.has(room))) {
      const availableRooms = sidePathRooms.filter((room) => !usedRooms.has(room));
      const chain = this.buildSidePathChain(availableRooms, this.determineChainLength(), usedRooms, criticalPathRooms);
      if (!chain.length) break;

      chains.push(chain);
      for (const room of chain) usedRooms.add(room);
    }

    return chains;
  }

  determineChainLength() {
    const { rng, def } = this.context;
    return rng.float() < (def.longsidepathchance ?? 0.4) ? randomInRange(rng, def.sidepathlength ?? [1, 3]) : 1;
  }

  buildSidePathChain(availableRooms, targetLength, usedRooms, criticalPathRooms) {
    const { rng, def, dungeon } = this.context;
    const chain = [];
    if (!availableRooms.length) return chain;

    const startRoom = randomElement(rng, availableRooms.filter((room) => room.roomType !== 'end'));
    if (!startRoom) return chain;

    chain.push(startRoom);
    let currentRoom = startRoom;

    for (let i = 1; i < targetLength && chain.length < availableRooms.length; i++) {
      const nextRoom = this.selectNextRoomInChain(currentRoom, availableRooms, usedRooms, chain);
      if (!nextRoom) break;

      dungeon.connectRooms(currentRoom, nextRoom);
      chain.push(nextRoom);
      currentRoom = nextRoom;

      if (def.allowbranchingsidepaths && rng.chance(def.branchingchance ?? 0.7) && currentRoom.roomType !== 'end') {
        this.createSidePathBranch(currentRoom, availableRooms, usedRooms, chain, criticalPathRooms);
      }
    }

    return chain;
  }

  selectNextRoomInChain(currentRoom, availableRooms, usedRooms, chainSoFar) {
    const { rng, def } = this.context;
    const candidates = availableRooms.filter((room) => !usedRooms.has(room) && !chainSoFar.includes(room));
    if (!candidates.length) return null;

    const nearest = minBy(candidates, (room) => distanceSquared(room.center, currentRoom.center));
    if (rng.float() >= (def.meanderingchance ?? 0)) return nearest;

    const reach = (def.meanderingmaxdistance ?? 30) ** 2;
    const nearby = candidates.filter((room) => distanceSquared(room.center, currentRoom.center) <= reach);
    return randomElement(rng, nearby) ?? nearest;
  }

  createSidePathBranch(branchPoint, availableRooms, usedRooms, mainChain, criticalPathRooms) {
    const { rng, def, dungeon } = this.context;
    const sidepathlength = def.sidepathlength ?? [1, 3];
    const branchLength = rangeExclusive(rng, 1, Math.max(2, Math.trunc(sidepathlength[1] / 2)));
    const branch = this.buildSidePathChain(availableRooms, branchLength, usedRooms, criticalPathRooms);
    if (!branch.length) return;

    dungeon.connectRooms(branchPoint, branch[0]);
    for (const room of branch) {
      usedRooms.add(room);
      room.addTag('side_path_branch');
    }
  }
}
