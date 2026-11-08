import { randomFloat } from './Rng.js';

const DEFAULT_SCALE = 0.12;

export function noiseAt(seed, x, y, scale = DEFAULT_SCALE) {
  const fx = x * scale;
  const fy = y * scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);

  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);

  const a = lattice(seed, x0, y0);
  const b = lattice(seed, x0 + 1, y0);
  const c = lattice(seed, x0, y0 + 1);
  const d = lattice(seed, x0 + 1, y0 + 1);

  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function lattice(seed, x, y) {
  return randomFloat(seed, 'ground', x, y);
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function octavesNoise(seed, x, y, octaves, scale, roughness = 0.5) {
  let total = 0;
  let freq = 1;
  let amp = 1;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    total += noiseAt(seed + i * 31, x * freq, y * freq, scale) * amp;
    max += amp;
    amp *= roughness;
    freq *= 2;
  }

  return max ? total / max : 0;
}
