import type { DeckEntry } from '@shared/cardDecks'
import { CARD_TYPE, useTypePages } from './model'
import { cardIdIn } from './useCardPage'

export interface HeldCard {
  id: string
  count: number
}

export function useHeldCards(entries: DeckEntry[]): HeldCard[] {
  const cards = useTypePages(CARD_TYPE)
  return entries.flatMap((e) => {
    const id = cardIdIn(cards, e.card)
    return id ? [{ id, count: e.count }] : []
  })
}
