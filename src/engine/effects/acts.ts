import type { Catalog, GameEntity } from '@shared/game/core'

export interface ActContext {
  world: string | null
  target: GameEntity
  targetKey: string | null
  catalog: Catalog
}

type Act = (data: Record<string, unknown>, ctx: ActContext) => string | null

const acts = new Map<string, Act>()

export function registerWorldAct(kind: string, act: Act): void {
  acts.set(kind, act)
}

export function worldAct(kind: string): Act | null {
  return acts.get(kind) ?? null
}
