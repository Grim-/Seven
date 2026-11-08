export function rangeInclusive(rng, min, max) {
  if (max <= min) return min;
  return min + rng.int(max - min + 1);
}

export function rangeExclusive(rng, min, max) {
  if (max <= min) return min;
  return min + rng.int(max - min);
}

export function randomInRange(rng, range) {
  return rangeInclusive(rng, range[0], range[1]);
}

export function floatInRange(rng, range) {
  return rng.range(range[0], range[1]);
}

export function randomElement(rng, list) {
  return list.length ? rng.pick(list) : null;
}

export function shuffle(rng, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function minBy(list, score) {
  let best = null;
  let bestScore = Infinity;
  for (const item of list) {
    const value = score(item);
    if (value < bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

export function maxBy(list, score) {
  return minBy(list, (item) => -score(item));
}
