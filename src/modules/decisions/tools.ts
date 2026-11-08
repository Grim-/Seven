import type { JsonSchema } from '../../engine/tools/schema'
import { linkFor } from '@shared/text'
import { pickMadeText, type PickAnswer, type PickOption } from '@shared/pickDecision'
import { DICE, rolledMadeText, type RolledAnswer } from '@shared/rolledDecision'
import { opposedText, type OpposedAnswer, type OpposedSide } from '@shared/opposedCheck'
import { optionRollFrom } from '@shared/storyRolls'
import { isLater, laterDecisionText } from '@shared/uiLater'
import { CHANCE, checkNames, cleanAction } from '@shared/actions'
import type { DecisionMode, RollerChoice, StoredDecision } from '@shared/storedDecision'
import { ToolError, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { agentAccess } from '../../engine/agents/access'
import { findSheet, getSheet } from '../../engine/library/sheets'
import { decisions, storyActions } from './store'

type Json = Record<string, unknown>

const CHECK_IDS = checkNames().map((c) => c.id)

const OPTION: JsonSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    chance: { type: ['number', 'null'], description: 'percent' },
    against: { oneOf: [{ type: 'null' }, { enum: CHECK_IDS }] },
    dc: { type: ['number', 'null'] }
  }
}

const SIDE: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    character: { type: ['string', 'null'] },
    does: { type: 'string', description: 'what winning means, e.g. spots the lie' },
    against: { enum: CHECK_IDS },
    bonus: { type: ['number', 'null'], description: 'if no sheet' }
  }
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function pickOptions(raw: unknown): PickOption[] {
  return (Array.isArray(raw) ? raw : [])
    .map((o) => {
      const v = (o ?? {}) as Json
      return typeof v.text === 'string' && v.text.trim() ? { text: v.text.trim(), roll: optionRollFrom(v.chance, v.against, v.dc) } : null
    })
    .filter((o): o is PickOption => o !== null)
}

function stored(raw: unknown, mode: DecisionMode): StoredDecision | null {
  const ref = str(raw)
  if (!ref) return null
  const d = decisions.find(ref)
  if (!d) throw new ToolError(`No story_decision "${ref}". find with kind story_decision lists them.`)
  if (d.mode !== mode) throw new ToolError(`${d.name} is ${mode === 'roll' ? 'picked by the user; use decide' : 'rolled on a die; use roll_decision'}.`)
  return d
}

function sheetOf(raw: unknown, ctx: ToolContext): string | null {
  const who = str(raw) ?? agentAccess.get(ctx.agentId ?? '')?.sheet ?? null
  if (!who) return null
  const id = findSheet(who)
  if (!id) throw new ToolError(`No character "${who}". find with kind sheet lists them.`)
  return id
}

function side(raw: unknown, which: string): OpposedSide {
  const v = (raw ?? {}) as Json
  const name = str(v.name)
  const against = str(v.against)
  if (!name || !against) throw new ToolError(`${which} needs a name and what they roll (against).`)
  const character = str(v.character)
  const sheet = character ? findSheet(character) : null
  if (character && !sheet) throw new ToolError(`No character "${character}". find with kind sheet lists them, or leave character null and give a bonus.`)
  return { name, sheet, does: str(v.does) ?? 'wins', against, bonus: typeof v.bonus === 'number' ? Math.round(v.bonus) : 0 }
}

function sheetName(id: string | null): string | null {
  if (!id) return null
  try {
    return getSheet(id).title
  } catch {
    return null
  }
}

const base = { group: 'decisions', needsWorkspace: false, permission: 'none' as const }

const decide: ToolDef = {
  ...base,
  name: 'decide',
  maxRepeats: 1,
  activity: () => 'asking for a decision',
  description: 'The user picks one of your options; an option that can fail gets a chance or a check against a DC. from: a stored @story_decision.',
  params: {
    type: 'object',
    properties: {
      question: { type: ['string', 'null'] },
      options: { type: 'array', items: OPTION },
      character: { type: ['string', 'null'] },
      roller: { enum: ['agent', 'player'] },
      own: { type: ['boolean', 'null'], description: 'allow their own answer' },
      from: { type: ['string', 'null'] }
    }
  },
  execute: async (params, ctx) => {
    const from = stored(params.from, 'pick')
    const given = pickOptions(params.options)
    const options = given.length ? given : (from?.options ?? [])
    if (!options.length) throw new ToolError(from ? `Write ${from.count} options for ${from.name} from its prompt, in options.` : 'Give options: a list of {text}, with a chance or a check on each that can fail.')
    const roller = ((params.roller === 'player' || params.roller === 'agent') ? params.roller : (from?.roller ?? 'agent')) as RollerChoice
    const character = sheetOf(params.character, ctx)
    const props = { question: str(params.question) ?? from?.name ?? 'What do you do?', options, own: params.own !== false, character, roller, from: from ? linkFor('story_decision', from.id) : null }
    const answer = (await ctx.ui.ask('decide', props)) as PickAnswer
    if (isLater(answer)) {
      return laterDecisionText('decide', props.question, from ? linkFor('story_decision', from.id) : null)
    }
    return pickMadeText(props, answer, sheetName(answer.character), sheetName(character))
  }
}

