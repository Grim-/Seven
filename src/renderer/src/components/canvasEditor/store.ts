import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  createInitialMachineState,
  transitionCanvasMachine,
  type CanvasMachineEffect,
  type CanvasMachineEvent,
  type CanvasMachineState
} from './machine'
import type {
  Camera2D,
  CanvasHit,
  CanvasLayerState,
  CanvasPanelLayout,
  CanvasSnapSettings,
  Point2D,
  Rect2D,
  ToolbarLayout
} from './types'

export type CanvasEffectListener = (effect: CanvasMachineEffect) => void

export type CanvasStoreData = CanvasMachineState & {
  editorId: string
  layers: CanvasLayerState[]
  hoverHit: CanvasHit | null
  panelLayout: CanvasPanelLayout
  toolbars: Record<string, ToolbarLayout>
  minZoom: number
  maxZoom: number
}

export type CanvasStoreActions = {
  dispatch: (event: CanvasMachineEvent) => CanvasMachineEffect[]
  subscribeEffects: (listener: CanvasEffectListener) => () => void
  setCamera: (camera: Partial<Camera2D>) => void
  panBy: (dx: number, dy: number) => void
  zoomAt: (factor: number, anchorScreen: Point2D) => void
  fitBounds: (bounds: Rect2D, viewportSize: { w: number; h: number }, padPx?: number) => void
  setLayers: (layers: CanvasLayerState[]) => void
  toggleLayerVisible: (layerId: string) => void
  toggleLayerLocked: (layerId: string) => void
  setLayerOpacity: (layerId: string, opacity: number) => void
  reorderLayers: (orderedIds: readonly string[]) => void
  setHoverHit: (hit: CanvasHit | null) => void
  setSnap: (patch: Partial<CanvasSnapSettings>) => void
  setPanelLayout: (patch: Partial<CanvasPanelLayout>) => void
  setToolbarLayout: (toolbarId: string, patch: Partial<ToolbarLayout>) => void
  enterTool: (toolId: string, stage?: number, stagePayloads?: unknown[]) => CanvasMachineEffect[]
  advanceToolStage: (payload?: unknown, nextStage?: number) => CanvasMachineEffect[]
  stepBackToolStage: () => CanvasMachineEffect[]
  exitTool: () => CanvasMachineEffect[]
  setSelection: (ids: readonly string[]) => void
  toggleSelection: (id: string) => void
}

export type CanvasEditorStoreState = CanvasStoreData & CanvasStoreActions
export type CanvasEditorStore = StoreApi<CanvasEditorStoreState>

export type CreateCanvasStoreOptions = {
  editorId: string
  initialCamera?: Camera2D
  initialLayers?: CanvasLayerState[]
  initialSnap?: Partial<CanvasSnapSettings>
  initialPanelLayout?: Partial<CanvasPanelLayout>
  initialToolbars?: Record<string, ToolbarLayout>
  minZoom?: number
  maxZoom?: number
  dragThresholdPx?: number
}

const DEFAULT_PANEL_LAYOUT: CanvasPanelLayout = {
  leftOpen: true,
  leftWidth: 260,
  rightOpen: true,
  rightWidth: 380
}

const DEFAULT_TOOLBAR_LAYOUT: ToolbarLayout = {
  x: 0,
  y: 12,
  dock: 'top',
  locked: false,
  collapsed: false
}

