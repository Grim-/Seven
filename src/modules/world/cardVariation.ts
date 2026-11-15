import type { JsonSchema } from '../../engine/tools/schema'
import type { CheckSchema } from '../../engine/tools/checkSchema'
import { cardVariationDefs } from '../../engine/cards/variations'
import { ACTION_LANES, actionEffects } from '@shared/actions'
import { OPTION_LANES, optionEffects } from '@shared/decisions'
import { SIDE_LANES, sideEffects } from '@shared/opposedCheck'
import { effectsWords } from '@shared/game/effectWords'

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)

const keep = (old: unknown, keys: string[]): Record<string, unknown> => Object.fromEntries(keys.filter((k) => k in obj(old)).map((k) => [k, obj(old)[k]]))
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

const EFFECTS = ['effects', 'passAction', 'failAction']

function keepActionEffects(next: Record<string, unknown>, old: Record<string, unknown>): Record<string, unknown> {
  const checks = list(old.checks)
  return { ...next, ...keep(old, EFFECTS), checks: list(next.checks).map((c, i) => ({ ...obj(c), ...keep(checks[i], EFFECTS) })) }
}

function keepOptionEffects(next: Record<string, unknown>, old: Record<string, unknown>): Record<string, unknown> {
  const options = list(old.options)
  return { ...next, options: list(next.options).map((o, i) => (typeof o === 'string' ? { text: o, ...keep(options[i], ['effects', 'action']) } : { ...obj(o), ...keep(options[i], ['effects', 'action']) })) }
}

const check = (c: CheckSchema): JsonSchema => ({ type: 'object', properties: { against: { oneOf: [{ type: 'null' }, c(true)] }, difficulty: { type: ['number', 'null'] }, base: { type: ['number', 'null'] }, pass: { type: ['string', 'null'] }, fail: { type: ['string', 'null'] } } })

const data = (c: CheckSchema): JsonSchema => ({
  type: 'object',
  properties: {
    mode: { enum: ['action', 'decision', 'opposed'] },
    action: { oneOf: [{ type: 'null' }, { type: 'object', properties: { attempt: { type: 'string' }, needs: { enum: ['any', 'all'] }, checks: { type: 'array', items: check(c) }, pass: { type: 'string' }, fail: { type: 'string' } } }] },
    decision: { oneOf: [{ type: 'null' }, { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, own: { type: 'boolean' } } }] },
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
            dc: { type: ['number', 'null'], description: 'fixed, instead of versus' },
            versus: { oneOf: [{ type: 'null' }, { type: 'object', properties: { name: { type: 'string' }, against: c(false), bonus: { type: ['number', 'null'] } } }] }
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

cardVariationDefs.add({
  id: 'roleplay',
  module: 'world',
  name: 'Roleplay',
  order: 10,
  data,
  apply: (card, d) => {
    const mode = d.mode === 'decision' || d.mode === 'opposed' ? d.mode : 'action'
    if (mode === 'action') return { ...card, use: mode, action: d.action ? keepActionEffects(obj(d.action), obj(card.action)) : (card.action ?? null) }
    if (mode === 'decision') return { ...card, use: mode, decision: d.decision ? keepOptionEffects(obj(d.decision), obj(card.decision)) : (card.decision ?? null) }
    const o = obj(d.opposed)
    const v = obj(o.versus)
    const was = obj(card.opposed)
    const side = (old: unknown, name: string, against: unknown, bonus: unknown, does = '') => ({ ...keep(old, ['loses', 'effects']), name, sheet: null, does, against: typeof against === 'string' ? against : '', bonus: num(bonus), action: null })
    const opposed = { question: typeof o.question === 'string' ? o.question : '', a: side(was.a, '', o.against, o.bonus, typeof o.does === 'string' ? o.does : ''), b: side(was.b, typeof v.name === 'string' ? v.name : '', v.against, v.bonus), dc: typeof o.dc === 'number' ? Math.round(o.dc) : null }
    return { ...card, use: 'opposed', opposed }
  },
  remove: (card) => ({ ...card, use: 'generic' }),
  text: (card) => {
    const shown = (WORDS[String(card.use)]?.(card) ?? []).filter(Boolean)
    return shown.length ? `Roleplay effects:\n${shown.join('\n')}` : null
  }
})
