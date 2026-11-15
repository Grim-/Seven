import type { Catalog } from '@shared/game/core'

let source: (() => Catalog) | null = null

export function setEffectCatalog(fn: () => Catalog): void {
  source = fn
}

export function effectCatalog(): Catalog | null {
  return source?.() ?? null
}
