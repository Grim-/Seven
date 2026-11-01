import { create } from 'zustand'
import type { AppInfo, EngineStatus, Settings, ViewId } from '@shared/types'
import { main } from '../lib/ipc'

interface AppState {
  view: ViewId
  settings: Settings | null
  info: AppInfo | null
  engine: EngineStatus
  setView: (view: ViewId) => void
  updateSettings: (patch: Partial<Settings>) => Promise<Settings>
}

export const useApp = create<AppState>((set) => ({
  view: 'chat',
  settings: null,
  info: null,
  engine: { state: 'starting', restarts: 0 },
  setView: (view) => {
    set({ view })
    void main('settings.set', { lastView: view })
  },
  updateSettings: async (patch) => {
    const settings = await main('settings.set', patch)
    set({ settings })
    return settings
  }
}))
