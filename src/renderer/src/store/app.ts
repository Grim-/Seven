import { noteFailure } from './problems'
import { create } from 'zustand'
import type { AppInfo, EngineStatus, Settings, ViewId } from '@shared/types'
import { main } from '../lib/ipc'
import { allowedRequest } from '../lib/transport'

interface AppState {
  view: ViewId
  settings: Settings | null
  info: AppInfo | null
  engine: EngineStatus
  setView: (view: ViewId) => void
  updateSettings: (patch: Partial<Settings>) => Promise<Settings>
}

export const useApp = create<AppState>((set, get) => ({
  view: 'chat',
  settings: null,
  info: null,
  engine: { state: 'starting', restarts: 0 },
  setView: (view) => {
    set({ view })
    if (allowedRequest('main', 'settings.set')) void main('settings.set', { lastView: view }).catch(noteFailure('app', 'Could not remember the open view'))
  },
  updateSettings: async (patch) => {
    const current = get().settings
    if (!allowedRequest('main', 'settings.set') && current) {
      const local = { ...current, ...patch }
      set({ settings: local })
      return local
    }
    const settings = await main('settings.set', patch)
    set({ settings })
    return settings
  }
}))
