import type { JsonSchema } from '../../engine/tools/schema'
import { LIVE_CHECKS, type CheckSchema } from '../../engine/tools/checkSchema'
import { effectDefListSchema, normalizeEffectDefs } from '../../engine/tools/effectSchema'
import { cardVariationDefs, type CardPlayContext, type CardPlayOutcome, type CardRaw } from '../../engine/cards/variations'
import { rollFor } from '../../engine/actions'
import { runEffects } from '../../engine/effects/run'
import { moduleIsOn } from '../../engine/modules/isOn'
import { ACTION_LANES, actionEffects, checkTargets, cleanAction } from '@shared/actions'
import { CHOSEN_EVENT, OPTION_LANES, cleanDecision, optionEffects } from '@shared/decisions'
import { LOSE_EVENT, SIDE_LANES, WIN_EVENT, cleanOpposed, opposedText, rollOpposed, sideBonus, sideEffects } from '@shared/opposedCheck'
import { NO_ROLL } from '@shared/storyRolls'
import { pickMadeText, type PickAnswer, type PickDecisionProps } from '@shared/pickDecision'
import { isLater, laterDecisionText } from '@shared/uiLater'
import { linkFor } from '@shared/text'
import { toId } from '@shared/ids'
import { effectsWords } from '@shared/game/effectWords'
import type { EffectOutcome, ViewEvent } from '@shared/effects'
import { triggerActionsStore } from '../../engine/triggerActions/store'
import { ToolError } from '../../engine/tools/types'

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const keep = (old: unknown, keys: string[]): Record<string, unknown> => Object.fromEntries(keys.filter((k) => k in obj(old)).map((k) => [k, obj(old)[k]]))
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const defined = (v: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined))
const intOr = (v: unknown, cur: unknown, fallback = 0): number => (v === null ? fallback : typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : typeof cur === 'number' && Number.isFinite(cur) ? Math.round(cur) : fallback)

const EFFECTS = ['effects', 'passAction', 'failAction']

function triggerActionRef(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v !== 'string' || !v.trim()) return null
  const found = triggerActionsStore.get(toId(v))
  if (!found) throw new ToolError(`No trigger action "${v}".`)
  return found.id
}

function patchTriggerEffects(next: Record<string, unknown>, defaultEvent: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if ('effects' in next) out.effects = next.effects === null ? [] : normalizeEffectDefs(next.effects, defaultEvent)
  if ('passAction' in next) out.passAction = triggerActionRef(next.passAction) ?? null
  if ('failAction' in next) out.failAction = triggerActionRef(next.failAction) ?? null
  if ('action' in next) out.action = triggerActionRef(next.action) ?? null
  return out
}

function keepActionEffects(next: Record<string, unknown>, old: Record<string, unknown>): Record<string, unknown> {
  const prevChecks = list(old.checks)
  const checks =
    'checks' in next
      ? list(next.checks).map((c, i) => {
          const curCheck = obj(c)
          const oldCheck = obj(prevChecks[i])
          return { ...oldCheck, ...keep(oldCheck, EFFECTS), ...defined(curCheck), ...patchTriggerEffects(curCheck, 'OnPass') }
        })
      : prevChecks
  return { ...old, ...keep(old, EFFECTS), ...defined(next), ...patchTriggerEffects(next, 'OnPass'), checks }
}

function keepOptionEffects(next: Record<string, unknown>, old: Record<string, unknown>): Record<string, unknown> {
  const prevOptions = list(old.options)
  const options =
    'options' in next
      ? list(next.options).map((o, i) => {
          const oldOpt = obj(prevOptions[i])
          if (typeof o === 'string') return { ...oldOpt, text: o, ...keep(oldOpt, ['effects', 'action']) }
          const curOpt = obj(o)
          return { ...oldOpt, ...keep(oldOpt, ['effects', 'action']), ...defined(curOpt), ...patchTriggerEffects(curOpt, CHOSEN_EVENT) }
        })
      : prevOptions
  return { ...old, ...defined(next), options }
}

