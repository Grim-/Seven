import { count, text, type GgufView } from '../view'

export function resolveImatrix(v: GgufView): { dataset: string | null; chunks: number | null } | null {
  const im = v.quantize.imatrix
  if (!im || typeof im !== 'object') return null
  const m = im as Record<string, unknown>
  const datasets = Array.isArray(m.datasets) ? m.datasets.map(String).join(', ') : null
  return { dataset: text(m.dataset) ?? datasets, chunks: count(m.chunks_count) }
}
