import { useEffect } from 'react'
import { create } from 'zustand'
import type { Backdrop, Dashboard, Widget } from '@shared/types'
import { cleanBackdrop } from '@shared/types'
import { engine } from '../../lib/ipc'
import { focusedConversation } from '../../lib/conversation'
import { peekViewPlace, setViewPlace, useViewPlace } from '../../lib/viewPlace'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { useApp } from '../../store/app'
import { useDashboards } from '../../store/dashboards'
import { usePlaces } from '../../store/places'
import { toast } from '../../store/toasts'

export type BoardLayoutMode = 'tabletop' | 'grid' | 'creator'

export interface TabletopModeState {
  windowed: boolean
  layoutMode: BoardLayoutMode
  editingGrid: boolean
  showPlayTable: boolean
  peekTable: boolean
  pinnedChat: boolean
  showDecks: boolean
  creatorSheetId?: string | null
}

export interface WidgetTokenPose {
  x: number
  y: number
  w: number
  h: number
  expanded: boolean
  surfaceId: string
  rx?: number
  ry?: number
  refW?: number
  refH?: number
}

interface TabletopInsetsState {
  bottom: number
  setBottom: (bottom: number) => void
}

export const useTabletopInsets = create<TabletopInsetsState>((set) => ({
  bottom: 0,
  setBottom: (bottom) => set((s) => (s.bottom === bottom ? s : { bottom }))
}))

export interface SurfaceTopSlot {
  id: string
  index: number
  label: string
  gx: number
  gy: number
  backdrop?: Backdrop | null
}

export interface BoardSurfacesState {
  activeId: string
  slots: SurfaceTopSlot[]
}

const DEFAULT_SLOT: SurfaceTopSlot = {
  id: '0',
  index: 0,
  label: 'Main Surface',
  gx: 0,
  gy: 0
}

const DEFAULT_SURFACES: BoardSurfacesState = {
  activeId: '0',
  slots: [DEFAULT_SLOT]
}

interface SwitcherStore {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useSurfaceSwitcher = create<SwitcherStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open }))
}))

export interface PendingBoardPlacement {
  dashboardId: string
  label: string
  commit: (at: { x: number; y: number }, canvas?: { w: number; h: number } | null) => Promise<void>
}

interface PendingPlacementStore {
  pending: PendingBoardPlacement | null
  setPending: (pending: PendingBoardPlacement | null) => void
}

export const usePendingBoardPlacement = create<PendingPlacementStore>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending })
}))

const DEFAULT_MODE: TabletopModeState = {
  windowed: false,
  layoutMode: 'tabletop',
  editingGrid: false,
  showPlayTable: false,
  peekTable: false,
  pinnedChat: true,
  showDecks: true,
  creatorSheetId: null
}

const MODE_KEY = 'chat.tabletop.mode'

const sessionBoardKey = (sessionId: string | null | undefined): string => `board.session.${sessionId || 'draft'}`
const boardTokensKey = (dashboardId: string): string => `board.tokens.${dashboardId}`
const boardLayoutModeKey = (dashboardId: string): string => `board.layoutMode.${dashboardId}`
const boardSurfacesKey = (dashboardId: string): string => `board.surfaces.${dashboardId}`

export function useTabletopMode(): [TabletopModeState, (patch: Partial<TabletopModeState>) => void] {
  const [mode, setMode] = useViewPlace<TabletopModeState>(MODE_KEY, DEFAULT_MODE)
  const resolved: TabletopModeState = {
    windowed: Boolean(mode?.windowed),
    layoutMode: mode?.layoutMode === 'grid' ? 'grid' : mode?.layoutMode === 'creator' ? 'creator' : 'tabletop',
    editingGrid: Boolean(mode?.editingGrid),
    showPlayTable: Boolean(mode?.showPlayTable),
    peekTable: Boolean(mode?.peekTable),
    pinnedChat: Boolean(mode?.pinnedChat),
    showDecks: mode?.showDecks !== false,
    creatorSheetId: typeof mode?.creatorSheetId === 'string' ? mode.creatorSheetId : null
  }
  const update = (patch: Partial<TabletopModeState>) => {
    setMode({ ...resolved, ...patch })
  }
  return [resolved, update]
}

