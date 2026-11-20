import { useViewPlace } from './viewPlace'

export const ANY = 'any'

export interface ChoiceFilter<T> {
  kind: 'choice'
  id: string
  label: string
  layout?: 'segmented' | 'select'
  options: { value: string; label: string; group?: string; note?: string }[]
  test: (item: T, value: string) => boolean | null
}

export interface MaxFilter<T> {
  kind: 'max'
  id: string
  label: string
  max: number
  step: number
  unit: string
  measure: (item: T) => number | null
}

export type PropertyFilter<T> = ChoiceFilter<T> | MaxFilter<T>

export type FilterValues = Record<string, string | number>

function passes<T>(item: T, filter: PropertyFilter<T>, values: FilterValues): boolean | null {
  if (filter.kind === 'choice') {
    const value = String(values[filter.id] ?? ANY)
    return value === ANY ? true : filter.test(item, value)
  }
  const limit = Number(values[filter.id] ?? filter.max)
  if (limit >= filter.max) return true
  const size = filter.measure(item)
  return size === null ? null : size <= limit
}

export function applyFilters<T>(items: T[], filters: PropertyFilter<T>[], values: FilterValues): { shown: T[]; pending: T[] } {
  const shown: T[] = []
  const pending: T[] = []
  for (const item of items) {
    const results = filters.map((f) => passes(item, f, values))
    if (results.includes(false)) continue
    if (results.includes(null)) pending.push(item)
    else shown.push(item)
  }
  return { shown, pending }
}

export function filterActive<T>(filter: PropertyFilter<T>, values: FilterValues): boolean {
  return filter.kind === 'choice' ? String(values[filter.id] ?? ANY) !== ANY : Number(values[filter.id] ?? filter.max) < filter.max
}

export function useFilterValues(key: string): [FilterValues, (id: string, value: string | number) => void] {
  const [values, setValues] = useViewPlace<FilterValues>(`facets.${key}`, {})
  return [values, (id, value) => setValues({ ...values, [id]: value })]
}
