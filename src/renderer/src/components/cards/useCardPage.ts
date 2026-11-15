import { toId } from '@shared/ids'
import { CARD_TYPE, useTypePages } from './model'

export function cardIdIn(pages: { id: string; title: string }[], name: string): string | null {
  return pages.find((p) => toId(p.title) === toId(name))?.id ?? null
}

export function useCardPage(name: string): string | null {
  return cardIdIn(useTypePages(CARD_TYPE), name)
}