const rollDecision: ToolDef = {
  ...base,
  name: 'roll_decision',
  maxRepeats: 1,
  activity: () => 'rolling a decision',
  description: 'A die picks one of your options; write exactly as many as the die has sides. from: a stored @story_decision.',
  params: {
    type: 'object',
    properties: {
      question: { type: ['string', 'null'] },
      die: { oneOf: [{ type: 'null' }, { enum: DICE }] },
      options: { type: 'array', items: { type: 'string' } },
      from: { type: ['string', 'null'] }
    }
  },
  execute: async (params, ctx) => {
    const from = stored(params.from, 'roll')
    const die = from?.die ?? Number(params.die)
    if (!DICE.includes(die)) throw new ToolError(`die is one of ${DICE.join(', ')}.`)
    const given = (Array.isArray(params.options) ? params.options : []).map((o) => String(o).trim()).filter(Boolean)
    const options = given.length ? given : (from?.options.map((o) => o.text) ?? [])
    if (options.length !== die) throw new ToolError(`A d${die} needs exactly ${die} options; there are ${options.length}.${from && !given.length ? ` Write ${die} from the prompt of ${from.name}.` : ''}`)
    const props = { question: str(params.question) ?? from?.name ?? 'What happens?', die, options, from: from ? linkFor('story_decision', from.id) : null }
    const answer = (await ctx.ui.ask('rolled', props)) as RolledAnswer
    if (isLater(answer)) {
      return laterDecisionText('roll_decision', props.question, from ? linkFor('story_decision', from.id) : null)
    }
    return rolledMadeText(props, answer)
  }
}

const opposedCheck: ToolDef = {
  ...base,
  name: 'opposed_check',
  maxRepeats: 1,
  activity: () => 'setting up an opposed check',
  description: 'a tries, b resists; both roll d20, ties to b. dc: a rolls against it instead of b.',
  params: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      a: SIDE,
      b: SIDE,
      dc: { type: ['number', 'null'] }
    }
  },
  execute: async (params, ctx) => {
    const question = str(params.question)
    if (!question) throw new ToolError('Give the question, e.g. "Does the guard spot the lie?"')
    const props = { question, a: side(params.a, 'a'), b: side(params.b, 'b'), dc: typeof params.dc === 'number' ? Math.round(params.dc) : null }
    const answer = (await ctx.ui.ask('opposed', props)) as OpposedAnswer
    if (isLater(answer)) {
      return laterDecisionText('opposed_check', question, null)
    }
    return opposedText(answer)
  }
}

const createDecisions: ToolDef = {
  ...base,
  name: 'create_decisions',
  activity: () => 'creating decisions',
  description: 'Create stored decisions, all in one call. options only if they never change; otherwise a prompt to write them from.',
  params: {
    type: 'object',
    properties: {
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            mode: { enum: ['pick', 'roll'] },
            roller: { enum: ['agent', 'player'] },
            prompt: { type: 'string' },
            die: { oneOf: [{ type: 'null' }, { enum: DICE }] },
            count: { type: ['integer', 'null'], description: 'options to write, for pick' },
            options: { type: 'array', items: OPTION },
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  },
  execute: async (params) => {
    const list = Array.isArray(params.decisions) ? (params.decisions as Json[]) : []
    if (!list.length) throw new ToolError('Give decisions as a list.')
    const lines = list.map((raw) => {
      const existing = typeof raw.name === 'string' ? decisions.find(raw.name) : null
      const saved = decisions.save({ ...(existing ?? {}), ...raw, options: pickOptions(raw.options) }, existing?.id ?? null)
      return `${existing ? 'Changed' : 'Created'} ${linkFor('story_decision', saved.id)}`
    })
    return lines.join('\n')
  }
}

const ACTION_CHECK: JsonSchema = {
  type: 'object',
  properties: {
    against: { oneOf: [{ type: 'null' }, { enum: [CHANCE, ...CHECK_IDS] }] },
    dc: { type: ['number', 'null'] },
    pass: { type: ['string', 'null'] },
    fail: { type: ['string', 'null'] }
  }
}

const createStoryActions: ToolDef = {
  ...base,
  name: 'create_story_actions',
  activity: () => 'creating story actions',
  description: 'Create stored actions, all in one call. needs any: one check is tried; all: every check must pass.',
  params: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            attempt: { type: 'string' },
            needs: { enum: ['any', 'all'] },
            checks: { type: 'array', items: ACTION_CHECK },
            pass: { type: 'string' },
            fail: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  },
  execute: async (params) => {
    const list = Array.isArray(params.actions) ? (params.actions as Json[]) : []
    if (!list.length) throw new ToolError('Give actions as a list.')
    return list
      .map((raw) => {
        const checks = (Array.isArray(raw.checks) ? (raw.checks as Json[]) : []).map((c) => ({ ...c, base: typeof c.dc === 'number' ? c.dc - 1 : null, difficulty: null }))
        const existing = typeof raw.name === 'string' ? storyActions.find(raw.name) : null
        const saved = storyActions.save({ ...(existing ?? {}), name: raw.name, tags: raw.tags, action: cleanAction({ ...raw, checks }) }, existing?.id ?? null)
        return `${existing ? 'Changed' : 'Created'} ${linkFor('story_action', saved.id)}`
      })
      .join('\n')
  }
}

export const decisionTools: ToolDef[] = [decide, rollDecision, opposedCheck, createDecisions, createStoryActions]