export function setTabletopMode(patch: Partial<TabletopModeState>): void {
  const current = peekViewPlace<Partial<TabletopModeState>>(MODE_KEY, DEFAULT_MODE)
  const curLayout: BoardLayoutMode =
    current.layoutMode === 'grid' ? 'grid' : current.layoutMode === 'creator' ? 'creator' : 'tabletop'
  setViewPlace<TabletopModeState>(MODE_KEY, {
    windowed: patch.windowed ?? Boolean(current.windowed),
    layoutMode: patch.layoutMode ?? curLayout,
    editingGrid: patch.editingGrid ?? Boolean(current.editingGrid),
    showPlayTable: patch.showPlayTable ?? Boolean(current.showPlayTable),
    peekTable: patch.peekTable ?? Boolean(current.peekTable),
    pinnedChat: patch.pinnedChat ?? Boolean(current.pinnedChat),
    showDecks: patch.showDecks ?? current.showDecks !== false,
    creatorSheetId: patch.creatorSheetId !== undefined ? patch.creatorSheetId : (current.creatorSheetId ?? null)
  })
}

export function useBoardLayoutMode(dashboardId: string | null, fallback: BoardLayoutMode = 'grid'): [BoardLayoutMode, (next: BoardLayoutMode) => void] {
  const key = dashboardId ? boardLayoutModeKey(dashboardId) : 'board.layoutMode.none'
  const saved = usePlaces((s) => s.places[key])
  const mode: BoardLayoutMode = saved === 'tabletop' || saved === 'grid' ? saved : fallback
  const setMode = (next: BoardLayoutMode) => {
    if (dashboardId) usePlaces.getState().save(key, next)
  }
  return [mode, setMode]
}

function normalizeSurfaces(raw: unknown): BoardSurfacesState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_SURFACES
  const obj = raw as Partial<BoardSurfacesState>
  const rawSlots = Array.isArray(obj.slots) ? obj.slots : []
  const slots: SurfaceTopSlot[] = []
  const seenCoords = new Set<string>()
  for (const s of rawSlots) {
    if (!s || typeof s !== 'object') continue
    const gx = typeof s.gx === 'number' && Number.isFinite(s.gx) ? Math.round(s.gx) : 0
    const gy = typeof s.gy === 'number' && Number.isFinite(s.gy) ? Math.round(s.gy) : 0
    const coordKey = `${gx},${gy}`
    if (seenCoords.has(coordKey)) continue
    seenCoords.add(coordKey)
    const index = typeof s.index === 'number' ? s.index : slots.length
    const id = typeof s.id === 'string' && s.id ? s.id : String(index)
    const label = typeof s.label === 'string' && s.label.trim() ? s.label.trim() : index === 0 ? 'Main Surface' : `Surface ${index}`
    const backdrop = 'backdrop' in s ? cleanBackdrop(s.backdrop) : null
    slots.push({ id, index, label, gx, gy, ...(backdrop ? { backdrop } : {}) })
  }
  if (!slots.some((s) => s.gx === 0 && s.gy === 0)) {
    slots.unshift(DEFAULT_SLOT)
  }
  const activeId = typeof obj.activeId === 'string' && slots.some((s) => s.id === obj.activeId) ? obj.activeId : slots[0].id
  return { activeId, slots }
}

export function getBoardSurfaces(dashboardId: string | null | undefined): BoardSurfacesState {
  if (!dashboardId) return DEFAULT_SURFACES
  return normalizeSurfaces(usePlaces.getState().places[boardSurfacesKey(dashboardId)])
}

