import type { CollectionRecord, FieldDef, FieldValue, ViewOptions } from './types'

const TRUE = new Set(['true', 'yes', 'y', '1', 'done', 'checked', 'x'])

export function matches(field: FieldDef | undefined, actual: FieldValue | undefined, wanted: unknown): boolean {
  if (wanted === null || wanted === undefined || wanted === '') return actual === null || actual === undefined || (Array.isArray(actual) && actual.length === 0)
  if (actual === null || actual === undefined) return false
  if (Array.isArray(actual)) {
    const wants = Array.isArray(wanted) ? wanted : [wanted]
    return wants.every((w) => actual.some((a) => a.toLowerCase() === String(w).toLowerCase()))
  }
  if (field?.type === 'boolean') {
    const w = typeof wanted === 'string' ? TRUE.has(wanted.trim().toLowerCase()) : Boolean(wanted)
    return actual === w
  }
  if (typeof actual === 'number') return actual === Number(wanted)
  return String(actual).toLowerCase() === String(wanted).toLowerCase()
}

export function compare(a: FieldValue | undefined, b: FieldValue | undefined): number {
  const empty = (v: FieldValue | undefined) => v === null || v === undefined || (Array.isArray(v) && v.length === 0)
  if (empty(a) && empty(b)) return 0
  if (empty(a)) return 1
  if (empty(b)) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(Array.isArray(a) ? a.join(',') : a).localeCompare(String(Array.isArray(b) ? b.join(',') : b), undefined, { numeric: true })
}

export function applyOptions(fields: FieldDef[], records: CollectionRecord[], options: ViewOptions): CollectionRecord[] {
  let out = records
  const filter = options.filter && typeof options.filter === 'object' ? (options.filter as Record<string, unknown>) : null
  if (filter) {
    for (const [key, wanted] of Object.entries(filter)) {
      const field = fields.find((f) => f.name.toLowerCase() === key.toLowerCase())
      if (field) out = out.filter((r) => matches(field, r.values[field.name], wanted))
    }
  }
  const sort = typeof options.sort === 'string' ? fields.find((f) => f.name.toLowerCase() === (options.sort as string).toLowerCase()) : undefined
  if (sort) {
    out = [...out].sort((a, b) => compare(a.values[sort.name], b.values[sort.name]))
    if (options.descending === true) out.reverse()
  }
  if (typeof options.limit === 'number' && options.limit > 0) out = out.slice(0, options.limit)
  return out
}
