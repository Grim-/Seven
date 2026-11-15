import { useEffect } from 'react'
import { create } from 'zustand'
import type { ChatListPrefs, Settings, SidePanelPrefs } from '@shared/types'
import { useApp } from '../store/app'
import { useCompactLayout } from './form'

type DrawerKey = 'chatList' | 'dataList' | 'pagesList' | 'sidePanel'
type ListKey = 'chatList' | 'dataList' | 'pagesList'

const useCompactDrawers = create<{
  open: Partial<Record<DrawerKey, boolean>>
  setOpen: (key: DrawerKey, value: boolean) => void
  clear: () => void
}>((set) => ({
  open: {},
  setOpen: (key, value) => set((s) => ({ open: { ...s.open, [key]: value } })),
  clear: () => set({ open: {} })
}))

export function openSidePanelTab(tab = 'outputs'): void {
  const app = useApp.getState()
  const cur: SidePanelPrefs = app.settings?.sidePanel ?? { open: false, width: 380, tab: 'files' }
  useCompactDrawers.getState().setOpen('sidePanel', true)
  void app.updateSettings({ sidePanel: { ...cur, open: true, tab } })
}

export function useDrawerPrefs<K extends DrawerKey>(
  key: K,
  fallback: Settings[K]
): [Settings[K], (patch: Partial<Settings[K]>) => void] {
  const prefs = (useApp((s) => s.settings?.[key]) ?? fallback) as Settings[K]
  const updateSettings = useApp((s) => s.updateSettings)
  const compact = useCompactLayout()
  const drawerOpen = useCompactDrawers((s) => s.open[key] ?? false)
  const setDrawerOpen = useCompactDrawers((s) => s.setOpen)

  useEffect(() => {
    if (compact) setDrawerOpen(key, false)
  }, [compact, key, setDrawerOpen])

  if (compact) {
    return [
      { ...prefs, open: drawerOpen },
      (patch) => {
        if (patch.open !== undefined) setDrawerOpen(key, patch.open)
        const { open: _, ...rest } = patch
        if (Object.keys(rest).length) void updateSettings({ [key]: { ...prefs, ...rest } })
      }
    ]
  }

  return [prefs, (patch) => void updateSettings({ [key]: { ...prefs, ...patch } })]
}

export function useListPrefs(
  key: ListKey,
  fallback: ChatListPrefs
): [ChatListPrefs, (patch: Partial<ChatListPrefs>) => void] {
  return useDrawerPrefs(key, fallback)
}
