import { create } from 'zustand'
import { engine } from '../lib/ipc'
import { failed } from '../lib/notify'

interface PlacesState {
  places: Record<string, unknown>
  loaded: boolean
  refresh: () => Promise<void>
  save: (key: string, value: unknown) => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const usePlaces = create<PlacesState>((set, get) => ({
  places: {},
  loaded: false,
  refresh: async () => set({ places: await engine('places.get'), loaded: true }),
  save: (key, value) => {
    if (!get().loaded) return
    set((s) => ({ places: { ...s.places, [key]: value } }))
    clearTimeout(timers.get(key))
    timers.set(
      key,
      setTimeout(() => void engine('places.set', { key, value }).catch(failed('Could not remember where you were')), 400)
    )
  }
}))
