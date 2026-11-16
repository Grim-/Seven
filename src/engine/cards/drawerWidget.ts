import { showName } from '@shared/ids'
import { totalOf } from '@shared/cardDecks'
import type { WidgetSource } from '@shared/types'
import { data } from '../data/hub'
import { DataError } from '../data/validate'
import { registerWidgetProvider } from '../data/widgetSources'
import { DECK_TYPE, SET_TYPE, readDeckData } from './decks'

export interface DrawerCardEntry {
  uid: string
  card: string
  faceUp: boolean
}

const SOURCE_TYPES = new Set([DECK_TYPE, SET_TYPE])
const MAX_TRAY_CARDS = 60

function isSourcePage(id: string): boolean {
  const meta = data.pages.metaFor(id)
  return Boolean(meta?.type && SOURCE_TYPES.has(meta.type))
}

function sourcePages() {
  return [...data.pages.ofType(DECK_TYPE), ...data.pages.ofType(SET_TYPE)].sort((a, b) => a.title.localeCompare(b.title))
}

function firstSourceId(): string {
  return sourcePages()[0]?.id ?? ''
}

function cleanTray(raw: unknown): DrawerCardEntry[] {
  if (!Array.isArray(raw)) return []
  const out: DrawerCardEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    const card = typeof rec.card === 'string' ? rec.card.trim() : ''
    if (!card) continue
    const uid = typeof rec.uid === 'string' && rec.uid.trim() ? rec.uid.trim() : `d-${out.length}`
    out.push({ uid, card, faceUp: rec.faceUp !== false })
    if (out.length >= MAX_TRAY_CARDS) break
  }
  return out
}

function cleanDiscard(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map((v) => v.trim())
    .slice(0, MAX_TRAY_CARDS)
}

function resolveDeckId(raw: unknown): string {
  const deck = typeof raw === 'string' ? raw.trim() : ''
  if (!deck) return ''
  if (!isSourcePage(deck)) throw new DataError(`There is no card deck or set "${deck}". Pick an existing deck or set.`)
  return deck
}

registerWidgetProvider({
  kind: 'deck_drawer',
  label: 'Deck drawer & hand tray',
  views: ['deck_drawer'],
  defaultView: 'deck_drawer',
  size: () => ({ w: 4, h: 5 }),
  check: (source: WidgetSource) => {
    const deck = resolveDeckId(source.deck)
    return {
      kind: 'deck_drawer',
      deck,
      faceUp: source.faceUp !== false,
      consume: source.consume !== false,
      showHand: source.showHand !== false,
      tray: cleanTray(source.tray),
      discard: cleanDiscard(source.discard)
    }
  },
  title: (source) => {
    const deck = typeof source.deck === 'string' ? source.deck.trim() : ''
    if (!deck || !isSourcePage(deck)) return 'Deck drawer & hand tray'
    const meta = data.pages.metaFor(deck)
    return meta ? `${showName(meta.title)} · drawer` : 'Deck drawer & hand tray'
  },
  describe: (source) => {
    const deck = typeof source.deck === 'string' ? source.deck.trim() : ''
    const tray = cleanTray(source.tray)
    if (!deck || !isSourcePage(deck)) return `Interactive card drawer (${tray.length} in tray)`
    const page = data.pages.get(deck)
    const count = totalOf(readDeckData(page.data, page.title).cards)
    return `Draws from ${showName(page.title)} (${count} left) with ${tray.length} in tray`
  },
  create: {
    label: 'Deck drawer & hand tray',
    size: { w: 4, h: 5 },
    make: () => ({
      kind: 'deck_drawer',
      deck: firstSourceId(),
      faceUp: true,
      consume: true,
      showHand: true,
      tray: [],
      discard: []
    })
  },
  choices: () =>
    sourcePages().map((p) => ({
      id: p.id,
      label: showName(p.title),
      module: null
    }))
})