export function useBoardSurfaces(dashboardId: string | null | undefined): {
  state: BoardSurfacesState
  activeSlot: SurfaceTopSlot
  setActiveSurface: (surfaceId: string) => void
  addSurfaceAt: (gx: number, gy: number, label?: string) => SurfaceTopSlot
  renameSurface: (surfaceId: string, label: string) => void
  removeSurface: (surfaceId: string) => void
  setSurfaceBackdrop: (surfaceId: string, backdrop: Backdrop | null) => void
} {
  const key = dashboardId ? boardSurfacesKey(dashboardId) : ''
  const raw = usePlaces((s) => (key ? s.places[key] : undefined))
  const state = normalizeSurfaces(raw)
  const activeSlot = state.slots.find((s) => s.id === state.activeId) ?? state.slots[0] ?? DEFAULT_SLOT

  const save = (next: BoardSurfacesState) => {
    if (key) usePlaces.getState().save(key, next)
  }

  const setActiveSurface = (surfaceId: string) => {
    if (!state.slots.some((s) => s.id === surfaceId)) return
    save({ ...state, activeId: surfaceId })
  }

  const addSurfaceAt = (gx: number, gy: number, customLabel?: string): SurfaceTopSlot => {
    const existing = state.slots.find((s) => s.gx === gx && s.gy === gy)
    if (existing) {
      save({ ...state, activeId: existing.id })
      return existing
    }
    const usedIndices = new Set(state.slots.map((s) => s.index))
    let nextIndex = 1
    while (usedIndices.has(nextIndex)) nextIndex++
    const slot: SurfaceTopSlot = {
      id: String(nextIndex),
      index: nextIndex,
      label: customLabel?.trim() || `Surface ${nextIndex}`,
      gx,
      gy
    }
    save({
      activeId: slot.id,
      slots: [...state.slots, slot]
    })
    return slot
  }

  const renameSurface = (surfaceId: string, label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    save({
      ...state,
      slots: state.slots.map((s) => (s.id === surfaceId ? { ...s, label: trimmed } : s))
    })
  }

  const removeSurface = (surfaceId: string) => {
    if (surfaceId === '0') return
    const nextSlots = state.slots.filter((s) => s.id !== surfaceId)
    if (!nextSlots.length) return
    const nextActive = state.activeId === surfaceId ? '0' : state.activeId
    save({ activeId: nextActive, slots: nextSlots })
    // Move any slates on that removed surface back to '0'
    if (dashboardId) {
      const tKey = boardTokensKey(dashboardId)
      const tRaw = usePlaces.getState().places[tKey]
      if (tRaw && typeof tRaw === 'object' && !Array.isArray(tRaw)) {
        const map = { ...(tRaw as Record<string, Partial<WidgetTokenPose>>) }
        let changed = false
        for (const [wid, pose] of Object.entries(map)) {
          if (pose?.surfaceId === surfaceId) {
            map[wid] = { ...pose, surfaceId: '0' }
            changed = true
          }
        }
        if (changed) usePlaces.getState().save(tKey, map)
      }
    }
  }

  const setSurfaceBackdrop = (surfaceId: string, backdrop: Backdrop | null) => {
    const cleaned = cleanBackdrop(backdrop)
    save({
      ...state,
      slots: state.slots.map((s) => {
        if (s.id !== surfaceId) return s
        if (cleaned) return { ...s, backdrop: cleaned }
        const { backdrop: _removed, ...rest } = s
        return rest
      })
    })
  }

  return { state, activeSlot, setActiveSurface, addSurfaceAt, renameSurface, removeSurface, setSurfaceBackdrop }
}

export function setBoardSurfaceBackdrop(dashboardId: string, surfaceId: string, backdrop: Backdrop | null): void {
  const key = boardSurfacesKey(dashboardId)
  const state = normalizeSurfaces(usePlaces.getState().places[key])
  const cleaned = cleanBackdrop(backdrop)
  usePlaces.getState().save(key, {
    ...state,
    slots: state.slots.map((s) => {
      if (s.id !== surfaceId) return s
      if (cleaned) return { ...s, backdrop: cleaned }
      const { backdrop: _removed, ...rest } = s
      return rest
    })
  })
}

export function useChatDashboard(sessionId: string | null): [Dashboard | null, (dashboardId: string) => void] {
  useEffect(() => {
    if (!useDashboards.getState().list.length) {
      void useDashboards.getState().refresh().catch(noteFailure('dashboards', 'Could not list dashboards'))
    }
  }, [])
  const list = useDashboards((s) => s.list)
  const activeGlobalId = useDashboards((s) => s.activeId)
  const key = sessionBoardKey(sessionId)
  const savedId = usePlaces((s) => s.places[key])
  const chosenId = typeof savedId === 'string' && list.some((d) => d.id === savedId) ? savedId : activeGlobalId
  const dashboard = list.find((d) => d.id === chosenId) ?? list[0] ?? null

  const selectDashboard = (dashboardId: string) => {
    usePlaces.getState().save(key, dashboardId)
    useDashboards.getState().setActive(dashboardId)
  }

  return [dashboard, selectDashboard]
}

