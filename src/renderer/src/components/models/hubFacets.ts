import type { HubModel, ModelInfo } from '@shared/types'
import { ANY, type Facet } from '../../lib/facets'
import { mtpFacet, shapeFacet } from './modelFacets'

const SIZES = [
  { value: 'small', label: 'Up to 8B', test: (p: number) => p <= 8e9 },
  { value: 'medium', label: 'Up to 20B', test: (p: number) => p <= 20e9 },
  { value: 'large', label: 'Up to 40B', test: (p: number) => p <= 40e9 },
  { value: 'huge', label: 'Over 40B', test: (p: number) => p > 40e9 }
]

export function hubFacets(facts: (m: HubModel) => ModelInfo | null | undefined): Facet<HubModel>[] {
  return [
    shapeFacet(facts),
    mtpFacet(facts),
    {
      kind: 'choice',
      id: 'params',
      label: 'Size',
      options: [{ value: ANY, label: 'Any' }, ...SIZES.map(({ value, label }) => ({ value, label }))],
      test: (m, value) => (m.params === null ? false : (SIZES.find((s) => s.value === value)?.test(m.params) ?? true))
    }
  ]
}
