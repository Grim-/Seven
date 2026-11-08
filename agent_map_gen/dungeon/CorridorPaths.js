import { CorridorPathBase, distinctCells, roundHalfEven } from './CorridorPathBase.js';
import { distance, cellKey, sameCell } from '../CellRect.js';
import { rangeInclusive } from '../DungeonRand.js';
import { noiseAt } from '../Noise.js';

function normalised(x, y) {
  const length = Math.sqrt(x * x + y * y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function quadraticBezier(p0, p1, p2, t) {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
    y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
  };
}

export class StraightCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const path = [];
    if (start.x === end.x || start.y === end.y) {
      this.addPointsAlongLine(path, start, end);
      return path;
    }
    const horizontalFirst = context.rng ? context.rng.float() > 0.5 : true;
    const corner = horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
    this.addPointsAlongLine(path, start, corner);
    this.addPointsAlongLine(path, corner, end);
    return distinctCells(path);
  }
}

export class LShapedCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const path = [];
    const horizontalFirst = this.def.preferhorizontalfirst ? true : context.rng.float() > 0.5;
    const corner = horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };

    if (this.def.cornerrounding > 0) {
      path.push(...this.generateRoundedLShape(start, corner, end, this.def.cornerrounding));
    } else {
      this.addPointsAlongLine(path, start, corner);
      this.addPointsAlongLine(path, corner, end);
    }

    return distinctCells(path);
  }

  generateRoundedLShape(start, corner, end, radius) {
    const path = [];
    const dir1 = normalised(corner.x - start.x, corner.y - start.y);
    const dir2 = normalised(end.x - corner.x, end.y - corner.y);
    const roundRadius = roundHalfEven(radius);

    const roundStart = { x: corner.x - roundHalfEven(dir1.x * roundRadius), y: corner.y - roundHalfEven(dir1.y * roundRadius) };
    const roundEnd = { x: corner.x + roundHalfEven(dir2.x * roundRadius), y: corner.y + roundHalfEven(dir2.y * roundRadius) };

    this.addPointsAlongLine(path, start, roundStart);
    for (let i = 0; i <= roundRadius; i++) {
      const t = roundRadius === 0 ? 0 : i / roundRadius;
      path.push({
        x: roundHalfEven(roundStart.x + (roundEnd.x - roundStart.x) * t),
        y: roundHalfEven(roundStart.y + (roundEnd.y - roundStart.y) * t),
      });
    }
    this.addPointsAlongLine(path, roundEnd, end);

    return path;
  }
}

export class CurvedCorridorPath extends CorridorPathBase {
  fitnessTest(context, start, end) {
    if (distance(start, end) < (this.def.mindistance ?? 10)) return false;
    return super.fitnessTest(context, start, end);
  }

  generatePath(context, start, end) {
    const path = [];
    const length = distance(start, end);
    const direction = length > 0 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : { x: 0, y: 0 };
    const perpendicular = { x: -direction.y, y: direction.x };
    const curvature = this.def.curvature ?? 0.3;
    const control = {
      x: (start.x + end.x) / 2 + perpendicular.x * length * curvature,
      y: (start.y + end.y) / 2 + perpendicular.y * length * curvature,
    };

    const steps = roundHalfEven(length * (this.def.stepsperdistance ?? 1.5));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const point = quadraticBezier(start, control, end, t);
      path.push({ x: roundHalfEven(point.x), y: roundHalfEven(point.y) });
    }

    return distinctCells(path);
  }
}

export class DoubleLCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const path = [];
    const t = this.def.midpointoffset ?? 0.5;
    const splitX = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);

    if (splitX) {
      const midX = roundHalfEven(start.x + (end.x - start.x) * t);
      const corner1 = { x: midX, y: start.y };
      const corner2 = { x: midX, y: end.y };
      this.addPointsAlongLine(path, start, corner1);
      this.addPointsAlongLine(path, corner1, corner2);
      this.addPointsAlongLine(path, corner2, end);
    } else {
      const midY = roundHalfEven(start.y + (end.y - start.y) * t);
      const corner1 = { x: start.x, y: midY };
      const corner2 = { x: end.x, y: midY };
      this.addPointsAlongLine(path, start, corner1);
      this.addPointsAlongLine(path, corner1, corner2);
      this.addPointsAlongLine(path, corner2, end);
    }

    return distinctCells(path);
  }
}

export class JaggedCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const deviationdivisor = this.def.deviationdivisor ?? 6;
    const jagchance = this.def.jagchance ?? 0.4;
    const rng = context.rng;
    const path = [start];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const maxDeviation = Math.max(1, Math.trunc(steps / deviationdivisor));

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      let x = start.x + roundHalfEven(dx * t);
      let y = start.y + roundHalfEven(dy * t);

      if (rng.float() < jagchance) {
        x += rangeInclusive(rng, -maxDeviation, maxDeviation);
        y += rangeInclusive(rng, -maxDeviation, maxDeviation);
      }

      path.push({ x, y });
    }

    path.push(end);
    return path;
  }
}