export function takeBoardIntoChat(dashboardId: string, sessionId?: string | null): void {
  const resolvedSession = sessionId !== undefined ? sessionId : (focusedConversation()?.sessionId ?? null)
  usePlaces.getState().save(sessionBoardKey(resolvedSession), dashboardId)
  useDashboards.getState().setActive(dashboardId)
  setTabletopMode({ windowed: true, peekTable: false })
  useApp.getState().setView('chat')
}

const SAFE_PAD = 8
const SLATE_COLLAPSED_W = 288
const SLATE_HEADER_H = 34

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

const MIN_SLATE_W = 92
const MIN_SLATE_H = 110

function defaultTokenPose(index: number, widget?: Widget): WidgetTokenPose {
  const leftSide = index % 2 === 0
  const row = Math.floor(index / 2)
  const w = widget ? Math.max(340, Math.min(680, widget.layout.w * 88)) : 420
  const h = widget ? Math.max(240, Math.min(540, widget.layout.h * 60)) : 320
  return {
    x: leftSide ? 24 : 980,
    y: 44 + (row % 6) * 76,
    w,
    h,
    expanded: false,
    surfaceId: '0',
    rx: leftSide ? 0 : 1
  }
}

export function useWidgetTokenPoses(dashboard: Dashboard | null): Record<string, WidgetTokenPose> {
  const key = dashboard ? boardTokensKey(dashboard.id) : ''
  const raw = usePlaces((s) => (key ? s.places[key] : undefined))
  if (!dashboard) return {}
  const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, Partial<WidgetTokenPose>>) : {}
  const out: Record<string, WidgetTokenPose> = {}
  dashboard.widgets.forEach((w, i) => {
    const cur = saved[w.id]
    const fallback = defaultTokenPose(i, w)
    out[w.id] = {
      x: typeof cur?.x === 'number' ? cur.x : fallback.x,
      y: typeof cur?.y === 'number' ? cur.y : fallback.y,
      w: typeof cur?.w === 'number' && cur.w >= MIN_SLATE_W ? cur.w : fallback.w,
      h: typeof cur?.h === 'number' && cur.h >= MIN_SLATE_H ? cur.h : fallback.h,
      expanded: Boolean(cur?.expanded),
      surfaceId: typeof cur?.surfaceId === 'string' && cur.surfaceId ? cur.surfaceId : '0',
      rx: typeof cur?.rx === 'number' && Number.isFinite(cur.rx) ? clamp01(cur.rx) : (cur ? undefined : fallback.rx),
      ry: typeof cur?.ry === 'number' && Number.isFinite(cur.ry) ? clamp01(cur.ry) : undefined,
      refW: typeof cur?.refW === 'number' && cur.refW > 0 ? cur.refW : undefined,
      refH: typeof cur?.refH === 'number' && cur.refH > 0 ? cur.refH : undefined
    }
  })
  return out
}

