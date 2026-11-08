import { Corridoor } from './Corridoor.js';
import { ConnectionPoints } from './ConnectionPoints.js';
import { distanceSquared } from '../CellRect.js';
import { minBy } from '../DungeonRand.js';

export class CorridoorUtility {
  static generateCorridor(context, roomA, roomB, width, smoothCorners) {
    const connectionPoints = CorridoorUtility.findOptimalConnectionPoints(roomA, roomB);
    const startPoint = connectionPoints.start;
    const endPoint = connectionPoints.end;

    const pathGenerator = CorridoorUtility.getRandomCorridorStyle(context, startPoint, endPoint);
    pathGenerator.smoothCorners = smoothCorners;

    const corridorPath = pathGenerator.generatePathWithWidth(context, startPoint, endPoint, width);
    const corridoor = new Corridoor(startPoint, endPoint, width);
    corridoor.setPath(corridorPath);
    return corridoor;
  }

  static findOptimalConnectionPoints(roomA, roomB) {
    return new ConnectionPoints(roomA.getOptimalConnectionPoint(roomB), roomB.getOptimalConnectionPoint(roomA));
  }

  static getRandomCorridorStyle(context, start, end) {
    const reg = context.reg;
    const candidates = (context.def.corridorstyles ?? [])
      .map((entry) => {
        const def = reg.def('corridorstyles', entry.style);
        const Cls = reg.dungeonClass('corridorpath', def.workerclass);
        return { value: new Cls(def), weight: entry.weight ?? 1 };
      })
      .filter((entry) => entry.weight > 0 && entry.value.fitnessTest(context, start, end));

    if (!candidates.length) throw new Error(`dungeon ${context.dungeon.defId} has no corridor style that fits ${start.x},${start.y} to ${end.x},${end.y}`);
    return context.rng.weighted(candidates);
  }
}
