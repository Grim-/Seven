import { toId } from '@shared/ids'
import { CHANCE } from '@shared/actions'
import { cleanGameplay, GAMEPLAY_LANES } from '@shared/gameplayCard'
import { effectsWords } from '@shared/game/effectWords'
import type { CheckSchema } from '../../engine/tools/checkSchema'
import { LIVE_DEFENCES } from '../../engine/tools/checkSchema'
import { ToolError } from '../../engine/tools/types'
import { cardVariationDefs } from '../../engine/cards/variations'
import { triggerActionsStore } from '../../engine/triggerActions/store'

const actionId = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null
  const found = triggerActionsStore.get(toId(v))
  if (!found) throw new ToolError(`No trigger action "${v}".`)
  return found.id
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
      miss: { type: ['string', 'null'], description: 'trigger action' }
    }
  }),
  apply: (card, d) => {
    const check = typeof d.check === 'string' && d.check !== CHANCE ? d.check : null
    const gameplay = { check, bonus: typeof d.bonus === 'number' ? Math.round(d.bonus) : 0, defence: typeof d.defence === 'string' ? d.defence : null, dc: typeof d.dc === 'number' ? Math.round(d.dc) : 12, hit: actionId(d.hit), miss: actionId(d.miss), effects: cleanGameplay(card.gameplay).effects }
    return { ...card, gameplay }
  },
  remove: (card) => ({ ...card, gameplay: null }),
  text: (card) => {
    if (!card.gameplay || typeof card.gameplay !== 'object') return null
    const g = cleanGameplay(card.gameplay)
    const bonus = g.bonus ? ` ${g.bonus > 0 ? '+' : '-'} ${Math.abs(g.bonus)}` : ''
    const roll = `Gameplay: the player rolls ${g.check ?? 'd20'}${bonus} against ${g.defence ? `the target's ${g.defence}` : `DC ${g.dc}`}.`
    return [roll, effectsWords(g.effects, GAMEPLAY_LANES)].filter(Boolean).join('\n')
  }
})
