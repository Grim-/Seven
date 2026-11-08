export function hash32(...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    let x = n >>> 0;
    for (let i = 0; i < 4; i++) {
      h ^= (x >>> (i * 8)) & 0xff;
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export class Rng {
  constructor(seed, stream = 0, tick = 0, entity = 0) {
    this.seed = seed >>> 0;
    this.stream = stream >>> 0;
    this.tick = tick >>> 0;
    this.entity = entity >>> 0;
    this.counter = 0;
  }

  static stream(name) {
    return hash32(...[...name].map((c) => c.charCodeAt(0)));
  }

  next() {
    return hash32(this.seed, this.stream, this.tick, this.entity, this.counter++);
  }

  float() {
    return this.next() / 4294967296;
  }

  range(min, max) {
    return min + this.float() * (max - min);
  }

  int(maxExclusive) {
    return this.next() % maxExclusive;
  }

  bool() {
    return (this.next() & 1) === 1;
  }

  chance(p) {
    return this.float() < p;
  }

  pick(arr) {
    return arr[this.int(arr.length)];
  }

  weighted(entries) {
    let total = 0;
    for (const e of entries) total += e.weight;
    let r = this.float() * total;
    for (const e of entries) {
      r -= e.weight;
      if (r <= 0) return e.value;
    }
    return entries[entries.length - 1].value;
  }

  fork(salt) {
    const r = new Rng(this.seed, this.stream, this.tick, this.entity);
    r.counter = hash32(this.counter, salt) % 1000000;
    return r;
  }
}

const streams = new Map();

function streamOf(purpose) {
  let s = streams.get(purpose);
  if (s === undefined) {
    s = Rng.stream(purpose);
    streams.set(purpose, s);
  }
  return s;
}

export function seedOf(text) {
  return hash32(...[...String(text)].map((c) => c.charCodeAt(0)));
}

export function randomInt32(seed, purpose, maxExclusive, tick = 0, n = 0) {
  return hash32(seed, streamOf(purpose), tick, 0, n) % maxExclusive;
}

export function randomFloat(seed, purpose, tick = 0, n = 0) {
  return hash32(seed, streamOf(purpose), tick, 0, n) / 4294967296;
}

export function randomRange(seed, purpose, min, max, tick = 0, n = 0) {
  return min + randomFloat(seed, purpose, tick, n) * (max - min);
}

export function randomBool(seed, purpose, tick = 0, n = 0) {
  return (hash32(seed, streamOf(purpose), tick, 0, n) & 1) === 1;
}

export function randomChance(seed, purpose, p, tick = 0, n = 0) {
  return randomFloat(seed, purpose, tick, n) < p;
}

export function randomPick(seed, purpose, arr, tick = 0, n = 0) {
  return arr[randomInt32(seed, purpose, arr.length, tick, n)];
}

export function randomWeighted(seed, purpose, entries, tick = 0, n = 0) {
  let total = 0;
  for (const e of entries) total += e.weight;
  let r = randomFloat(seed, purpose, tick, n) * total;
  for (const e of entries) {
    r -= e.weight;
    if (r <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}
