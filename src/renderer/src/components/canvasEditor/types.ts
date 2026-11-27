import type { ReactNode } from 'react'

export type Point2D = {
  x: number
  y: number
}

export type Rect2D = {
  x: number
  y: number
  w: number
  h: number
}

export type Camera2D = {
  x: number
  y: number
  zoom: number
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * Deterministic numeric Z-band table shared by hit testing and visual layering.
 * Selected zone bodies stay in `zone` (200); only their corner/edge handles sit in `handle` (900).
 * This guarantees props, triggers, spawners, and actors inside a selected zone are always grabbable.
 */
export const CANVAS_Z_BANDS = {
  background: 0,
  region: 100,
  zone: 200,
  prop: 300,
  trigger: 400,
  spawner: 500,
  actor: 600,
  handle: 900,
  tool_overlay: 1000
} as const

export type CanvasZBand = keyof typeof CANVAS_Z_BANDS

export function zBandRank(band: CanvasZBand): number {
  return CANVAS_Z_BANDS[band]
}

export type CanvasLayerState = {
  id: string
  label: string
  visible: boolean
  locked: boolean
  opacity: number
  order: number
  group?: string
  color?: string
}

export type CanvasEntity<TMeta = unknown> = {
  id: string
  kind: string
  label: string
  layerId: string
  zBand: CanvasZBand
  /** Secondary tie-breaker within the same band & layer (higher = closer to viewer). */
  zOrder?: number
  bounds?: Rect2D
  polygon?: Point2D[]
  selectable?: boolean
  draggable?: boolean
  resizable?: boolean
  meta?: TMeta
}

export type CanvasHit = {
  kind: 'entity' | 'handle'
  entityId: string
  entityKind: string
  label: string
  layerId: string
  zBand: CanvasZBand
  zRank: number
  layerOrder: number
  zOrder: number
  handle?: ResizeHandle
  /** Optional ray distance for 3D Three.js raycast tie-breaking (smaller = closer). */
  distance?: number
}

export type PickOptions = {
  layers: readonly CanvasLayerState[]
  selectedIds: readonly string[]
  zoom: number
  handleRadiusPx?: number
  zBandFilter?: ReadonlySet<CanvasZBand>
}

export type CanvasPicker = {
  pickAt: (screenPt: Point2D, worldPt: Point2D, opts: PickOptions) => CanvasHit[]
  pickInBox: (worldRect: Rect2D, opts: PickOptions) => string[]
}

export type CanvasViewportAdapter = {
  screenToWorld: (screenPt: Point2D) => Point2D
  worldToScreen: (worldPt: Point2D) => Point2D
}

export type ClickCycleState = {
  screenPt: Point2D
  stackIds: string[]
  index: number
}

export type RightClickGestureState = 'none' | 'eligible' | 'consumed'

export type CanvasFsmReturnState =
  | { kind: 'idle' }
  | { kind: 'tool_active'; toolId: string; stage: number; stagePayloads: unknown[] }

export type CanvasFsmState =
  | { kind: 'idle' }
  | {
      kind: 'panning'
      pointerId: number
      startScreen: Point2D
      originCamera: Camera2D
      returnTo: CanvasFsmReturnState
    }
  | {
      kind: 'marquee'
      pointerId: number
      startWorld: Point2D
      currentWorld: Point2D
      additive: boolean
    }
  | {
      kind: 'pending_drag'
      pointerId: number
      startScreen: Point2D
      startWorld: Point2D
      targetIds: string[]
      originHit: CanvasHit
      preservedMultiSelect: boolean
    }
  | {
      kind: 'dragging'
      pointerId: number
      startWorld: Point2D
      currentWorld: Point2D
      targetIds: string[]
    }
  | {
      kind: 'resizing'
      pointerId: number
      targetId: string
      handle: ResizeHandle
      startWorld: Point2D
      currentWorld: Point2D
    }
  | {
      kind: 'tool_active'
      toolId: string
      stage: number
      /** Stack of per-stage payloads so right-click / Esc rollback restores prior stage context. */
      stagePayloads: unknown[]
    }
  | {
      kind: 'menu_open'
      menuId: string
      returnTo: CanvasFsmReturnState
    }

export type CanvasToolStage = {
  id: string
  label: string
  hint?: string
  cursor?: string
}

export type CanvasToolDef = {
  id: string
  label: string
  group?: string
  shortcut?: string
  cursor?: string
  icon?: ReactNode
  stages?: readonly CanvasToolStage[]
  /** Default false: tools swallow right-click to step back / cancel rather than opening a menu. */
  allowContextMenu?: boolean
}

export type CanvasCommandDef = {
  id: string
  label: string
  shortcut?: string
  when?: () => boolean
  run: () => void
}

export type CanvasHistory = {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export type CanvasSnapSettings = {
  grid: boolean
  gridSize: number
  guides: boolean
}

export type ToolbarDock = 'top' | 'bottom' | 'free'

export type ToolbarLayout = {
  x: number
  y: number
  dock: ToolbarDock
  locked: boolean
  collapsed: boolean
}

export type CanvasPanelLayout = {
  leftOpen: boolean
  leftWidth: number
  rightOpen: boolean
  rightWidth: number
}
