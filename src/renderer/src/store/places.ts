import { create } from 'zustand'
import { engine } from '../lib/ipc'
import { failed } from '../lib/notify'

interface PlacesState {
  places: Record<string, unknown>
  loaded: boolean
  refresh: () => Promise<void>
  save: (key: string, value: unknown) => void
  saveImmediate: (key: string, value: unknown) => void
}

const CACHE_PREFIX = 'seven.place.'
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const pending = new Map<string, unknown>()

export function readCachedPlace(key: string): unknown {
  if (!key.startsWith('view.')) return undefined
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`)
    return raw === null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

function writeCachedPlace(key: string, value: unknown): void {
  if (!key.startsWith('view.') || typeof window === 'undefined') return
  window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value))
}

function commitPlace(key: string, value: unknown): void {
  if (!usePlaces.getState().loaded) return
  pending.set(key, value)
  void engine('places.set', { key, value })
    .then(() => {
      if (pending.get(key) === value) pending.delete(key)
    })
    .catch((err) => {
      if (pending.get(key) === value) pending.delete(key)
      failed('Could not remember where you were')(err)
    })
}

export const usePlaces = create<PlacesState>((set, get) => ({
  places: {},
  loaded: false,
  refresh: async () => {
    const remote = await engine('places.get')
    const merged: Record<string, unknown> = { ...remote }
    for (const [key, value] of pending.entries()) {
      merged[key] = value
    }
    set({ places: merged, loaded: true })
    for (const [key, value] of pending.entries()) {
      if (!timers.has(key)) commitPlace(key, value)
    }
  },
  save: (key, value) => {
    writeCachedPlace(key, value)
    pending.set(key, value)
    set((s) => ({ places: { ...s.places, [key]: value } }))
    clearTimeout(timers.get(key))
    if (!get().loaded) return
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        commitPlace(key, value)
      }, 400)
    )
  },
  saveImmediate: (key, value) => {
    writeCachedPlace(key, value)
    clearTimeout(timers.get(key))
    timers.delete(key)
    pending.set(key, value)
    set((s) => ({ places: { ...s.places, [key]: value } }))
    if (!get().loaded) return
    commitPlace(key, value)
  }
}))
