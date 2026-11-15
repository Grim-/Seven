import type { ComponentRecord } from './game/core/Component'
import type { ComponentDef } from './game/core/registry'

export interface EffectResult {
  effect: string
  target: string | null
  values: Record<string, number | string | boolean>
  line: string
}

export interface ViewEvent {
  kind: string
  data: Record<string, unknown>
  target?: string | null
  entity?: string | null
}

export interface PlacedRef {
  map: string
  id: string
}

export interface EffectTargetRef {
  sheet?: string
  creature?: string
  placed?: PlacedRef
}

export const placedKey = (at: PlacedRef): string => `placed:${at.map}:${at.id}`

export function effectTargetKey(ref: EffectTargetRef | null): string | null {
  if (!ref) return null
  if (ref.sheet) return `sheet:${ref.sheet}`
  if (ref.creature) return `creature:${ref.creature}`
  if (ref.placed) return placedKey(ref.placed)
  return null
}

export interface EffectRun {
  action?: string
  pieces?: ComponentRecord[]
  defs?: ComponentDef[]
  dry?: boolean
  event?: string
  user: EffectTargetRef | null
  target: EffectTargetRef | null
  world: string | null
}

export interface EffectOutcome {
  results: EffectResult[]
  lines: string[]
  view: ViewEvent[]
}
