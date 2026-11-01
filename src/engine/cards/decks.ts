import { addCards, cleanEntries, countOf, type CardSwap, type DeckEntry, type DeckRef } from '@shared/cardDecks'
import { data } from '../data/hub'
import { ToolError } from '../tools/types'
import { agentAccess } from '../agents/access'
import { getSheet } from '../library/sheets'

export const CARD_TYPE = 'cards:card'
export const SET_TYPE = 'cards:set'
export const DECK_TYPE = 'cards:deck'

export interface CardDeckData {
  name: string
  cards: DeckEntry[]
  character: string | null
  session: string | null
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const textOr = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
const idOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null)

export function readDeckData(raw: unknown, title: string): CardDeckData {
  const d = obj(raw)
  return { name: textOr(d.name, title), cards: cleanEntries(d.cards), character: idOrNull(d.character), session: idOrNull(d.session) }
}

function setEntries(id: string): DeckEntry[] {
  const page = data.pages.get(id)
  if (page.type !== SET_TYPE) throw new ToolError(`"${page.title}" is not a card set.`)
  return cleanEntries(obj(page.data).cards)
}

function allDecks(): { id: string; deck: CardDeckData }[] {
  return data.pages.ofType(DECK_TYPE).map((m) => ({ id: m.id, deck: readDeckData(data.pages.get(m.id).data, m.title) }))
}

function newDeck(title: string, deck: CardDeckData): string {
  for (let n = 1; ; n++) {
    const name = n === 1 ? title : `${title} ${n}`
    try {
      return data.pages.create({ title: name, type: DECK_TYPE, data: { ...deck, name } }).id
    } catch (err) {
      if (n > 50) throw err
    }
  }
}

export function cardName(ref: string): string {
  const page = data.pages.find(ref, (p) => p.type === CARD_TYPE)
  if (!page) throw new ToolError(`There is no card "${ref}". Make it with cards_card first.`)
  return page.title
}

function characterDeck(sheet: string, make: boolean): string | null {
  const hit = allDecks().find((d) => d.deck.character === sheet)
  if (hit || !make) return hit?.id ?? null
  const title = getSheet(sheet).title
  return newDeck(`${title} cards`, { name: '', cards: [], character: sheet, session: null })
}

export function deckOf(ref: DeckRef, make: boolean): { deck: string | null; set: string | null } {
  if ('deck' in ref) return { deck: data.pages.metaFor(ref.deck)?.type === DECK_TYPE ? ref.deck : null, set: null }
  if ('character' in ref) return { deck: characterDeck(ref.character, make), set: null }
  const agent = agentAccess.get(ref.agent)
  const source = agent?.cards ?? null
  if (!source) return { deck: null, set: null }
  if (source.from === 'deck') return { deck: data.pages.metaFor(source.id)?.type === DECK_TYPE ? source.id : null, set: null }
  if (source.from === 'character') return { deck: agent?.player ? characterDeck(agent.player, make) : null, set: null }
  const held = allDecks().find((d) => d.deck.session === ref.chat)
  if (held || !make) return { deck: held?.id ?? null, set: source.id }
  const setTitle = data.pages.metaFor(source.id)?.title ?? 'Cards'
  return { deck: newDeck(`${setTitle} for ${agent?.name ?? 'a chat'}`, { name: '', cards: setEntries(source.id), character: null, session: ref.chat }), set: source.id }
}

function change(ref: DeckRef, fn: (cards: DeckEntry[]) => DeckEntry[]): string {
  const { deck } = deckOf(ref, true)
  if (!deck) throw new ToolError('No card deck is in use here. Set one in the agent\'s Cards setting, or pick your character.')
  const page = data.pages.get(deck)
  const d = readDeckData(page.data, page.title)
  data.pages.setData(deck, { ...d, cards: fn(d.cards) })
  return deck
}

export function takeCard(ref: DeckRef, card: string): string {
  return change(ref, (cards) => {
    if (!countOf(cards, card)) throw new ToolError(`There is no "${card}" in the deck.`)
    return addCards(cards, card, -1)
  })
}

export function addCard(ref: DeckRef, card: string, by: number): string {
  const name = by > 0 ? cardName(card) : card
  return change(ref, (cards) => addCards(cards, name, by))
}

export function swapCards(ref: DeckRef, swap: CardSwap): string {
  const gains = swap.gain.map(cardName)
  return change(ref, (cards) => {
    let next = cards
    for (const name of gains) next = addCards(next, name, 1)
    for (const name of swap.lose) if (countOf(next, name)) next = addCards(next, name, -1)
    return next
  })
}

export function addSet(ref: DeckRef, set: string): string {
  const entries = setEntries(set)
  return change(ref, (cards) => entries.reduce((next, e) => addCards(next, e.card, e.count), cards))
}
