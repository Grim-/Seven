import type { ChatListPrefs } from '@shared/types'
import { useApp } from '../store/app'

type ListKey = 'chatList' | 'dataList'

export function useListPrefs(
  key: ListKey,
  fallback: ChatListPrefs
): [ChatListPrefs, (patch: Partial<ChatListPrefs>) => void] {
  const prefs = useApp((s) => s.settings?.[key]) ?? fallback
  const updateSettings = useApp((s) => s.updateSettings)
  return [prefs, (patch) => void updateSettings({ [key]: { ...prefs, ...patch } })]
}
