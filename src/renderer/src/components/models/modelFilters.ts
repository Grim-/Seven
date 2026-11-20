import type { ModelEntry, ModelInfo } from '@shared/types'
import { modelFamily } from '@shared/modelParams'
import { ANY, type PropertyFilter } from '../../lib/propertyFilters'

const GB = 1024 ** 3

export function entryFamily(m: ModelEntry): string | null {
  if (m.remote) return modelFamily(null, m.remote.model)
  return m.info ? modelFamily(m.info.architecture, m.name) : null
}

export function shapeFilter<T>(info: (item: T) => ModelInfo | null | undefined): PropertyFilter<T> {
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

export function mtpFilter<T>(info: (item: T) => ModelInfo | null | undefined): PropertyFilter<T> {
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

export function modelFilters(models: ModelEntry[], bytes: (m: ModelEntry) => number): PropertyFilter<ModelEntry>[] {
  const local = (m: ModelEntry) => (m.remote ? null : m.info)
  const familyBuckets = new Map<string, { count: number; archs: Set<string>; group: string }>()
  for (const m of models) {
    const fam = entryFamily(m)
    if (!fam) continue
    const cur = familyBuckets.get(fam) ?? { count: 0, archs: new Set<string>(), group: m.info?.kind === 'image' ? 'Image' : m.remote ? 'Remote' : 'Language' }
    cur.count += 1
    if (m.info?.architecture) cur.archs.add(m.info.architecture)
    familyBuckets.set(fam, cur)
  }
  const familyOptions = [...familyBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fam, meta]) => ({
      value: fam,
      label: fam,
      group: meta.group,
      note: `${meta.count} model${meta.count === 1 ? '' : 's'}${meta.archs.size ? ` · ${[...meta.archs].sort().join(', ')}` : ''}`
    }))
  const quants = [...new Set(models.flatMap((m) => (m.info?.quant ? [m.info.quant] : [])))].sort()
  const largest = Math.max(1, ...models.filter((m) => !m.remote).map((m) => Math.ceil(bytes(m) / GB)))
  return [
    {
      kind: 'choice',
      id: 'family',
      label: 'Family',
      layout: 'select',
      options: [{ value: ANY, label: 'All families' }, ...familyOptions],
      test: (m, value) => {
        if (!m.remote && m.info === undefined) return null
        return entryFamily(m) === value
      }
    },
    shapeFilter(local),
    mtpFilter(local),
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
