import { create } from 'zustand'
import type { ModuleInfo, ToolsPrefs } from '@shared/types'
import { engine } from '../lib/ipc'

interface ToolsState {
  list: ModuleInfo[]
  loaded: boolean
  prefs: ToolsPrefs | null
  refresh: () => Promise<void>
  setList: (list: ModuleInfo[]) => void
}

export const useTools = create<ToolsState>((set) => ({
  list: [],
  loaded: false,
  prefs: null,
  refresh: async () => {
    const [list, prefs] = await Promise.all([engine('tools.list'), engine('tools.prefs.get')])
    set({ list, prefs, loaded: true })
  },
  setList: (list) => set({ list, loaded: true })
}))
