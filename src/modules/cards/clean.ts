import { fieldId, readLayout, readValues, type CardLayout, type CardValue } from '@shared/cards'
import { cleanAction, type Action } from '@shared/actions'
import { cleanDecision, type Decision } from '@shared/decisions'
import { cleanEntries, type CardUse, type DeckEntry } from '@shared/cardDecks'
import { readDeckData, type CardDeckData } from '../../engine/cards/decks'

export class CardError extends Error {}

export interface CardData {
  name: string
  text: string
  art: string
  color: string | null
  layout: string | null
  values: Record<string, CardValue>
  use: CardUse
  prompt: string
  action: Action | null
  decision: Decision | null
}

export interface CardSetData {
  name: string
  cards: DeckEntry[]
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const USES: CardUse[] = ['generic', 'action', 'decision']

export function cleanCard(v: unknown): CardData {
  const c = obj(v)
  const name = text(c.name, 60)
  if (!name) throw new CardError('A card needs a name: set name, e.g. "Fireball".')
  const use = USES.find((u) => u === c.use) ?? 'generic'
  return {
    name,
    text: text(c.text, 600),
    art: text(c.art, 20000),
    color: typeof c.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c.color) ? c.color : null,
    layout: text(c.layout, 120) || null,
    values: readValues(c.values),
    use,
    prompt: text(c.prompt, 4000),
    action: c.action ? cleanAction(c.action) : null,
    decision: c.decision ? cleanDecision(c.decision) : null
  }
}

export function cleanLayout(v: unknown): CardLayout {
  const raw = obj(v)
  const name = text(raw.name, 60)
  if (!name) throw new CardError('A card layout needs a name, e.g. "Spell".')
  const labels = arr(raw.fields).map((f) => text(obj(f).label, 40))
  if (labels.some((l) => !l)) throw new CardError('Every field needs a label, e.g. "Power".')
  if (new Set(labels.map(fieldId)).size !== labels.length) throw new CardError('Two fields have the same label. Give each field its own label.')
  return readLayout(raw, name)
}

export function cleanSet(v: unknown): CardSetData {
  const d = obj(v)
  const name = text(d.name, 60)
  if (!name) throw new CardError('A card set needs a name: set name, e.g. "Wizard starter".')
  return { name, cards: cleanEntries(d.cards) }
}

export function cleanDeck(v: unknown): CardDeckData {
  const name = text(obj(v).name, 60)
  if (!name) throw new CardError('A card deck needs a name.')
  return readDeckData(v, name)
}
