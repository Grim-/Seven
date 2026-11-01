import type { ModelEntry, ModelInfo } from '@shared/types'
import { ANY, type Facet } from '../../lib/facets'

const GB = 1024 ** 3

export function shapeFacet<T>(info: (item: T) => ModelInfo | null | undefined): Facet<T> {
  return {
    kind: 'choice',
    id: 'shape',
    label: 'Type',
    options: [
      { value: ANY, label: 'All' },
      { value: 'dense', label: 'Dense' },
      { value: 'moe', label: 'MoE' }
    ],
    test: (item, value) => {
      const i = info(item)
      return i ? (value === 'moe') === Boolean(i.experts) : i === null ? false : null
    }
  }
}

export function mtpFacet<T>(info: (item: T) => ModelInfo | null | undefined): Facet<T> {
  return {
    kind: 'choice',
    id: 'mtp',
    label: 'MTP',
    options: [
      { value: ANY, label: 'Any' },
      { value: 'mtp', label: 'Has MTP' }
    ],
    test: (item) => {
      const i = info(item)
      return i ? Boolean(i.mtpLayers) : i === null ? false : null
    }
  }
}

export function modelFacets(models: ModelEntry[], bytes: (m: ModelEntry) => number): Facet<ModelEntry>[] {
  const local = (m: ModelEntry) => (m.remote ? null : m.info)
  const quants = [...new Set(models.flatMap((m) => (m.info?.quant ? [m.info.quant] : [])))].sort()
  const largest = Math.max(1, ...models.filter((m) => !m.remote).map((m) => Math.ceil(bytes(m) / GB)))
  return [
    shapeFacet(local),
    mtpFacet(local),
    {
      kind: 'choice',
      id: 'quant',
      label: 'Quant',
      options: [{ value: ANY, label: 'All' }, ...quants.map((q) => ({ value: q, label: q }))],
      test: (m, value) => (m.remote ? false : m.info ? m.info.quant === value : null)
    },
    { kind: 'max', id: 'size', label: 'Max size', max: largest, step: 1, unit: 'GB', measure: (m) => (m.remote ? Infinity : bytes(m) / GB) }
  ]
}
