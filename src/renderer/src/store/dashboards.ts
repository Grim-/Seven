import { create } from 'zustand'
import { usePlaces } from './places'
import type { Dashboard } from '@shared/types'
import { engine } from '../lib/ipc'

interface DashboardsState {
  list: Dashboard[]
  activeId: string | null
  refresh: () => Promise<void>
  setActive: (id: string | null) => void
  onChanged: (id: string, dashboard: Dashboard | null) => void
}

function sorted(list: Dashboard[]): Dashboard[] {
  return [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

const ACTIVE_PLACE = 'view.dashboards.active'

function pickActive(current: string | null, list: Dashboard[]): string | null {
  const remembered = usePlaces.getState().places[ACTIVE_PLACE]
  for (const id of [current, typeof remembered === 'string' ? remembered : null]) if (id && list.some((d) => d.id === id)) return id
  return list[0]?.id ?? null
}

export const useDashboards = create<DashboardsState>((set, get) => ({
  list: [],
  activeId: null,
  refresh: async () => {
    const list = sorted(await engine('dashboards.list'))
    set((s) => ({ list, activeId: pickActive(s.activeId, list) }))
  },
  setActive: (activeId) => {
    set({ activeId })
    usePlaces.getState().save(ACTIVE_PLACE, activeId)
  },
  onChanged: (id, dashboard) => {
    const rest = get().list.filter((d) => d.id !== id)
    const list = sorted(dashboard ? [...rest, dashboard] : rest)
    set((s) => ({ list, activeId: s.activeId === id && !dashboard ? (list[0]?.id ?? null) : (s.activeId ?? list[0]?.id ?? null) }))
  }
}))

usePlaces.subscribe((s, prev) => {
  if (!s.loaded || prev.loaded) return
  const remembered = s.places[ACTIVE_PLACE]
  const { list } = useDashboards.getState()
  if (typeof remembered === 'string' && list.some((d) => d.id === remembered)) useDashboards.setState({ activeId: remembered })
})
