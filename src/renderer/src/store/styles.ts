import { create } from 'zustand'
import type { ReasoningStyle } from '@shared/types'
import { engine } from '../lib/ipc'

interface StylesState {
  list: ReasoningStyle[]
  refresh: () => Promise<void>
}

export const useStyleList = create<StylesState>((set) => ({
  list: [],
  refresh: async () => {
    set({ list: await engine('styles.list') })
  }
}))
