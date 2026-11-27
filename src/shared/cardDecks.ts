import { toId } from './ids'
import { linkFor } from './text'
import { agentSheets } from './types'
import { actorLink } from './worldNpcs'

export interface CardSwap {
  gain: string[]
  lose: string[]
}

export interface DeckEntry {
  card: string
  count: number
}

export type CardUse = 'generic' | 'action' | 'decision' | 'opposed'

export const CARD_USES: { value: CardUse; label: string }[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'action', label: 'Action' },
  { value: 'decision', label: 'Decision' },
  { value: 'opposed', label: 'Opposed check' }
]

export type DeckOwner = { user: true } | { agent: string } | { character: string }

export type DeckRef = { deck: string } | DeckOwner

export const NO_SWAP: CardSwap = { gain: [], lose: [] }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [])

export function cleanSwap(raw: unknown): CardSwap {
  const v = obj(raw)
  return { gain: names(v.gain), lose: names(v.lose) }
}

export function cleanDeckOwner(raw: unknown): DeckOwner | null {
  const v = obj(raw)
  if (v.user === true) return { user: true }
  if (typeof v.agent === 'string' && v.agent) return { agent: v.agent }
  if (typeof v.character === 'string' && v.character) return { character: v.character }
  return null
}

export function sameOwner(a: DeckOwner | null, b: DeckOwner | null): boolean {
  if (!a || !b) return false
  if ('user' in a) return 'user' in b
  if ('agent' in a) return 'agent' in b && a.agent === b.agent
  return 'character' in b && a.character === b.character
}

export function userSide(player: string | null | undefined): DeckOwner {
  return player ? { character: player } : { user: true }
}

export function agentSide(agent: { id: string; sheet?: string | null; sheets?: string[] | null }): DeckOwner {
  const own = agentSheets(agent)[0]
  return own ? { character: own } : { agent: agent.id }
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

export function cardPlayed(name: string, sheet: string | null, said = ''): string {
  const line = `${sheet ? actorLink(sheet) : 'The user'} played the card ${linkFor('card', name)}`
  return said.trim() ? `${line}\nWhat they do: "${said.trim()}"` : line
}
