import { toId } from './ids'

export interface CardSwap {
  gain: string[]
  lose: string[]
}

export interface DeckEntry {
  card: string
  count: number
}

export type CardUse = 'generic' | 'action' | 'decision'

export const CARD_USES: { value: CardUse; label: string }[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'action', label: 'Action' },
  { value: 'decision', label: 'Decision' }
]

export type CardSource = { from: 'deck'; id: string } | { from: 'set'; id: string } | { from: 'character' }

export type DeckRef = { deck: string } | { chat: string; agent: string } | { character: string }

export const NO_SWAP: CardSwap = { gain: [], lose: [] }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [])

export function cleanSwap(raw: unknown): CardSwap {
  const v = obj(raw)
  return { gain: names(v.gain), lose: names(v.lose) }
}

export function cleanCardSource(raw: unknown): CardSource | null {
  const v = obj(raw)
  if (v.from === 'character') return { from: 'character' }
  if ((v.from === 'deck' || v.from === 'set') && typeof v.id === 'string' && v.id) return { from: v.from, id: v.id }
  return null
}

export function hasSwap(s: CardSwap): boolean {
  return s.gain.length > 0 || s.lose.length > 0
}

export function swapText(s: CardSwap): string {
  return [s.gain.length ? `gain ${s.gain.join(', ')}` : '', s.lose.length ? `lose ${s.lose.join(', ')}` : ''].filter(Boolean).join('; ')
}

export function parseSwap(text: string): CardSwap {
  const out: CardSwap = { gain: [], lose: [] }
  for (const part of text.split(';')) {
    const m = /^\s*(gain|lose)\s+(.*)$/i.exec(part)
    if (m) out[m[1].toLowerCase() as keyof CardSwap].push(...m[2].split(',').map((s) => s.trim()).filter(Boolean))
  }
  return out
}

export function swapSentence(s: CardSwap): string {
  return `Cards: ${[s.gain.length ? `gains ${s.gain.join(', ')}` : '', s.lose.length ? `loses ${s.lose.join(', ')}` : ''].filter(Boolean).join(' and ')}.`
}

export function cleanEntries(raw: unknown): DeckEntry[] {
  const out: DeckEntry[] = []
  for (const e of Array.isArray(raw) ? raw : []) {
    const r = obj(e)
    if (typeof r.card !== 'string' || !r.card.trim()) continue
    const count = typeof r.count === 'number' && r.count > 0 ? Math.round(r.count) : 1
    const has = out.find((x) => toId(x.card) === toId(r.card as string))
    if (has) has.count += count
    else out.push({ card: r.card.trim(), count })
  }
  return out
}

export function countOf(entries: DeckEntry[], card: string): number {
  return entries.find((e) => toId(e.card) === toId(card))?.count ?? 0
}

export function totalOf(entries: DeckEntry[]): number {
  return entries.reduce((n, e) => n + e.count, 0)
}

export function addCards(entries: DeckEntry[], card: string, by: number): DeckEntry[] {
  const has = entries.some((e) => toId(e.card) === toId(card))
  const next = has ? entries.map((e) => (toId(e.card) === toId(card) ? { ...e, count: e.count + by } : e)) : [...entries, { card, count: by }]
  return next.filter((e) => e.count > 0)
}

export function cardPlayed(name: string): string {
  return `CARD PLAYED: [${name}]`
}
