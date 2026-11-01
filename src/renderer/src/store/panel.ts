import { create } from 'zustand'
import type { PanelItem } from '@shared/types'
import { engine } from '../lib/ipc'

interface PanelState {
  items: Record<string, PanelItem[]>
  seen: Record<string, number>
  load: (sessionId: string) => Promise<void>
  set: (sessionId: string, items: PanelItem[]) => void
  markSeen: (sessionId: string, tab: string) => void
  remove: (sessionId: string, id: string) => Promise<void>
  clear: (sessionId: string, tab: string) => Promise<void>
}

export const seenKey = (sessionId: string, tab: string): string => `${sessionId}\u0000${tab}`

export const usePanel = create<PanelState>((set) => ({
  items: {},
  seen: {},
  load: async (sessionId) => {
    const items = await engine('panel.list', { sessionId })
    const now = Date.now()
    set((s) => {
      const seen = { ...s.seen }
      for (const tab of new Set(items.map((i) => i.tab))) seen[seenKey(sessionId, tab)] ??= now
      return { items: { ...s.items, [sessionId]: items }, seen }
    })
  },
  set: (sessionId, items) => set((s) => ({ items: { ...s.items, [sessionId]: items } })),
  markSeen: (sessionId, tab) => set((s) => ({ seen: { ...s.seen, [seenKey(sessionId, tab)]: Date.now() } })),
  remove: async (sessionId, id) => {
    await engine('panel.remove', { sessionId, id })
  },
  clear: async (sessionId, tab) => {
    await engine('panel.clear', { sessionId, tab })
  }
}))

export function unseenIn(items: PanelItem[], seen: Record<string, number>, sessionId: string, tab: string | null): number {
  return items.filter((i) => (tab === null || i.tab === tab) && i.updatedAt > (seen[seenKey(sessionId, i.tab)] ?? 0)).length
}
