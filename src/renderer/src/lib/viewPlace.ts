import { create } from 'zustand'
import { usePlaces } from '../store/places'

const useChosen = create<{ values: Record<string, { value: unknown }> }>(() => ({ values: {} }))

export function setViewPlace<T>(key: string, next: T): void {
  const full = `view.${key}`
  useChosen.setState((s) => ({ values: { ...s.values, [full]: { value: next } } }))
  usePlaces.getState().save(full, next)
}

export function useViewPlace<T>(key: string, fallback: T): [T, (next: T) => void] {
  const full = `view.${key}`
  const saved = usePlaces((s) => s.places[full] as T | undefined)
  const chosen = useChosen((s) => s.values[full])
  const value = chosen ? (chosen.value as T) : saved !== undefined ? saved : fallback
  return [value, (next: T) => setViewPlace(key, next)]
}
