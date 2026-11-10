import type { ReleaseAsset, Settings } from '../../../registry'
import type { Machine } from '../machine'

export interface VariantChoice {
  build: string
  label: string
  assets: ReleaseAsset[]
  unavailable: string | null
  notes: string[]
}

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
