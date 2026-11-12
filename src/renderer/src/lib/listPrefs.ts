import { useEffect, useState } from 'react'
import type { ChatListPrefs, Settings } from '@shared/types'
import { useApp } from '../store/app'
import { useCompactLayout } from './form'

type DrawerKey = 'chatList' | 'dataList' | 'pagesList' | 'sidePanel'
type ListKey = 'chatList' | 'dataList' | 'pagesList'

export function useDrawerPrefs<K extends DrawerKey>(
  key: K,
  fallback: Settings[K]
): [Settings[K], (patch: Partial<Settings[K]>) => void] {
  const prefs = (useApp((s) => s.settings?.[key]) ?? fallback) as Settings[K]
  const updateSettings = useApp((s) => s.updateSettings)
  const compact = useCompactLayout()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (compact) setDrawerOpen(false)
  }, [compact])

  if (compact) {
    return [
      { ...prefs, open: drawerOpen },
      (patch) => {
        if (patch.open !== undefined) setDrawerOpen(patch.open)
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
