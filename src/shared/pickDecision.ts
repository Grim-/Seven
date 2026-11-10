import { NO_ROLL, cleanOptionRoll, rolledCheckText, type OptionRoll, type RolledCheck } from './storyRolls'
import type { RollerChoice } from './storedDecision'

export interface PickOption {
  text: string
  roll: OptionRoll
  action?: string | null
}

export interface PickDecisionProps {
  question: string
  options: PickOption[]
  own: boolean
  character: string | null
  roller?: RollerChoice
  from: string | null
}

export interface PickAnswer {
  option: string
  own: boolean
  character: string | null
  overridden?: boolean
  roll: OptionRoll
  check: RolledCheck | null
}

export function cleanPickOption(raw: unknown): PickOption | null {
  if (typeof raw === 'string') return raw.trim() ? { text: raw.trim(), roll: NO_ROLL, action: null } : null
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const action = typeof v.action === 'string' && v.action.trim() ? v.action.trim() : null
  return typeof v.text === 'string' && v.text.trim() ? { text: v.text.trim(), roll: cleanOptionRoll(v.roll), action } : null
}

export function pickMadeText(p: Pick<PickDecisionProps, 'question' | 'from'>, a: PickAnswer, who: string | null, agentWho?: string | null): string {
  const overridden = a.overridden && agentWho && who && agentWho !== who ? `${who} rolled instead of ${agentWho}. ` : ''
  return [
    'DECISION MADE BY THE USER',
    `"${p.question}"${p.from ? ` (${p.from})` : ''} The user chose: ${a.option}`,
    ...(a.check ? [`${overridden}${who ? `${who}, ` : ''}${rolledCheckText(a.check)}`] : []),
    'Play this out.'
  ].join('\n')
}
