import { checkDefence, checkTargets, findTarget } from '@shared/actions'
import { storedPiece } from '@shared/game/components'
import { toId } from '@shared/ids'
import { CHANCE } from '@shared/actions'
import { cleanGameplay, BLANK_GAMEPLAY, GAMEPLAY_LANES, HIT_EVENT, MISS_EVENT } from '@shared/gameplayCard'
import { effectsWords } from '@shared/game/effectWords'
import { runEffects } from '../../engine/effects/run'
import type { CheckSchema } from '../../engine/tools/checkSchema'
import { LIVE_DEFENCES } from '../../engine/tools/checkSchema'
import { effectItemSchema, normalizeEffectDefs } from '../../engine/tools/effectSchema'
import { ToolError } from '../../engine/tools/types'
import { cardVariationDefs } from '../../engine/cards/variations'
import { triggerActionsStore } from '../../engine/triggerActions/store'

const actionId = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null
  const found = triggerActionsStore.get(toId(v))
  if (!found) throw new ToolError(`No trigger action "${v}".`)
  return found.id
}

const patchText = (d: Record<string, unknown>, key: string, current: string | null, parse: (v: unknown) => string | null): string | null => {
  if (!(key in d)) return current
  if (d[key] === null) return null
  return typeof d[key] === 'string' ? parse(d[key]) : current
}

const patchInt = (d: Record<string, unknown>, key: string, current: number, fallback: number): number => {
  if (!(key in d)) return current
  if (d[key] === null) return fallback
  return typeof d[key] === 'number' && Number.isFinite(d[key]) ? Math.round(d[key] as number) : current
}

cardVariationDefs.add({
  id: 'gameplay',
  module: 'game',
  name: 'Gameplay',
  order: 20,
  data: (c: CheckSchema) => ({
    type: 'object',
    properties: {
      check: { oneOf: [{ type: 'null' }, c(false)], description: 'what the player rolls with' },
      bonus: { type: ['number', 'null'] },
      defence: { oneOf: [{ type: 'null' }, LIVE_DEFENCES()], description: "the target's; null uses dc" },
      dc: { type: ['number', 'null'] },
      hit: { type: ['string', 'null'], description: 'trigger action' },
      miss: { type: ['string', 'null'], description: 'trigger action' },
      effects: {
        oneOf: [{ type: 'null' }, { type: 'array', items: effectItemSchema() }],
        description: 'Inline effects (same piece shape as set_trigger_action.effects)'
      }
    }
  }),
  apply: (card, d) => {
    const prev = cleanGameplay(card.gameplay)
    const gameplay = {
      check: patchText(d, 'check', prev.check, (v) => (v !== CHANCE && typeof v === 'string' ? v : null)),
      bonus: patchInt(d, 'bonus', prev.bonus, BLANK_GAMEPLAY.bonus),
      defence: patchText(d, 'defence', prev.defence, (v) => (typeof v === 'string' ? v : null)),
      dc: patchInt(d, 'dc', prev.dc, BLANK_GAMEPLAY.dc),
      hit: patchText(d, 'hit', prev.hit, actionId),
      miss: patchText(d, 'miss', prev.miss, actionId),
      effects: 'effects' in d ? (d.effects === null ? [] : normalizeEffectDefs(d.effects, HIT_EVENT)) : prev.effects
    }
    return { ...card, gameplay }
  },
  remove: (card) => ({ ...card, gameplay: null }),
  text: (card) => {
    if (!card.gameplay || typeof card.gameplay !== 'object') return null
    const g = cleanGameplay(card.gameplay)
    const bonus = g.bonus ? ` ${g.bonus > 0 ? '+' : '-'} ${Math.abs(g.bonus)}` : ''
    const roll = `Gameplay: the player rolls ${g.check ?? 'd20'}${bonus} against ${g.defence ? `the target's ${g.defence}` : `DC ${g.dc}`}.`
    return [roll, effectsWords(g.effects, GAMEPLAY_LANES)].filter(Boolean).join('\n')
  },
  canPlay: (card, ctx) => Boolean(card.gameplay && typeof card.gameplay === 'object' && ctx.target.hittable),
  play: async (card, ctx) => {
    const g = cleanGameplay(card.gameplay)
    const checks = ctx.casterSheet ? checkTargets(ctx.casterSheet) : []
    const using = g.check ? findTarget(checks, g.check) : null
    const bonus = g.bonus + (using?.bonus ?? 0)
    const defence = g.defence && ctx.targetSheet ? checkDefence(ctx.targetSheet, g.defence) : null
    const dc = defence ?? g.dc
    const roll = 1 + Math.floor(Math.random() * 20)
    const total = roll + bonus
    const hit = total >= dc
    const event = hit ? HIT_EVENT : MISS_EVENT
    const defs = [...storedPiece(g.hit, HIT_EVENT), ...storedPiece(g.miss, MISS_EVENT), ...g.effects].filter((d) => d.on === event)
    const done = defs.length ? runEffects({ defs, event, user: ctx.caster.ref, target: ctx.target.ref, world: ctx.world }) : null
    const effects = done ? [...done.results.map((r) => r.line), ...done.lines] : []
    const vfxEvents = (done?.results ?? [])
      .filter((r) => typeof r.values.from === 'number' && typeof r.values.to === 'number' && r.values.from !== r.values.to)
      .map((r) => {
        const hurt = Number(r.values.to) < Number(r.values.from)
        return {
          kind: 'vfx',
          target: r.target,
          data: { preset: hurt ? 'hit' : 'flash', tone: hurt ? 'alert' : 'ok', reaction: hurt ? 'hit' : 'heal' }
        }
      })
    let detail = `${total} vs ${dc}`
    for (const r of done?.results ?? []) {
      if (r.target === ctx.target.id && typeof r.values.from === 'number' && typeof r.values.to === 'number') {
        detail = `${ctx.target.name}: ${r.values.from} → ${r.values.to} HP`
      }
    }
    const signed = `${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}`
    const lines = [
      `Roll: ${roll} ${signed} = ${total} vs ${defence !== null ? `${g.defence} ` : 'DC '}${dc} — ${hit ? 'HIT' : 'MISSED'}`,
      ...(effects.length ? [`Effects: ${effects.join('; ')}`] : []),
      ...(typeof card.instructions === 'string' && card.instructions.trim() ? [`Instructions: ${card.instructions.trim()}`] : [])
    ]
    return { mode: 'gameplay', tone: hit ? 'ok' : 'alert', label: hit ? 'Hit' : 'Miss', detail, lines, effects, view: [...(done?.view ?? []), ...vfxEvents] }
  }
})
