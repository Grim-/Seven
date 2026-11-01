import { create } from 'zustand'
import type { WidgetInfo, WidgetProviderInfo } from '@shared/types'
import { engine } from '../lib/ipc'

interface WidgetInfoState {
  providers: WidgetProviderInfo[]
  refresh: () => Promise<void>
}

export const useWidgetInfo = create<WidgetInfoState>((set) => ({
  providers: [],
  refresh: async () => {
    const info: WidgetInfo = await engine('widgets.info')
    set({ providers: info.providers })
  }
}))

