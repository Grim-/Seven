import { chanceOf, findTarget, type CheckTarget } from './actions'
import { rollDie } from './storyRolls'
import { cleanComponents, type ComponentDef } from './game/core'
import { storedPiece } from './game/components/action/storedPiece'

export interface OpposedSide {
  name: string
  sheet: string | null
  does: string
  against: string
  bonus: number
  action?: string | null
  loses?: string
  effects?: ComponentDef[]
}

export const WIN_EVENT = 'OnWin'
export const LOSE_EVENT = 'OnLose'

export const SIDE_LANES = [
  { event: WIN_EVENT, label: 'On a win' },
  { event: LOSE_EVENT, label: 'On a loss' }
]

export function sideEffects(side: OpposedSide): ComponentDef[] {
  return [...storedPiece(side.action ?? null, WIN_EVENT), ...(side.effects ?? [])]
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

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)

function cleanSide(v: unknown): OpposedSide {
  const s = obj(v)
  return { name: str(s.name, 80), sheet: str(s.sheet, 120) || null, does: str(s.does, 400), against: str(s.against, 60), bonus: num(s.bonus), action: str(s.action, 120) || null, loses: str(s.loses, 400), effects: cleanComponents(s.effects) }
}

export function cleanOpposed(v: unknown): OpposedProps {
  const p = obj(v)
  return { question: str(p.question, 400), a: cleanSide(p.a), b: cleanSide(p.b), dc: typeof p.dc === 'number' && Number.isFinite(p.dc) ? Math.round(p.dc) : null }
}

const rollLine = (side: OpposedSide, r: OpposedRoll) => `${side.name} ${r.label} ${r.roll} ${r.bonus < 0 ? '-' : '+'} ${Math.abs(r.bonus)} = ${r.total}`

export function opposedText(r: OpposedAnswer, effects: string[] = []): string {
  const won = r.winner === 'a' ? r.a : r.b
  const lost = r.winner === 'a' ? r.b : r.a
  const how = r.forced ? 'The user decided it.' : `${r.aRoll ? rollLine(r.a, r.aRoll) : ''} against ${r.bRoll ? rollLine(r.b, r.bRoll) : `DC ${r.dc}`}.`
  return ['OPPOSED CHECK', `"${r.question}" ${how}`, `${won.name} wins: ${won.does}.`, ...(lost.loses ? [`${lost.name} loses: ${lost.loses}.`] : []), ...effects, 'Play this out.'].join('\n')
}
