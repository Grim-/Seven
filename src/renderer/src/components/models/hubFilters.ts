import type { HubFamily, HubModel, ModelInfo } from '@shared/types'
import { ANY, type PropertyFilter } from '../../lib/propertyFilters'
import { mtpFilter, shapeFilter } from './modelFilters'

const SIZES = [
  { value: 'small', label: 'Up to 8B', test: (p: number) => p <= 8e9 },
  { value: 'medium', label: 'Up to 20B', test: (p: number) => p <= 20e9 },
  { value: 'large', label: 'Up to 40B', test: (p: number) => p <= 40e9 },
  { value: 'huge', label: 'Over 40B', test: (p: number) => p > 40e9 }
]

const ACCESS_FILTER: PropertyFilter<HubModel> = {
  kind: 'choice',
  id: 'access',
  label: 'Access',
  options: [
    { value: ANY, label: 'Any' },
    { value: 'public', label: 'Public' },
    { value: 'gated', label: 'Gated' }
  ],
  test: (m, value) => (value === 'gated' ? m.gated : value === 'public' ? !m.gated : true)
}

const PIPELINE_FILTER: PropertyFilter<HubModel> = {
  kind: 'choice',
  id: 'pipeline',
  label: 'Task',
  options: [
    { value: ANY, label: 'Any' },
    { value: 'text-to-image', label: 'Text to image' },
    { value: 'image-to-image', label: 'Image edit' }
  ],
  test: (m, value) => (value === ANY ? true : (m.pipelineTag ?? m.architecture) === value)
}

export function hubFilters(facts: (m: HubModel) => ModelInfo | null | undefined, family: HubFamily = 'gguf'): PropertyFilter<HubModel>[] {
  const byFamily: Record<HubFamily, PropertyFilter<HubModel>[]> = {
    'image-packs': [],
    gguf: [
      shapeFilter(facts),
      mtpFilter(facts),
      {
        kind: 'choice',
        id: 'params',
        label: 'Size',
        options: [{ value: ANY, label: 'Any' }, ...SIZES.map(({ value, label }) => ({ value, label }))],
        test: (m, value) => (m.params === null ? false : (SIZES.find((s) => s.value === value)?.test(m.params) ?? true))
      }
    ],
    'image-gguf': [PIPELINE_FILTER, ACCESS_FILTER],
    diffusion: [PIPELINE_FILTER, ACCESS_FILTER],
    'image-companions': [ACCESS_FILTER]
  }
  return byFamily[family]
}
