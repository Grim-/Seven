import { chanceOf, findTarget, type CheckRoll, type CheckTarget } from './actions'

export type OptionRoll = { type: 'none' } | { type: 'chance'; chance: number } | { type: 'check'; against: string; dc: number }

export const NO_ROLL: OptionRoll = { type: 'none' }

export interface RolledCheck extends CheckRoll {
  forced: boolean
}

export const rollDie = (sides: number): number => 1 + Math.floor(Math.random() * sides)

const percent = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

export function cleanOptionRoll(raw: unknown): OptionRoll {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (v.type === 'chance' && typeof v.chance === 'number') return { type: 'chance', chance: percent(v.chance) }
  if (v.type === 'check' && typeof v.against === 'string' && v.against.trim() && typeof v.dc === 'number') return { type: 'check', against: v.against.trim(), dc: Math.round(v.dc) }
  return NO_ROLL
}

export function optionRollFrom(chance: unknown, against: unknown, dc: unknown): OptionRoll {
  if (typeof against === 'string' && against.trim() && typeof dc === 'number') return { type: 'check', against: against.trim(), dc: Math.round(dc) }
  if (typeof chance === 'number') return { type: 'chance', chance: percent(chance) }
  return NO_ROLL
}

export function checkOf(roll: OptionRoll, targets: CheckTarget[]): Pick<CheckRoll, 'label' | 'bonus' | 'target' | 'chance'> | null {
  if (roll.type === 'none') return null
  if (roll.type === 'chance') return { label: 'Chance', bonus: 0, target: 101 - roll.chance, chance: roll.chance / 100 }
  const found = findTarget(targets, roll.against)
  const bonus = found?.bonus ?? 0
  return { label: found?.label ?? roll.against, bonus, target: roll.dc, chance: chanceOf(bonus, roll.dc) }
}

export function rollCheck(roll: OptionRoll, targets: CheckTarget[], force: boolean | null): RolledCheck | null {
  const check = checkOf(roll, targets)
  if (!check) return null
  const face = rollDie(roll.type === 'chance' ? 100 : 20)
  const total = face + check.bonus
  return { ...check, roll: face, total, passed: force ?? total >= check.target, forced: force !== null }
}

export function rolledCheckText(r: RolledCheck): string {
  if (r.forced) return `${r.label}: the user made it ${r.passed ? 'pass' : 'fail'}.`
  const sum = r.bonus ? ` ${r.bonus < 0 ? '-' : '+'} ${Math.abs(r.bonus)} = ${r.total}` : ''
  return `${r.label} ${r.roll}${sum} against ${r.target}: ${r.passed ? 'passes' : 'fails'}.`
}

export function optionRollLabel(roll: OptionRoll): string {
  if (roll.type === 'chance') return `${roll.chance}%`
  if (roll.type === 'check') return `${roll.against} vs DC ${roll.dc}`
  return 'no roll'
}
