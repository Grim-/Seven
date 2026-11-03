import { chanceOf, findTarget, type CheckTarget } from './actions'
import { rollDie } from './storyRolls'

export interface OpposedSide {
  name: string
  sheet: string | null
  does: string
  against: string
  bonus: number
}

export interface OpposedProps {
  question: string
  a: OpposedSide
  b: OpposedSide
  dc: number | null
}

export interface OpposedRoll {
  label: string
  roll: number
  bonus: number
  total: number
}

export type OpposedWinner = 'a' | 'b'

export interface OpposedAnswer extends OpposedProps {
  aRoll: OpposedRoll | null
  bRoll: OpposedRoll | null
  winner: OpposedWinner
  forced: boolean
}

export function sideBonus(side: OpposedSide, targets: CheckTarget[]): { label: string; bonus: number } {
  const found = side.sheet ? findTarget(targets, side.against) : null
  return { label: found?.label ?? side.against, bonus: found?.bonus ?? side.bonus }
}

export function opposedChance(a: number, b: number, dc: number | null): number {
  if (dc !== null) return chanceOf(a, dc)
  let wins = 0
  for (let i = 1; i <= 20; i++) for (let j = 1; j <= 20; j++) if (i + a > j + b) wins++
  return wins / 400
}

const rolled = (s: { label: string; bonus: number }): OpposedRoll => {
  const roll = rollDie(20)
  return { label: s.label, roll, bonus: s.bonus, total: roll + s.bonus }
}

export function rollOpposed(p: OpposedProps, a: { label: string; bonus: number }, b: { label: string; bonus: number }, force: OpposedWinner | null): OpposedAnswer {
  if (force) return { ...p, aRoll: null, bRoll: null, winner: force, forced: true }
  const aRoll = rolled(a)
  if (p.dc !== null) return { ...p, aRoll, bRoll: null, winner: aRoll.total >= p.dc ? 'a' : 'b', forced: false }
  const bRoll = rolled(b)
  return { ...p, aRoll, bRoll, winner: aRoll.total > bRoll.total ? 'a' : 'b', forced: false }
}

const rollLine = (side: OpposedSide, r: OpposedRoll) => `${side.name} ${r.label} ${r.roll} ${r.bonus < 0 ? '-' : '+'} ${Math.abs(r.bonus)} = ${r.total}`

export function opposedText(r: OpposedAnswer): string {
  const won = r.winner === 'a' ? r.a : r.b
  const how = r.forced ? 'The user decided it.' : `${r.aRoll ? rollLine(r.a, r.aRoll) : ''} against ${r.bRoll ? rollLine(r.b, r.bRoll) : `DC ${r.dc}`}.`
  return ['OPPOSED CHECK', `"${r.question}" ${how}`, `${won.name} wins: ${won.does}.`, 'Play this out.'].join('\n')
}