export function updateWidgetTokenPose(
  dashboardId: string,
  widgetId: string,
  patch: Partial<WidgetTokenPose>,
  index = 0,
  widget?: Widget,
  canvas?: { w: number; h: number } | null
): void {
  const key = boardTokensKey(dashboardId)
  const raw = usePlaces.getState().places[key]
  const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, Partial<WidgetTokenPose>>) : {}
  const cur = saved[widgetId]
  const fallback = defaultTokenPose(index, widget)
  const x = Math.max(SAFE_PAD, Math.round(patch.x ?? (typeof cur?.x === 'number' ? cur.x : fallback.x)))
  const y = Math.max(SAFE_PAD, Math.round(patch.y ?? (typeof cur?.y === 'number' ? cur.y : fallback.y)))
  const w = Math.max(MIN_SLATE_W, Math.round(patch.w ?? (typeof cur?.w === 'number' ? cur.w : fallback.w)))
  const h = Math.max(MIN_SLATE_H, Math.round(patch.h ?? (typeof cur?.h === 'number' ? cur.h : fallback.h)))
  const expanded = patch.expanded ?? Boolean(cur?.expanded)
  const surfaceId = patch.surfaceId ?? (typeof cur?.surfaceId === 'string' && cur.surfaceId ? cur.surfaceId : fallback.surfaceId)

  const movedX = patch.x !== undefined
  const movedY = patch.y !== undefined
  let rx = movedX
    ? undefined
    : typeof cur?.rx === 'number' && Number.isFinite(cur.rx)
      ? clamp01(cur.rx)
      : cur
        ? undefined
        : fallback.rx
  let ry = movedY ? undefined : typeof cur?.ry === 'number' && Number.isFinite(cur.ry) ? clamp01(cur.ry) : undefined
  let refW = movedX ? undefined : typeof cur?.refW === 'number' && cur.refW > 0 ? cur.refW : undefined
  let refH = movedY ? undefined : typeof cur?.refH === 'number' && cur.refH > 0 ? cur.refH : undefined

  // Only recalculate normalized anchors when x or y was explicitly moved; toggling expand/collapse must preserve the starting anchor.
  const moved = movedX || movedY
  if (moved && canvas && canvas.w > 0 && canvas.h > 0) {
    const boxW = expanded ? Math.min(w, Math.max(MIN_SLATE_W, canvas.w - SAFE_PAD * 2)) : Math.min(SLATE_COLLAPSED_W, Math.max(MIN_SLATE_W, canvas.w - SAFE_PAD * 2))
    const availW = Math.max(1, canvas.w - SAFE_PAD * 2 - boxW)
    const availH = Math.max(1, canvas.h - SAFE_PAD * 2 - SLATE_HEADER_H)
    rx = clamp01((x - SAFE_PAD) / availW)
    ry = clamp01((y - SAFE_PAD) / availH)
    refW = Math.round(canvas.w)
    refH = Math.round(canvas.h)
  }

  const next: WidgetTokenPose = {
    x,
    y,
    w,
    h,
    expanded,
    surfaceId,
    ...(rx !== undefined ? { rx } : {}),
    ...(ry !== undefined ? { ry } : {}),
    ...(refW !== undefined ? { refW } : {}),
    ...(refH !== undefined ? { refH } : {})
  }
  usePlaces.getState().save(key, { ...saved, [widgetId]: next })
}

export async function ensureActiveDashboard(sessionId?: string | null): Promise<Dashboard> {
  let { list, activeId } = useDashboards.getState()
  if (!list.length) {
    await useDashboards.getState().refresh()
    ;({ list, activeId } = useDashboards.getState())
  }
  const resolvedSession = sessionId !== undefined ? sessionId : (focusedConversation()?.sessionId ?? null)
  const savedId = usePlaces.getState().places[sessionBoardKey(resolvedSession)]
  const targetId = typeof savedId === 'string' && list.some((d) => d.id === savedId) ? savedId : activeId
  const found = list.find((d) => d.id === targetId) ?? list[0]
  if (found) return found
  const created = await engine('dashboards.create', { name: 'Tabletop', icon: 'layout-dashboard', onToolbar: true })
  await useDashboards.getState().refresh()
  useDashboards.getState().setActive(created.id)
  usePlaces.getState().save(sessionBoardKey(resolvedSession), created.id)
  return created
}

export function pinToChatTable(kind: string, entryId: string, title?: string, sessionId?: string | null): void {
  const thing = `${kind}/${entryId}`
  void (async () => {
    try {
      const board = await ensureActiveDashboard(sessionId)
      const activeSurfaceId = getBoardSurfaces(board.id).activeId
      const updated = await engine('widgets.place', { dashboardId: board.id, things: [thing], at: null })
      useDashboards.getState().onChanged(updated.id, updated)
      const newest = updated.widgets.at(-1)
      if (newest) {
        updateWidgetTokenPose(updated.id, newest.id, { surfaceId: activeSurfaceId }, updated.widgets.length - 1, newest)
      }
      toast.success(`Put on ${updated.name}`, title ?? entryId, {
        label: 'Open in Chat',
        onSelect: () => takeBoardIntoChat(updated.id, sessionId)
      })
    } catch (err) {
      failed('Could not put on board')(err)
    }
  })()
}
