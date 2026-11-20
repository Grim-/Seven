import type { ReleaseAsset, Settings } from '../../../registry'
import type { Machine, VariantChoice } from '../../../machine'

export type { VariantChoice }

export interface ServerVariant {
  id: string
  rank: number
  choices(assets: ReleaseAsset[], machine: Machine, settings: Settings): VariantChoice[]
}

const registry = new Map<string, ServerVariant>()

export function registerVariant(variant: ServerVariant): void {
  registry.set(variant.id, variant)
}

export function variantsByRank(): ServerVariant[] {
  return [...registry.values()].sort((a, b) => b.rank - a.rank)
}
