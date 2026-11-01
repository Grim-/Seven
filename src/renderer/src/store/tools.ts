import { create } from 'zustand'
import type { ModuleInfo, ToolsPrefs } from '@shared/types'
import { engine } from '../lib/ipc'

interface ToolsState {
  list: ModuleInfo[]
  prefs: ToolsPrefs | null
  refresh: () => Promise<void>
  setList: (list: ModuleInfo[]) => void
}

export const useTools = create<ToolsState>((set) => ({
  list: [],
  prefs: null,
  refresh: async () => {
    const [list, prefs] = await Promise.all([engine('tools.list'), engine('tools.prefs.get')])
    set({ list, prefs })
  },
  setList: (list) => set({ list })
}))
