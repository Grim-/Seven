import { useViewPlace } from './viewPlace'

export const ANY = 'any'

export interface ChoiceFacet<T> {
  kind: 'choice'
  id: string
  label: string
  options: { value: string; label: string }[]
  test: (item: T, value: string) => boolean | null
}

export interface MaxFacet<T> {
  kind: 'max'
  id: string
  label: string
  max: number
  step: number
  unit: string
  measure: (item: T) => number | null
}

export type Facet<T> = ChoiceFacet<T> | MaxFacet<T>

export type FacetValues = Record<string, string | number>

function passes<T>(item: T, facet: Facet<T>, values: FacetValues): boolean | null {
  if (facet.kind === 'choice') {
    const value = String(values[facet.id] ?? ANY)
    return value === ANY ? true : facet.test(item, value)
  }
  const limit = Number(values[facet.id] ?? facet.max)
  if (limit >= facet.max) return true
  const size = facet.measure(item)
  return size === null ? null : size <= limit
}

export function applyFacets<T>(items: T[], facets: Facet<T>[], values: FacetValues): { shown: T[]; pending: T[] } {
  const shown: T[] = []
  const pending: T[] = []
  for (const item of items) {
    const results = facets.map((f) => passes(item, f, values))
    if (results.includes(false)) continue
    if (results.includes(null)) pending.push(item)
    else shown.push(item)
  }
  return { shown, pending }
}

export function facetActive<T>(facet: Facet<T>, values: FacetValues): boolean {
  return facet.kind === 'choice' ? String(values[facet.id] ?? ANY) !== ANY : Number(values[facet.id] ?? facet.max) < facet.max
}

export function useFacetValues(key: string): [FacetValues, (id: string, value: string | number) => void] {
  const [values, setValues] = useViewPlace<FacetValues>(`facets.${key}`, {})
  return [values, (id, value) => setValues({ ...values, [id]: value })]
}
