import { moduleOn } from '../../lib/moduleOn'
import type { PlayWhere } from '../play/playStore'
import type { Card } from './model'
import { cardVariations, type CardVariation } from './variations'

export interface CardForm {
  id: string
  label: string
  variation: CardVariation | null
  blocked: string | null
}

const PROMPT: CardForm = { id: 'prompt', label: 'Prompt', variation: null, blocked: null }

export async function cardForms(card: Card, where: Pick<PlayWhere, 'sheet' | 'world'>): Promise<CardForm[]> {
  const list = cardVariations.on(moduleOn).filter((v) => v.has(card.raw))
  const forms = await Promise.all(
    list.map(async (v): Promise<CardForm> => ({ id: v.id, label: v.label, variation: v, blocked: v.playable(card) ? ((await v.blocked?.(card, where)) ?? null) : 'Not filled in on this card' }))
  )
  return forms.length ? [PROMPT, ...forms] : []
}