export class ZigzagCorridorPath extends CorridorPathBase {
  fitnessTest(context, start, end) {
    if (distance(start, end) < (this.def.mindistance ?? 10)) return false;
    return super.fitnessTest(context, start, end);
  }

  generatePath(context, start, end) {
    const path = [];
    const segments = this.def.segments ?? 4;
    const zigzagoffset = this.def.zigzagoffset ?? 3;
    const length = distance(start, end);
    const direction = length > 0 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : { x: 0, y: 0 };
    const perpendicular = { x: -direction.y, y: direction.x };

    const waypoints = [start];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const offset = (i % 2 === 0 ? 1 : -1) * zigzagoffset;
      waypoints.push({
        x: start.x + (end.x - start.x) * t + perpendicular.x * offset,
        y: start.y + (end.y - start.y) * t + perpendicular.y * offset,
      });
    }
    waypoints.push(end);

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = { x: roundHalfEven(waypoints[i].x), y: roundHalfEven(waypoints[i].y) };
      const to = { x: roundHalfEven(waypoints[i + 1].x), y: roundHalfEven(waypoints[i + 1].y) };
      this.addPointsAlongLine(path, from, to);
    }

    return distinctCells(path);
  }
}

export class OrganicCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const noise = this.def.noise ?? 0.3;
    const smoothingpasses = this.def.smoothingpasses ?? 2;
    const noisefrequency = this.def.noisefrequency ?? 0.2;
    const seedoffset = this.def.seedoffset ?? 777;
    const seed = context.seed + seedoffset;
    const path = [];
    const length = roundHalfEven(distance(start, end));
    const steps = length * 2;

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const baseX = start.x + (end.x - start.x) * t;
      const baseY = start.y + (end.y - start.y) * t;
      const falloff = noise * length * Math.sin(t * Math.PI);
      const offsetX = (noiseAt(seed, t * noisefrequency, 0, 1) - 0.5) * falloff;
      const offsetY = (noiseAt(seed, 0, t * noisefrequency, 1) - 0.5) * falloff;
      path.push({ x: roundHalfEven(baseX + offsetX), y: roundHalfEven(baseY + offsetY) });
    }

    return this.smoothPath(distinctCells(path), smoothingpasses);
  }

  smoothPath(path, passes) {
    for (let pass = 0; pass < passes && path.length > 2; pass++) {
      const smoothed = [path[0]];
      for (let i = 1; i < path.length - 1; i++) {
        smoothed.push({
          x: roundHalfEven((path[i - 1].x + path[i].x + path[i + 1].x) / 3),
          y: roundHalfEven((path[i - 1].y + path[i].y + path[i + 1].y) / 3),
        });
      }
      smoothed.push(path[path.length - 1]);
      path = smoothed;
    }
    return path;
  }
}

export class DrunkWalkCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const drunkeness = this.def.drunkeness ?? 0.3;
    const maxsteps = this.def.maxsteps ?? 2000;
    const rng = context.rng;
    const path = [start];
    let current = start;
    let steps = 0;

    while (!sameCell(current, end) && steps < maxsteps) {
      const toTarget = normalised(end.x - current.x, end.y - current.y);
      const randomDir = normalised(rng.range(-1, 1), rng.range(-1, 1));
      const finalDir = normalised(
        toTarget.x + (randomDir.x - toTarget.x) * drunkeness,
        toTarget.y + (randomDir.y - toTarget.y) * drunkeness,
      );

      const next = { x: current.x + roundHalfEven(finalDir.x), y: current.y + roundHalfEven(finalDir.y) };
      if (!sameCell(next, current)) {
        path.push(next);
        current = next;
      }
      steps++;
    }

    if (!sameCell(current, end)) this.addPointsAlongLine(path, current, end);
    return distinctCells(path);
  }
}

export class BranchingCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const path = [];
    if (start.x === end.x || start.y === end.y) {
      this.addPointsAlongLine(path, start, end);
      return path;
    }
    const horizontalFirst = context.rng ? context.rng.float() > 0.5 : true;
    const corner = horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
    this.addPointsAlongLine(path, start, corner);
    this.addPointsAlongLine(path, corner, end);
    return distinctCells(path);
  }
}

export class PathfinderCorridorPath extends CorridorPathBase {
  generatePath(context, start, end) {
    const path = [];
    this.addPointsAlongLine(path, start, end);
    return path;
  }
}

export const CORRIDOR_PATH_CLASSES = {
  straight: StraightCorridorPath,
  lshaped: LShapedCorridorPath,
  curved: CurvedCorridorPath,
  doublel: DoubleLCorridorPath,
  jagged: JaggedCorridorPath,
  zigzag: ZigzagCorridorPath,
  organic: OrganicCorridorPath,
  drunkwalk: DrunkWalkCorridorPath,
  branching: BranchingCorridorPath,
  pathfinder: PathfinderCorridorPath,
  StraightCorridorPath,
  LShapedCorridorPath,
  CurvedCorridorPath,
  DoubleLCorridorPath,
  JaggedCorridorPath,
  ZigzagCorridorPath,
  OrganicCorridorPath,
  DrunkWalkCorridorPath,
  BranchingCorridorPath,
  PathfinderCorridorPath,
};