function patchSide(was: unknown, d: Record<string, unknown>): Record<string, unknown> {
  const old = obj(was)
  const patched = patchTriggerEffects(d, WIN_EVENT)
  return {
    ...old,
    ...keep(old, ['loses', 'effects', 'action', 'sheet']),
    name: 'name' in d ? (d.name === null ? '' : typeof d.name === 'string' ? d.name : String(old.name ?? '')) : String(old.name ?? ''),
    does: 'does' in d ? (d.does === null ? '' : typeof d.does === 'string' ? d.does : String(old.does ?? '')) : String(old.does ?? ''),
    against: 'against' in d ? (d.against === null ? '' : typeof d.against === 'string' ? d.against : String(old.against ?? '')) : String(old.against ?? ''),
    bonus: 'bonus' in d ? intOr(d.bonus, old.bonus) : intOr(undefined, old.bonus),
    sheet: old.sheet ?? null,
    action: 'action' in patched ? patched.action : (old.action ?? null),
    ...('effects' in patched ? { effects: patched.effects } : {})
  }
}

const effectArraySchema = (c: CheckSchema) => ({ oneOf: [{ type: 'null' }, { type: 'array', items: effectDefListSchema(c === LIVE_CHECKS) }] }) as const

const check = (c: CheckSchema): JsonSchema => ({
  type: 'object',
  properties: {
    against: { oneOf: [{ type: 'null' }, c(true)] },
    difficulty: { type: ['number', 'null'] },
    base: { type: ['number', 'null'] },
    pass: { type: ['string', 'null'] },
    fail: { type: ['string', 'null'] },
    passAction: { type: ['string', 'null'], description: 'Trigger action id on check pass' },
    failAction: { type: ['string', 'null'], description: 'Trigger action id on check fail' },
    effects: { ...effectArraySchema(c), description: 'Inline effects for this check (on: OnPass/OnFail)' }
  }
})

const data = (c: CheckSchema): JsonSchema => ({
  type: 'object',
  properties: {
    mode: { enum: ['action', 'decision', 'opposed'] },
    action: {
      oneOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            attempt: { type: 'string' },
            needs: { enum: ['any', 'all'] },
            checks: { type: 'array', items: check(c) },
            pass: { type: 'string' },
            fail: { type: 'string' },
            passAction: { type: ['string', 'null'], description: 'Trigger action id on pass' },
            failAction: { type: ['string', 'null'], description: 'Trigger action id on fail' },
            effects: { ...effectArraySchema(c), description: 'Inline effects (on: OnPass/OnFail)' }
          }
        }
      ]
    },
    decision: {
      oneOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: {
              type: 'array',
              items: {
                oneOf: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: {
                      text: { type: 'string' },
                      action: { type: ['string', 'null'], description: 'Trigger action id when chosen' },
                      effects: { ...effectArraySchema(c), description: 'Inline effects when chosen' }
                    },
                    required: ['text']
                  }
                ]
              }
            },
            own: { type: 'boolean' }
          }
        }
      ]
    },
    opposed: {
      oneOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            question: { type: 'string' },
            does: { type: 'string', description: 'what winning means for whoever plays it' },
            against: c(false),
            bonus: { type: ['number', 'null'], description: 'if no sheet' },
            action: { type: ['string', 'null'], description: 'Trigger action id on win/lose' },
            effects: { ...effectArraySchema(c), description: 'Inline effects (on: OnWin/OnLose)' },
            dc: { type: ['number', 'null'], description: 'fixed, instead of versus' },
            versus: {
              oneOf: [
                { type: 'null' },
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    against: c(false),
                    bonus: { type: ['number', 'null'] },
                    action: { type: ['string', 'null'], description: 'Trigger action id for defender' },
                    effects: { ...effectArraySchema(c), description: 'Inline effects for defender' }
                  }
                }
              ]
            }
          }
        }
      ]
    }
  }
})

const named = (label: string, words: string): string => (words ? `${label}:\n${words}` : '')

