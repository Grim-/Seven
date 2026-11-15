import { cleanComponents, type ComponentDef } from './game/core'

export interface GameplayCard {
  check: string | null
  bonus: number
  defence: string | null
  dc: number
  hit: string | null
  miss: string | null
  effects: ComponentDef[]
}

export const HIT_EVENT = 'OnHit'
export const MISS_EVENT = 'OnMiss'

export const GAMEPLAY_LANES = [
  { event: HIT_EVENT, label: 'On a hit' },
  { event: MISS_EVENT, label: 'On a miss' }
]

export const BLANK_GAMEPLAY: GameplayCard = { check: null, bonus: 0, defence: null, dc: 12, hit: null, miss: null, effects: [] }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const int = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback)
const id = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null)

export function cleanGameplay(v: unknown): GameplayCard {
  const g = obj(v)
  return { check: id(g.check), bonus: int(g.bonus, 0), defence: id(g.defence), dc: int(g.dc, BLANK_GAMEPLAY.dc), hit: id(g.hit), miss: id(g.miss), effects: cleanComponents(g.effects) }
}
