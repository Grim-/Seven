import { rollAction, type Action, type ActionResult } from '@shared/actions'
import type { Decision } from '@shared/decisions'
import { rollText } from './library/kinds'
import { findSheet, getSheet } from './library/sheets'
import { agentAccess } from './agents/access'
import { ToolError } from './tools/types'

export function rollFor(action: Action, character: string | null, pick: number | null = null): ActionResult {
  const who = character ?? (action.by ? (agentAccess.get(action.by)?.sheet ?? null) : null)
  const id = who ? findSheet(who) : null
  if (who && !id) throw new ToolError(`No character "${who}". find with kind sheet lists them; leave character null for a plain chance.`)
  const s = id ? getSheet(id) : null
  const result = rollAction(action, s?.dnd ?? null, s ? { sheet: s.id, name: s.title, image: s.image } : null, pick)
  return { ...result, outcome: rollText(result.outcome).text }
}

export function rollDecision(d: Decision): Decision {
  return { ...d, question: rollText(d.question).text, options: d.options.map((o) => ({ ...o, text: rollText(o.text).text })) }
}
