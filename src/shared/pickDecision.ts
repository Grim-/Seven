import { NO_ROLL, cleanOptionRoll, rolledCheckText, type OptionRoll, type RolledCheck } from './storyRolls'

export interface PickOption {
  text: string
  roll: OptionRoll
}

export interface PickDecisionProps {
  question: string
  options: PickOption[]
  own: boolean
  character: string | null
  from: string | null
}

export interface PickAnswer {
  option: string
  own: boolean
  character: string | null
  roll: OptionRoll
  check: RolledCheck | null
}

export function cleanPickOption(raw: unknown): PickOption | null {
  if (typeof raw === 'string') return raw.trim() ? { text: raw.trim(), roll: NO_ROLL } : null
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return typeof v.text === 'string' && v.text.trim() ? { text: v.text.trim(), roll: cleanOptionRoll(v.roll) } : null
}

export function pickMadeText(p: Pick<PickDecisionProps, 'question' | 'from'>, a: PickAnswer, who: string | null): string {
  return [
    'DECISION MADE BY THE USER',
    `"${p.question}"${p.from ? ` (${p.from})` : ''} The user chose: ${a.option}`,
    ...(a.check ? [`${who ? `${who}, ` : ''}${rolledCheckText(a.check)}`] : []),
    'Play this out.'
  ].join('\n')
}
