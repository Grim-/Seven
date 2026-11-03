export const DICE = [4, 6, 8, 10, 12, 20]

export interface RolledDecisionProps {
  question: string
  die: number
  options: string[]
  from: string | null
}

export interface RolledAnswer {
  roll: number
  option: string
}

export function rolledMadeText(p: RolledDecisionProps, a: RolledAnswer): string {
  return ['ROLLED DECISION', `"${p.question}"${p.from ? ` (${p.from})` : ''} d${p.die} rolled ${a.roll}: ${a.option}`, 'Play this out.'].join('\n')
}
