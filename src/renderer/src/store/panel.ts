import { create } from 'zustand'
import type { EntryViewData, PanelItem, ViewKind, ViewRef, WidgetViewData } from '@shared/types'
import { engine } from '../lib/ipc'
import type { DataSelection } from './data'
import { noteFailure } from './problems'

const DRAFT_PREFIX = '__draft__:'
const MAX_DRAFT_ITEMS = 200

export const draftPanelKey = (convKey = 'chat'): string => `${DRAFT_PREFIX}${convKey}`
export const isDraftPanel = (panelKey: string): boolean => panelKey.startsWith(DRAFT_PREFIX)

interface SideState {
  files: DataSelection | null
  setFiles: (s: DataSelection | null) => void
}

export const useSide = create<SideState>((set) => ({
  files: null,
  setFiles: (files) => set({ files })
}))

interface DraftSpec {
  module: string
  tab?: string
  key?: string | null
  view: ViewRef
}

const PROMOTE_VIEW: Partial<Record<ViewKind, (sessionId: string, data: unknown) => Promise<string>>> = {
  entry: (sessionId, data) => {
    const d = data as EntryViewData
    return engine('panel.showEntry', { sessionId, entry: `${d.kind}/${d.id}`, part: d.part ?? null })
  },
  widget: (sessionId, data) => {
    const d = data as WidgetViewData
    return engine('panel.showWidget', { sessionId, dashboardId: d.dashboardId, widgetId: d.widgetId })
  }
}

interface PanelState {
  items: Record<string, PanelItem[]>
  seen: Record<string, number>
  load: (sessionId: string) => Promise<void>
  set: (sessionId: string, items: PanelItem[]) => void
  markSeen: (sessionId: string, tab: string) => void
  showDraft: (convKey: string, spec: DraftSpec) => string
  promoteDraft: (convKey: string, sessionId: string) => Promise<void>
  remove: (sessionId: string, id: string) => Promise<void>
  clear: (sessionId: string, tab: string) => Promise<void>
}

export const seenKey = (sessionId: string, tab: string): string => `${sessionId}\u0000${tab}`

export const usePanel = create<PanelState>((set, get) => ({
  items: {},
  seen: {},
  load: async (sessionId) => {
    if (isDraftPanel(sessionId)) return
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
  showDraft: (convKey, spec) => {
    const panelKey = draftPanelKey(convKey)
    const now = Date.now()
    const key = spec.key?.trim() || null
    const tab = spec.tab?.trim() || 'outputs'
    const current = [...(get().items[panelKey] ?? [])]
    const existing = key ? current.findIndex((i) => i.module === spec.module && i.key === key) : -1
    let id: string
    if (existing > -1) {
      const updated: PanelItem = { ...current[existing], tab, view: spec.view, updatedAt: now }
      current.splice(existing, 1)
      current.push(updated)
      id = updated.id
    } else {
      id = `draft-${now}-${Math.random().toString(36).slice(2, 8)}`
      current.push({ id, key, tab, module: spec.module, view: spec.view, createdAt: now, updatedAt: now })
    }
    set((s) => ({ items: { ...s.items, [panelKey]: current.slice(-MAX_DRAFT_ITEMS) } }))
    return id
  },
  promoteDraft: async (convKey, sessionId) => {
    const panelKey = draftPanelKey(convKey)
    const drafts = get().items[panelKey]
    if (!drafts?.length) return
    set((s) => {
      const items = { ...s.items }
      delete items[panelKey]
      return { items }
    })
    for (const item of drafts) {
      const fn = PROMOTE_VIEW[item.view.kind]
      if (!fn) continue
      await fn(sessionId, item.view.data).catch(noteFailure('side', 'Could not carry panel items into the new chat'))
    }
  },
  remove: async (sessionId, id) => {
    if (isDraftPanel(sessionId)) {
      set((s) => ({ items: { ...s.items, [sessionId]: (s.items[sessionId] ?? []).filter((i) => i.id !== id) } }))
      return
    }
    await engine('panel.remove', { sessionId, id })
  },
  clear: async (sessionId, tab) => {
    if (isDraftPanel(sessionId)) {
      set((s) => ({ items: { ...s.items, [sessionId]: (s.items[sessionId] ?? []).filter((i) => i.tab !== tab) } }))
      return
    }
    await engine('panel.clear', { sessionId, tab })
  }
}))

export function unseenIn(items: PanelItem[], seen: Record<string, number>, sessionId: string, tab: string | null): number {
  return items.filter((i) => (tab === null || i.tab === tab) && i.updatedAt > (seen[seenKey(sessionId, i.tab)] ?? 0)).length
}
