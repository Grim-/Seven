import type { AvatarSignals } from './signals'

const WARM = [74, 222, 128]
const BRIGHT = [250, 204, 21]
const HOT = [255, 30, 60]
const COLD = [60, 90, 170]

const mix = (a: number[], b: number[], p: number) => a.map((v, i) => Math.round(v + (b[i] - v) * p))

export function moodRgb(energy: number, warmth: number): number[] {
  return warmth >= 0 ? mix(WARM, BRIGHT, Math.max(0, energy)) : energy >= 0 ? HOT : COLD
}

export function moodColor(s: AvatarSignals): string {
  return `rgb(${moodRgb(s.mood.energy * s.mood.strength, s.mood.warmth * s.mood.strength).join(',')})`
}
