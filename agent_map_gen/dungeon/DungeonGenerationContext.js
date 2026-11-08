import { Rng } from '../Rng.js';
import { randomInRange } from '../DungeonRand.js';

export class DungeonGenerationContext {
  constructor(dungeon, reg, seed) {
    this.dungeon = dungeon;
    this.reg = reg;
    this.def = dungeon.def;
    this.seed = seed;
    this.rng = new Rng(seed, Rng.stream('dungeon'));
    this.mapMargin = this.def.mapmargin ?? 4;
    this.corridoorWidth = this.def.corridoorwidth ?? 3;
    this.hasExplicitRoomAmount = Boolean(dungeon.def?.roomamount);
    this.mainPathLength = randomInRange(this.rng, this.def.roomamount ?? [5, 12]);
    this.bounds = dungeon.bounds;
  }
}