export function createCanvasStore(options: CreateCanvasStoreOptions): CanvasEditorStore {
  const listeners = new Set<CanvasEffectListener>()
  const minZoom = options.minZoom ?? 0.1
  const maxZoom = options.maxZoom ?? 8

  const initialMachine = createInitialMachineState({
    camera: options.initialCamera ?? { x: 0, y: 0, zoom: 1 },
    snap: {
      grid: options.initialSnap?.grid ?? false,
      gridSize: options.initialSnap?.gridSize ?? 16,
      guides: options.initialSnap?.guides ?? true
    },
    dragThresholdPx: options.dragThresholdPx ?? 4
  })

  return createStore<CanvasEditorStoreState>((set, get) => {
    const dispatch = (event: CanvasMachineEvent): CanvasMachineEffect[] => {
      const curr = get()
      const machineSlice: CanvasMachineState = {
        fsm: curr.fsm,
        camera: curr.camera,
        selection: curr.selection,
        clickCycle: curr.clickCycle,
        rightClickGesture: curr.rightClickGesture,
        snap: curr.snap,
        dragThresholdPx: curr.dragThresholdPx
      }
      const { state: next, effects } = transitionCanvasMachine(machineSlice, event)
      set({
        fsm: next.fsm,
        camera: next.camera,
        selection: next.selection,
        clickCycle: next.clickCycle,
        rightClickGesture: next.rightClickGesture,
        snap: next.snap,
        dragThresholdPx: next.dragThresholdPx
      })
      for (const eff of effects) {
        for (const fn of listeners) fn(eff)
      }
      return effects
    }

    return {
      ...initialMachine,
      editorId: options.editorId,
      layers: options.initialLayers ?? [],
      hoverHit: null,
      panelLayout: { ...DEFAULT_PANEL_LAYOUT, ...options.initialPanelLayout },
      toolbars: { ...options.initialToolbars },
      minZoom,
      maxZoom,

      dispatch,

      subscribeEffects: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },

      setCamera: (patch) =>
        set((s) => ({
          camera: {
            x: patch.x ?? s.camera.x,
            y: patch.y ?? s.camera.y,
            zoom: Math.max(s.minZoom, Math.min(s.maxZoom, patch.zoom ?? s.camera.zoom))
          }
        })),

      panBy: (dx, dy) =>
        set((s) => ({
          camera: { ...s.camera, x: s.camera.x + dx, y: s.camera.y + dy }
        })),

      zoomAt: (factor, anchorScreen) =>
        set((s) => {
          const nextZoom = Math.max(s.minZoom, Math.min(s.maxZoom, s.camera.zoom * factor))
          const ratio = nextZoom / s.camera.zoom
          return {
            camera: {
              zoom: nextZoom,
              x: anchorScreen.x - (anchorScreen.x - s.camera.x) * ratio,
              y: anchorScreen.y - (anchorScreen.y - s.camera.y) * ratio
            }
          }
        }),

      fitBounds: (bounds, viewportSize, padPx = 32) =>
        set((s) => {
          const availW = Math.max(1, viewportSize.w - padPx * 2)
          const availH = Math.max(1, viewportSize.h - padPx * 2)
          const rawZoom = Math.min(availW / Math.max(1, bounds.w), availH / Math.max(1, bounds.h))
          const zoom = Math.max(s.minZoom, Math.min(s.maxZoom, rawZoom))
          const x = (viewportSize.w - bounds.w * zoom) / 2 - bounds.x * zoom
          const y = (viewportSize.h - bounds.h * zoom) / 2 - bounds.y * zoom
          return { camera: { x, y, zoom } }
        }),

      setLayers: (layers) => set({ layers }),

      toggleLayerVisible: (layerId) =>
        set((s) => ({
          layers: s.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
        })),

      toggleLayerLocked: (layerId) =>
        set((s) => ({
          layers: s.layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
        })),

      setLayerOpacity: (layerId, opacity) =>
        set((s) => ({
          layers: s.layers.map((l) =>
            l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
          )
        })),

      reorderLayers: (orderedIds) =>
        set((s) => {
          const byId = new Map(s.layers.map((l) => [l.id, l]))
          const next: CanvasLayerState[] = []
          const total = orderedIds.length
          for (let i = 0; i < total; i++) {
            const found = byId.get(orderedIds[i])
            if (found) next.push({ ...found, order: total - i })
          }
          for (const l of s.layers) {
            if (!orderedIds.includes(l.id)) next.push(l)
          }
          return { layers: next }
        }),

      setHoverHit: (hoverHit) => set({ hoverHit }),

      setSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),

      setPanelLayout: (patch) => set((s) => ({ panelLayout: { ...s.panelLayout, ...patch } })),

      setToolbarLayout: (toolbarId, patch) =>
        set((s) => ({
          toolbars: {
            ...s.toolbars,
            [toolbarId]: {
              ...(s.toolbars[toolbarId] ?? DEFAULT_TOOLBAR_LAYOUT),
              ...patch
            }
          }
        })),

      enterTool: (toolId, stage, stagePayloads) =>
        dispatch({ type: 'enter_tool', toolId, stage, stagePayloads }),

      advanceToolStage: (payload, nextStage) =>
        dispatch({ type: 'advance_tool_stage', payload, nextStage }),

      stepBackToolStage: () => dispatch({ type: 'step_back_tool_stage' }),

      exitTool: () => dispatch({ type: 'exit_tool' }),

      setSelection: (ids) => {
        dispatch({ type: 'set_selection', ids })
      },

      toggleSelection: (id) => {
        dispatch({ type: 'toggle_selection', id })
      }
    }
  })
}

export const CanvasStoreContext = createContext<CanvasEditorStore | null>(null)

export function useCanvasEditorStore(): CanvasEditorStore {
  const store = useContext(CanvasStoreContext)
  if (!store) {
    throw new Error('useCanvasEditorStore must be used inside a CanvasStoreContext.Provider')
  }
  return store
}

export function useCanvasEditor<T>(selector: (state: CanvasEditorStoreState) => T): T {
  const store = useCanvasEditorStore()
  return useStore(store, selector)
}
