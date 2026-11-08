export const LAND = 1;
export const VOID = 0;
export const BARRIER = 255;
export const MAX_EDGE_RINGS = 8;

export const CARDINALS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIAGONALS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
export const AROUND = [...CARDINALS, ...DIAGONALS];

export function interiorLand(options = {}) {
  return (options.rim ?? 2) + 1;
}

export function regionsOf(mask, width, height) {
  const seen = new Uint8Array(width * height);
  const regions = [];

  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || mask[start] !== LAND) continue;

    const region = [];
    const stack = [start];
    seen[start] = 1;

    while (stack.length) {
      const at = stack.pop();
      region.push(at);

      const x = at % width;
      const y = (at - x) / width;

      for (const [dx, dy] of CARDINALS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const next = ny * width + nx;
        if (seen[next] || mask[next] !== LAND) continue;

        seen[next] = 1;
        stack.push(next);
      }
    }

    regions.push(region);
  }

  return regions;
}

export function clearEdge(grid, inEdge) {
  const { mask, width, height } = grid;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inEdge(x, y)) mask[y * width + x] = VOID;
    }
  }
}

export function edgeRings(grid, rings, interior) {
  const { mask, width, height } = grid;
  const out = new Uint8Array(width * height).fill(interior);
  const distance = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== VOID) continue;
    out[i] = BARRIER;
    distance[i] = 0;
    queue[tail++] = i;
  }

  while (head < tail) {
    const cell = queue[head++];
    const next = distance[cell] + 1;
    if (next > rings) continue;

    const x = cell % width;
    const y = (cell - x) / width;

    for (const [dx, dy] of AROUND) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const index = ny * width + nx;
      if (distance[index] >= 0) continue;

      distance[index] = next;
      out[index] = BARRIER - next;
      queue[tail++] = index;
    }
  }

  return out;
}

export function keepLargest(grid) {
  const { mask, width, height } = grid;
  const regions = regionsOf(mask, width, height).sort((a, b) => b.length - a.length);

  for (let i = 1; i < regions.length; i++) {
    for (const cell of regions[i]) mask[cell] = VOID;
  }
}

export function fillEnclosed(grid) {
  const { mask, width, height } = grid;
  const open = new Uint8Array(width * height);
  const stack = [];

  for (let x = 0; x < width; x++) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    stack.push(y * width, y * width + width - 1);
  }

  while (stack.length) {
    const cell = stack.pop();
    if (open[cell] || mask[cell] !== VOID) continue;
    open[cell] = 1;

    const x = cell % width;
    const y = (cell - x) / width;

    for (const [dx, dy] of CARDINALS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      stack.push(ny * width + nx);
    }
  }

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === VOID && !open[i]) mask[i] = LAND;
  }
}
