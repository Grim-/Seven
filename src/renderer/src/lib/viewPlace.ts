import { create } from 'zustand'
import { readCachedPlace, usePlaces } from '../store/places'

const useChosen = create<{ values: Record<string, { value: unknown }> }>(() => ({ values: {} }))

export function setViewPlace<T>(key: string, next: T): void {
  const full = `view.${key}`
  useChosen.setState((s) => ({ values: { ...s.values, [full]: { value: next } } }))
  usePlaces.getState().saveImmediate(full, next)
}

export function peekViewPlace<T>(key: string, fallback: T): T {
  const full = `view.${key}`
  const chosen = useChosen.getState().values[full]
  if (chosen) return chosen.value as T
  const saved = usePlaces.getState().places[full]
  if (saved !== undefined) return saved as T
  const cached = readCachedPlace(full)
  return cached !== undefined ? (cached as T) : fallback
}

export function useViewPlace<T>(key: string, fallback: T): [T, (next: T) => void] {
  const full = `view.${key}`
  const saved = usePlaces((s) => s.places[full] as T | undefined)
  const chosen = useChosen((s) => s.values[full])
  const value = chosen ? (chosen.value as T) : saved !== undefined ? saved : ((readCachedPlace(full) as T | undefined) ?? fallback)
  return [value, (next: T) => setViewPlace(key, next)]
}
