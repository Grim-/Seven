import { toId } from './ids'
import { cleanPickOption, type PickOption } from './pickDecision'
import { DICE } from './rolledDecision'
import { optionRollLabel } from './storyRolls'

export type DecisionMode = 'pick' | 'roll'

export interface StoredDecision {
  id: string
  name: string
  mode: DecisionMode
  prompt: string
  die: number
  count: number
  options: PickOption[]
  tags: string[]
}

export function cleanTagList(raw: unknown): string[] {
  return [...new Set((Array.isArray(raw) ? raw : []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
}

export function blankDecision(): StoredDecision {
  return { id: '', name: '', mode: 'pick', prompt: '', die: DICE[0], count: DICE[0], options: [], tags: [] }
}

export function cleanStoredDecision(raw: unknown): StoredDecision | null {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = typeof v.name === 'string' ? v.name.trim() : ''
  if (!name) return null
  const die = DICE.includes(Number(v.die)) ? Number(v.die) : DICE[0]
  const count = Number.isInteger(v.count) && Number(v.count) > 0 ? Number(v.count) : DICE[0]
  const options = (Array.isArray(v.options) ? v.options : []).map(cleanPickOption).filter((o): o is PickOption => o !== null)
  const tags = cleanTagList(v.tags)
  const id = (typeof v.id === 'string' && toId(v.id)) || toId(name)
  return { id, name, mode: v.mode === 'roll' ? 'roll' : 'pick', prompt: typeof v.prompt === 'string' ? v.prompt.trim() : '', die, count, options, tags }
}

export const decisionSize = (d: StoredDecision): number => (d.mode === 'roll' ? d.die : d.count)

export function decisionModeLabel(d: StoredDecision): string {
  return d.mode === 'roll' ? `rolled on a d${d.die}` : 'the user picks'
}

export function storedDecisionText(d: StoredDecision): string {
  const kept = d.options.map((o) => `- ${o.text}${d.mode === 'pick' && o.roll.type !== 'none' ? ` (${optionRollLabel(o.roll)})` : ''}`)
  const write = d.mode === 'roll' ? `write ${d.die} options from the prompt` : `write ${d.count} options from the prompt, giving each that can fail a chance or a check against a DC`
  const use = d.mode === 'roll' ? 'roll_decision' : 'decide'
  return [
    `Decision "${d.name}", ${decisionModeLabel(d)}${d.tags.length ? `; tags: ${d.tags.join(', ')}` : ''}.`,
    d.prompt ? `Prompt: ${d.prompt}` : '',
    kept.length ? `Options:\n${kept.join('\n')}` : `No options are kept: ${write}.`,
    `To use it, call ${use} with from "@story_decision:${d.id}".`
  ]
    .filter(Boolean)
    .join('\n')
}