const WORDS: Record<string, (card: Record<string, unknown>) => string[]> = {
  action: (card) => {
    const action = obj(card.action)
    return [effectsWords(actionEffects(action as never), ACTION_LANES), ...list(action.checks).map((c, i) => named(`Check ${i + 1}`, effectsWords(actionEffects(obj(c) as never), ACTION_LANES)))]
  },
  decision: (card) => list(obj(card.decision).options).map((o) => named(`Option "${typeof o === 'string' ? o : String(obj(o).text ?? '')}"`, effectsWords(optionEffects(obj(o) as never), OPTION_LANES))),
  opposed: (card) => [obj(card.opposed).a, obj(card.opposed).b].map((side, i) => named(String(obj(side).name || (i ? 'The target' : 'The player')), effectsWords(sideEffects(obj(side) as never), SIDE_LANES)))
}

const PLAYABLE: Record<string, (card: CardRaw) => boolean> = {
  action: (card) => Boolean(card.action),
  decision: (card) => Boolean(card.decision),
  opposed: (card) => Boolean(card.opposed)
}

function collectEffects(done: EffectOutcome | null, effects: string[], view: ViewEvent[]): void {
  if (!done) return
  effects.push(...done.results.map((r) => r.line), ...done.lines)
  view.push(...done.view)
}

const PLAY_ROLEPLAY: Record<string, (card: CardRaw, ctx: CardPlayContext) => Promise<CardPlayOutcome>> = {
  action: async (card, ctx) => {
    const res = rollFor(cleanAction(card.action), ctx.casterSheet?.id ?? null)
    const effects: string[] = []
    const view: ViewEvent[] = []
    if (res.effects.length && moduleIsOn('game') && ctx.target.hittable) {
      collectEffects(runEffects({ defs: res.effects, event: res.event, user: ctx.caster.ref, target: ctx.target.ref, world: ctx.world }), effects, view)
    }
    const detail = res.rolls.map((r) => `${r.label} ${r.total}/${r.target}`).join(', ') || (res.passed ? 'Passed' : 'Failed')
    const lines = [res.attempt, ...(detail ? [detail] : []), ...(res.outcome ? [res.outcome] : []), ...effects]
    return { mode: 'roleplay', tone: res.passed ? 'ok' : 'alert', label: res.passed ? 'Pass' : 'Fail', detail, lines, effects, view }
  },
  opposed: async (card, ctx) => {
    const opp = cleanOpposed(card.opposed)
    const sideA = { ...opp.a, name: opp.a.name || ctx.caster.name, sheet: ctx.caster.sheetId }
    const sideB = { ...opp.b, name: opp.b.name || ctx.target.name, sheet: ctx.target.sheetId }
    const answer = rollOpposed({ ...opp, a: sideA, b: sideB }, sideBonus(sideA, checkTargets(ctx.casterSheet)), sideBonus(sideB, checkTargets(ctx.targetSheet)), null)
    const effects: string[] = []
    const view: ViewEvent[] = []
    if (moduleIsOn('game')) {
      const winnerDefs = sideEffects(answer.winner === 'a' ? sideA : sideB).filter((d) => d.on === WIN_EVENT)
      const loserDefs = sideEffects(answer.winner === 'a' ? sideB : sideA).filter((d) => d.on === LOSE_EVENT)
      const runSide = (defs: typeof winnerDefs, event: string, swapped: boolean) => {
        if (!defs.length) return
        const target = swapped ? ctx.caster : ctx.target
        if (!target.hittable) return
        const user = swapped ? ctx.target : ctx.caster
        collectEffects(runEffects({ defs, event, user: user.ref, target: target.ref, world: ctx.world }), effects, view)
      }
      runSide(winnerDefs, WIN_EVENT, answer.winner === 'b')
      runSide(loserDefs, LOSE_EVENT, answer.winner === 'a')
    }
    const won = answer.winner === 'a' ? sideA : sideB
    const detail = answer.aRoll ? `${answer.aRoll.total} vs ${answer.bRoll?.total ?? `DC ${answer.dc}`}` : `${won.name} wins`
    return { mode: 'roleplay', tone: answer.winner === 'a' ? 'ok' : 'alert', label: `${won.name} wins`, detail, lines: [opposedText(answer, effects)], effects, view }
  },
  decision: async (card, ctx) => {
    const dec = cleanDecision(card.decision)
    const isUser = ctx.target.id === 'user' || Boolean(ctx.playerSheet && ctx.target.sheetId === ctx.playerSheet)
    if (!isUser) {
      const opts = dec.options.map((o, i) => `${i + 1}. ${o.text}`)
      return { mode: 'roleplay', tone: 'purple', label: 'Decision', detail: dec.question, lines: [dec.question, ...opts], effects: [], view: [] }
    }
    const props: PickDecisionProps = {
      question: dec.question,
      options: dec.options.map((o) => ({ text: o.text, roll: NO_ROLL, action: o.action ?? null })),
      own: dec.own,
      character: ctx.target.sheetId,
      from: linkFor('card', ctx.cardName)
    }
    const answer = (await ctx.tool.ui.ask('decide', props)) as PickAnswer
    if (isLater(answer)) {
      return { mode: 'roleplay', tone: 'purple', label: 'Pending', detail: dec.question, lines: [laterDecisionText('decide', dec.question, props.from)], effects: [], view: [] }
    }
    const chosen = dec.options.find((o) => o.text === answer.option)
    const effects: string[] = []
    const view: ViewEvent[] = []
    const defs = chosen ? optionEffects(chosen) : []
    if (defs.length && moduleIsOn('game') && ctx.target.hittable) {
      collectEffects(runEffects({ defs, event: CHOSEN_EVENT, user: ctx.caster.ref, target: ctx.target.ref, world: ctx.world }), effects, view)
    }
    return { mode: 'roleplay', tone: 'purple', label: 'Decision', detail: answer.option, lines: [pickMadeText(props, answer, ctx.target.name, ctx.caster.name), ...effects], effects, view }
  }
}

