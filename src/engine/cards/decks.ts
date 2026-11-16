import { addCards, agentSide, cleanDeckOwner, cleanEntries, countOf, sameOwner, type CardSwap, type DeckEntry, type DeckOwner, type DeckRef } from '@shared/cardDecks'
import { toId } from '@shared/ids'
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
  owner: DeckOwner | null
  session: string | null
  from: string | null
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const textOr = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback)
const idOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null)

export function readDeckData(raw: unknown, title: string): CardDeckData {
  const d = obj(raw)
  const legacy = idOrNull(d.character)
  return { name: textOr(d.name, title), cards: cleanEntries(d.cards), owner: cleanDeckOwner(d.owner) ?? (legacy ? { character: legacy } : null), session: idOrNull(d.session), from: idOrNull(d.from) }
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
  if (!page) throw new ToolError(`There is no card "${ref}". Make it with make_card first.`)
  return page.title
}

function ownerTitle(owner: DeckOwner): string {
  if ('user' in owner) return 'Your cards'
  if ('agent' in owner) return `${agentAccess.get(owner.agent)?.name ?? 'Agent'} cards`
  return `${getSheet(owner.character).title} cards`
}

function ownerDeck(owner: DeckOwner, make: boolean): string | null {
  const hit = allDecks().find((d) => sameOwner(d.deck.owner, owner))
  if (hit || !make) return hit?.id ?? null
  return newDeck(ownerTitle(owner), { name: '', cards: [], owner, session: null, from: null })
}

export function deckOf(ref: DeckRef, make: boolean): { deck: string | null } {
  if ('deck' in ref) return { deck: data.pages.metaFor(ref.deck)?.type === DECK_TYPE ? ref.deck : null }
  return { deck: ownerDeck(ref, make) }
}

export function setDeckOwner(deck: string, owner: DeckOwner | null): boolean {
  for (const d of allDecks()) {
    if (d.id === deck) continue
    if (owner && sameOwner(d.deck.owner, owner)) data.pages.setData(d.id, { ...d.deck, owner: null })
  }
  const page = data.pages.get(deck)
  if (page.type !== DECK_TYPE) throw new ToolError(`"${page.title}" is not a card deck.`)
  data.pages.setData(deck, { ...readDeckData(page.data, page.title), owner })
  return true
}

function change(ref: DeckRef, fn: (cards: DeckEntry[]) => DeckEntry[]): string {
  const { deck } = deckOf(ref, true)
  if (!deck) throw new ToolError('There is no card deck here.')
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

export function deckCards(ref: DeckRef): DeckEntry[] {
  const { deck } = deckOf(ref, false)
  if (!deck) return []
  const page = data.pages.get(deck)
  return readDeckData(page.data, page.title).cards.filter((e) => e.count > 0)
}

export function findDeckCard(ref: DeckRef, query: string): string {
  const entries = deckCards(ref)
  if (!entries.length) throw new ToolError('You have no cards in your deck.')
  const q = toId(query)
  const exact = q ? entries.filter((e) => toId(e.card) === q) : []
  if (exact.length === 1) return exact[0].card
  const lower = query.trim().toLowerCase()
  const partial = entries.filter((e) => (q && toId(e.card).includes(q)) || (lower && e.card.toLowerCase().includes(lower)))
  const list = entries.map((e) => e.card).join(', ')
  if (!partial.length) throw new ToolError(`You don't have "${query}" in your deck. Your cards: ${list}.`)
  if (partial.length > 1) throw new ToolError(`Ambiguous card "${query}". Matching cards: ${partial.map((e) => e.card).join(', ')}.`)
  return partial[0].card
}

export function agentDeckSummary(agent: { id: string; sheet?: string | null; sheets?: string[] | null }): string {
  const entries = deckCards(agentSide(agent))
  if (!entries.length) return ''
  return `Your cards: ${entries.map((e) => `${e.card} ×${e.count}`).join(', ')}`
}
