import { useMemo } from 'react'
import { DEFAULT_CARD_COLOR, isCardColor, readLayout, readValues, type CardField, type CardLayout, type CardValue } from '@shared/cards'
import { showName, toId } from '@shared/ids'
import { CHANCE, cleanAction, type Action } from '@shared/actions'
import { cleanDecision, type Decision } from '@shared/decisions'
import { cleanEntries, type CardUse, type DeckEntry } from '@shared/cardDecks'
import { usePage, useData } from '../../store/data'

export const CARD_TYPE = 'cards:card'
export const SET_TYPE = 'cards:set'
export const DECK_TYPE = 'cards:deck'
export const LAYOUT_TYPE = 'cards:layout'

export interface Card {
  raw: Record<string, unknown>
  name: string
  layout: string | null
  values: Record<string, CardValue>
  color: string | null
  use: CardUse
  prompt: string
  action: Action | null
  decision: Decision | null
}

export interface CardCounts {
  name: string
  cards: DeckEntry[]
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function readCard(data: unknown, title: string): Card {
  const raw = obj(data)
  return {
    raw: { ...raw, name: typeof raw.name === 'string' && raw.name ? raw.name : title },
    name: typeof raw.name === 'string' && raw.name ? raw.name : title,
    layout: typeof raw.layout === 'string' && raw.layout ? raw.layout : null,
    values: readValues(raw.values),
    color: isCardColor(raw.color) ? raw.color : null,
    use: raw.use === 'action' || raw.use === 'decision' ? raw.use : 'generic',
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    action: raw.action ? cleanAction(raw.action) : null,
    decision: raw.decision ? cleanDecision(raw.decision) : null
  }
}

export function readCounts(data: unknown, title: string): CardCounts & Record<string, unknown> {
  const d = obj(data)
  return { ...d, name: typeof d.name === 'string' && d.name ? d.name : title, cards: cleanEntries(d.cards) }
}

export const USE_VERB: Record<CardUse, string> = { generic: 'Use', action: 'Roll', decision: 'Decide' }

export function cardLabel(card: Card): string {
  if (card.use === 'action' && card.action) return ['Action', ...new Set(card.action.checks.map((c) => showName(c.against ?? CHANCE)))].join(' · ')
  return card.use === 'decision' ? 'Decision' : 'Generic'
}

export function legacyLayout(raw: Record<string, unknown>): { layout: CardLayout; values: Record<string, CardValue> } {
  const fields: CardField[] = [{ id: 'text', label: 'Text', type: 'longtext', place: 'body', options: [] }]
  const values: Record<string, CardValue> = { text: typeof raw.text === 'string' && raw.text ? raw.text : typeof raw.prompt === 'string' ? raw.prompt : null }
  return { layout: { name: '', frame: 'notched', color: isCardColor(raw.color) ? raw.color : DEFAULT_CARD_COLOR, fields }, values }
}

export function useTypePages(type: string) {
  const pages = useData((s) => s.pages)
  return useMemo(() => pages.filter((p) => p.type === type).sort((a, b) => a.title.localeCompare(b.title)), [pages, type])
}

export function useLayoutNamed(name: string | null): CardLayout | null {
  const layouts = useTypePages(LAYOUT_TYPE)
  const meta = name ? layouts.find((p) => toId(p.title) === toId(name)) : undefined
  const page = usePage(meta?.id ?? null)
  return useMemo(() => (page ? readLayout(page.data, page.title) : null), [page])
}


export function newFieldId(): string {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