cardVariationDefs.add({
  id: 'roleplay',
  module: 'world',
  name: 'Roleplay',
  order: 10,
  data,
  apply: (card, d) => {
    const prevMode = card.use === 'decision' || card.use === 'opposed' || card.use === 'action' ? card.use : 'action'
    const mode = d.mode === 'action' || d.mode === 'decision' || d.mode === 'opposed' ? d.mode : prevMode
    if (mode === 'action') return { ...card, use: mode, action: 'action' in d ? (d.action === null ? null : keepActionEffects(obj(d.action), obj(card.action))) : (card.action ?? null) }
    if (mode === 'decision') return { ...card, use: mode, decision: 'decision' in d ? (d.decision === null ? null : keepOptionEffects(obj(d.decision), obj(card.decision))) : (card.decision ?? null) }
    if ('opposed' in d && d.opposed === null) return { ...card, use: 'opposed', opposed: null }
    const o = obj(d.opposed)
    const was = obj(card.opposed)
    const cleared = o.versus === null ? { name: null, against: null, bonus: null } : obj(o.versus)
    const question = 'question' in o ? (o.question === null ? '' : typeof o.question === 'string' ? o.question : String(was.question ?? '')) : String(was.question ?? '')
    const dc = 'dc' in o ? (o.dc === null ? null : typeof o.dc === 'number' && Number.isFinite(o.dc) ? Math.round(o.dc) : (was.dc ?? null)) : (was.dc ?? null)
    const opposed = { question, a: patchSide(was.a, o), b: patchSide(was.b, cleared), dc }
    return { ...card, use: 'opposed', opposed }
  },
  remove: (card) => ({ ...card, use: 'generic' }),
  text: (card) => {
    const shown = (WORDS[String(card.use)]?.(card) ?? []).filter(Boolean)
    return shown.length ? `Roleplay effects:\n${shown.join('\n')}` : null
  },
  canPlay: (card) => Boolean(PLAYABLE[String(card.use)]?.(card)),
  play: async (card, ctx) => PLAY_ROLEPLAY[String(card.use)](card, ctx)
})
