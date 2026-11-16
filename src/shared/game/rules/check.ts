import { evaluate, type CheckDef, type GameEntity } from '../core'
import { Stats } from '../components/Stats'

export type DieRoller = (sides: number) => number

export interface DieFace {
  sides: number
  face: number
}

export interface CheckRoll {
  check: string
  label: string
  faces: DieFace[]
  roll: number
  bonus: number
  total: number
}

export type CheckAgainst = { dc: number } | { roll: CheckRoll }

export interface CheckResult {
  roll: CheckRoll
  against: CheckAgainst
  passed: boolean
}

function scope(entity: GameEntity | null, faces: DieFace[], die: DieRoller) {
  return {
    value: (name: string) => {
      const [who, stat] = name.split('.')
      return who === 'user' && entity && stat ? entity.comp(Stats)?.value(stat) : undefined
    },
    dice: (count: number, sides: number) => {
      let total = 0
      for (let i = 0; i < count; i++) {
        const face = die(sides)
        faces.push({ sides, face })
        total += face
      }
      return total
    }
  }
}

export function checkBonus(entity: GameEntity, check: CheckDef): number {
  return evaluate(check.bonus, scope(entity, [], () => 0)) + entity.modifyStat('check', check.id, 0)
}

export function rollCheck(entity: GameEntity, check: CheckDef, die: DieRoller): CheckRoll {
  const faces: DieFace[] = []
  const roll = evaluate(check.dice, scope(null, faces, die))
  const bonus = evaluate(check.bonus, scope(entity, faces, die)) + entity.modifyStat('check', check.id, 0)
  return { check: check.id, label: check.label, faces, roll, bonus, total: roll + bonus }
}

export function contest(roll: CheckRoll, against: CheckAgainst): CheckResult {
  const passed = 'dc' in against ? roll.total >= against.dc : roll.total > against.roll.total
  return { roll, against, passed }
}

const signed = (n: number) => `${n < 0 ? '-' : '+'} ${Math.abs(n)}`

export function rollLine(who: string, r: CheckRoll): string {
  return `${who} rolled ${r.label} ${r.roll} ${signed(r.bonus)} = ${r.total}`
}

export function checkText(question: string, who: string, result: CheckResult, opponent: string, outcome: string): string {
  const against = 'dc' in result.against ? `against DC ${result.against.dc}` : `against ${rollLine(opponent, result.against.roll)}`
  return ['CHECK', `"${question}" ${rollLine(who, result.roll)} ${against}: ${result.passed ? 'success' : 'failure'}.`, outcome, 'Play this out.'].filter(Boolean).join('\n')
}
