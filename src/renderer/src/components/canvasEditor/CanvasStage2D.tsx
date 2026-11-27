import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { useEscapeLayer } from '../../lib/escape'
import { cn } from '../../lib/cn'
import { normalizeRect } from './picker'
import { useCanvasEditor, useCanvasEditorStore } from './store'
import type {
  CanvasHit,
  CanvasPicker,
  CanvasToolDef,
  Point2D,
  Rect2D
} from './types'

function armWindowContextMenuSwallow(): void {
  let done = false
  const swallow = (ev: MouseEvent) => {
    if (done) return
    done = true
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
    window.removeEventListener('contextmenu', swallow, true)
  }
  window.addEventListener('contextmenu', swallow, true)
  window.setTimeout(() => {
    if (done) return
    done = true
    window.removeEventListener('contextmenu', swallow, true)
  }, 400)
}

function isEditableFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

export type CanvasStage2DProps = {
  /** World-space bounds of the canvas content (used for Fit-to-View). */
  contentBounds: Rect2D
  /** Deterministic hit-tester (e.g. wrapping `pickEntities2D` / `pickEntitiesInBox2D`). */
  picker: CanvasPicker
  /** Optional set of entity IDs allowed to drag; omit to allow all picked entities. */
  draggableIds?: ReadonlySet<string>
  /** Registered tool definitions (used for cursor & right-click policy). */
  tools?: readonly CanvasToolDef[]
  /** Called when the FSM opens a context menu in `idle` state. */
  onOpenContextMenu?: (args: {
    menuId: string
    screenPt: Point2D
    worldPt: Point2D
    hits: readonly CanvasHit[]
    selection: readonly string[]
  }) => void
  /** Called during live drag preview (never fire IPC here — visual transform only). */
  onDragPreview?: (targetIds: readonly string[], delta: Point2D) => void
  /** Called once atomically on drop. */
  onCommitDrag?: (targetIds: readonly string[], delta: Point2D) => void
  /** Called if a drag is aborted by right-click, Esc, or pointercancel. */
  onAbortDrag?: (targetIds: readonly string[]) => void
  /** Called during live resize preview. */
  onResizePreview?: (targetId: string, handle: string, startWorld: Point2D, currentWorld: Point2D) => void
  /** Called once atomically on resize drop. */
  onCommitResize?: (targetId: string, handle: string, startWorld: Point2D, currentWorld: Point2D) => void
  /** Called if resize is aborted. */
  onAbortResize?: (targetId: string) => void
  /** Render world-space layers inside the camera transform container. */
  children: ReactNode
  /** Render screen-space overlays above the canvas (toolbars, popovers, HUD). */
  overlay?: ReactNode
  showHud?: boolean
  className?: string
}

/**
 * Reusable 2D Pan/Zoom Stage with a single capture-phase `CanvasInputController`
 * bound to our formal `CanvasInputMachine` FSM.
 */
export function CanvasStage2D({
  contentBounds,
  picker,
  draggableIds,
  tools,
  onOpenContextMenu,
  onDragPreview,
  onCommitDrag,
  onAbortDrag,
  onResizePreview,
  onCommitResize,
  onAbortResize,
  children,
  overlay,
  showHud = true,
  className
}: CanvasStage2DProps) {
  const store = useCanvasEditorStore()
  const camera = useCanvasEditor((s) => s.camera)
  const fsm = useCanvasEditor((s) => s.fsm)
  const selection = useCanvasEditor((s) => s.selection)
  const clickCycle = useCanvasEditor((s) => s.clickCycle)

  const stageRef = useRef<HTMLDivElement>(null)
  const spaceDownRef = useRef(false)
  const [spacePanCursor, setSpacePanCursor] = useState(false)
  const [cursorWorld, setCursorWorld] = useState<Point2D | null>(null)
  const menuCounterRef = useRef(0)

  const callbacksRef = useRef({
    onOpenContextMenu,
    onDragPreview,
    onCommitDrag,
    onAbortDrag,
    onResizePreview,
    onCommitResize,
    onAbortResize
  })
  callbacksRef.current = {
    onOpenContextMenu,
    onDragPreview,
    onCommitDrag,
    onAbortDrag,
    onResizePreview,
    onCommitResize,
    onAbortResize
  }

  // Subscribe to FSM effects once per store instance
  useEffect(() => {
    return store.getState().subscribeEffects((eff) => {
      const cb = callbacksRef.current
      if (eff.type === 'swallow_context_menu') {
        armWindowContextMenuSwallow()
        return
      }
      if (eff.type === 'open_menu') {
        cb.onOpenContextMenu?.({
          menuId: eff.menuId,
          screenPt: eff.screenPt,
          worldPt: eff.worldPt,
          hits: eff.hits,
          selection: eff.selection
        })
        return
      }
      if (eff.type === 'drag_preview') {
        cb.onDragPreview?.(eff.targetIds, eff.delta)
        return
      }
      if (eff.type === 'commit_drag') {
        cb.onCommitDrag?.(eff.targetIds, eff.delta)
        return
      }
      if (eff.type === 'abort_drag') {
        cb.onAbortDrag?.(eff.targetIds)
        return
      }
      if (eff.type === 'resize_preview') {
        cb.onResizePreview?.(eff.targetId, eff.handle, eff.startWorld, eff.currentWorld)
        return
      }
      if (eff.type === 'commit_resize') {
        cb.onCommitResize?.(eff.targetId, eff.handle, eff.startWorld, eff.currentWorld)
        return
      }
      if (eff.type === 'abort_resize') {
        cb.onAbortResize?.(eff.targetId)
      }
    })
  }, [store])

  // Space-bar pan + zoom shortcuts (+/-/0)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableFocused()) return
      if (e.code === 'Space' && !spaceDownRef.current) {
        spaceDownRef.current = true
        setSpacePanCursor(true)
        return
      }
      if (e.key === '0' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = stageRef.current
        if (!el) return
        store.getState().fitBounds(contentBounds, { w: el.clientWidth, h: el.clientHeight })
        return
      }
      if ((e.key === '=' || e.key === '+') && !e.ctrlKey && !e.metaKey) {
        const el = stageRef.current
        if (!el) return
        store.getState().zoomAt(1.2, { x: el.clientWidth / 2, y: el.clientHeight / 2 })
        return
      }
      if (e.key === '-' && !e.ctrlKey && !e.metaKey) {
        const el = stageRef.current
        if (!el) return
        store.getState().zoomAt(1 / 1.2, { x: el.clientWidth / 2, y: el.clientHeight / 2 })
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        setSpacePanCursor(false)
      }
    }
    const onBlur = () => {
      spaceDownRef.current = false
      setSpacePanCursor(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [store, contentBounds])

  // Two-stage Escape integration: active whenever FSM isn't completely idle+empty
  const escapeActive = fsm.kind !== 'idle' || selection.length > 0
  useEscapeLayer(escapeActive, () => {
    store.getState().dispatch({ type: 'escape' })
  })

  const toStageCoords = (clientX: number, clientY: number): { screenPt: Point2D; worldPt: Point2D } => {
    const rect = stageRef.current?.getBoundingClientRect()
    const sx = rect ? clientX - rect.left : clientX
    const sy = rect ? clientY - rect.top : clientY
    const cam = store.getState().camera
    return {
      screenPt: { x: sx, y: sy },
      worldPt: {
        x: (sx - cam.x) / Math.max(0.05, cam.zoom),
        y: (sy - cam.y) / Math.max(0.05, cam.zoom)
      }
    }
  }

  const isOverlayUiTarget = (target: EventTarget | null): boolean => {
    return Boolean((target as HTMLElement | null)?.closest('[data-canvas-ui]'))
  }

  const getActiveToolDef = (): CanvasToolDef | undefined => {
    const cur = store.getState().fsm
    if (cur.kind !== 'tool_active' || !tools) return undefined
    return tools.find((t) => t.id === cur.toolId)
  }

  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isOverlayUiTarget(e.target)) return
    const { screenPt, worldPt } = toStageCoords(e.clientX, e.clientY)
    const st = store.getState()
    const hits = picker.pickAt(screenPt, worldPt, {
      layers: st.layers,
      selectedIds: st.selection,
      zoom: st.camera.zoom
    })
    const activeToolDef = getActiveToolDef()

    if (e.button === 2) {
      e.preventDefault()
    }

    st.dispatch({
      type: 'pointer_down',
      pointerId: e.pointerId,
      button: e.button,
      screenPt,
      worldPt,
      hits,
      draggableIds,
      activeToolAllowsContextMenu: activeToolDef?.allowContextMenu,
      modifiers: {
        ctrlOrMeta: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
        space: spaceDownRef.current
      }
    })

    const nextKind = store.getState().fsm.kind
    if (
      nextKind === 'panning' ||
      nextKind === 'marquee' ||
      nextKind === 'pending_drag' ||
      nextKind === 'dragging' ||
      nextKind === 'resizing'
    ) {
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isOverlayUiTarget(e.target) && store.getState().fsm.kind === 'idle') return
    const { screenPt, worldPt } = toStageCoords(e.clientX, e.clientY)
    setCursorWorld({ x: Math.round(worldPt.x), y: Math.round(worldPt.y) })
    const st = store.getState()
    st.dispatch({
      type: 'pointer_move',
      pointerId: e.pointerId,
      screenPt,
      worldPt,
      modifiers: {
        ctrlOrMeta: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
        space: spaceDownRef.current
      }
    })
    if (st.fsm.kind === 'idle') {
      const hits = picker.pickAt(screenPt, worldPt, {
        layers: st.layers,
        selectedIds: st.selection,
        zoom: st.camera.zoom
      })
      st.setHoverHit(hits[0] ?? null)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = store.getState()
    const { screenPt, worldPt } = toStageCoords(e.clientX, e.clientY)
    let marqueePickedIds: string[] | undefined
    if (st.fsm.kind === 'marquee' && st.fsm.pointerId === e.pointerId) {
      const rect = normalizeRect(st.fsm.startWorld, worldPt)
      if (rect.w >= 2 || rect.h >= 2) {
        marqueePickedIds = picker.pickInBox(rect, {
          layers: st.layers,
          selectedIds: st.selection,
          zoom: st.camera.zoom
        })
      } else {
        marqueePickedIds = []
      }
    }
    st.dispatch({
      type: 'pointer_up',
      pointerId: e.pointerId,
      button: e.button,
      screenPt,
      worldPt,
      marqueePickedIds,
      modifiers: {
        ctrlOrMeta: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
        space: spaceDownRef.current
      }
    })
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    store.getState().dispatch({ type: 'pointer_cancel', pointerId: e.pointerId })
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const handleContextMenuCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isOverlayUiTarget(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    const { screenPt, worldPt } = toStageCoords(e.clientX, e.clientY)
    const st = store.getState()
    const hits = picker.pickAt(screenPt, worldPt, {
      layers: st.layers,
      selectedIds: st.selection,
      zoom: st.camera.zoom
    })
    menuCounterRef.current += 1
    st.dispatch({
      type: 'context_menu',
      screenPt: { x: e.clientX, y: e.clientY },
      worldPt,
      hits,
      menuId: `${st.editorId}-menu-${menuCounterRef.current}`
    })
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isOverlayUiTarget(e.target)) return
    e.preventDefault()
    const { screenPt } = toStageCoords(e.clientX, e.clientY)
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    store.getState().zoomAt(factor, screenPt)
  }

  const activeToolDef = getActiveToolDef()
  const activeStageCursor =
    fsm.kind === 'tool_active'
      ? (activeToolDef?.stages?.[fsm.stage]?.cursor ?? activeToolDef?.cursor ?? 'crosshair')
      : undefined

  const cursorClass =
    fsm.kind === 'panning'
      ? 'cursor-grabbing'
      : spacePanCursor
        ? 'cursor-grab'
        : fsm.kind === 'dragging'
          ? 'cursor-move'
          : undefined

  const marqueeRect =
    fsm.kind === 'marquee' ? normalizeRect(fsm.startWorld, fsm.currentWorld) : null

  return (
    <div
      ref={stageRef}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenuCapture={handleContextMenuCapture}
      onWheel={handleWheel}
      style={activeStageCursor ? { cursor: activeStageCursor } : undefined}
      className={cn(
        'relative h-full w-full overflow-hidden select-none tone-well-40',
        cursorClass,
        className
      )}
    >
      {/* WORLD-SPACE CAMERA TRANSFORM LAYER */}
      <div
        style={{
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
          transformOrigin: '0 0'
        }}
        className="pointer-events-none absolute left-0 top-0 will-change-transform"
      >
        {children}

        {/* LIVE MARQUEE SELECTION RECTANGLE (Z-BAND 1000) */}
        {marqueeRect && (
          <div
            style={{
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.w,
              height: marqueeRect.h,
              zIndex: 1000
            }}
            className="pointer-events-none absolute border border-accent bg-accent/15"
          />
        )}
      </div>

      {/* CLICK-THROUGH Z-STACK CYCLE INDICATOR */}
      {clickCycle && clickCycle.stackIds.length > 1 && (
        <div
          data-canvas-ui
          style={{
            left: clickCycle.screenPt.x + 12,
            top: Math.max(8, clickCycle.screenPt.y - 24)
          }}
          className="pointer-events-none absolute z-30 border border-accent/60 tone-panel-95 px-2 py-0.5 font-data text-[10px] text-accent shadow-panel"
        >
          {clickCycle.index + 1} / {clickCycle.stackIds.length}
        </div>
      )}

      {/* SCREEN-SPACE OVERLAY SLOT (TOOLBARS, POPOVERS, TOOL OVERLAYS) */}
      {overlay}

      {/* COMPACT BOTTOM-RIGHT VIEWPORT HUD */}
      {showHud && (
        <div
          data-canvas-ui
          className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 border border-line/70 tone-panel-95 px-1.5 py-1 font-data text-[10.5px] text-dim shadow-panel"
        >
          {cursorWorld && (
            <span className="border-r border-line/40 pr-2 text-faint">
              {cursorWorld.x}, {cursorWorld.y}
            </span>
          )}
          {selection.length > 0 && (
            <span className="border-r border-line/40 px-1.5 text-accent">
              {selection.length} sel
            </span>
          )}
          <button
            type="button"
            title="Zoom Out (-)"
            onClick={() => {
              const el = stageRef.current
              if (!el) return
              store.getState().zoomAt(1 / 1.2, { x: el.clientWidth / 2, y: el.clientHeight / 2 })
            }}
            className="flex h-5 w-5 items-center justify-center text-dim hover:text-ink cursor-pointer"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-10 text-center text-ink">{Math.round(camera.zoom * 100)}%</span>
          <button
            type="button"
            title="Zoom In (+)"
            onClick={() => {
              const el = stageRef.current
              if (!el) return
              store.getState().zoomAt(1.2, { x: el.clientWidth / 2, y: el.clientHeight / 2 })
            }}
            className="flex h-5 w-5 items-center justify-center text-dim hover:text-ink cursor-pointer"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Fit View (0)"
            onClick={() => {
              const el = stageRef.current
              if (!el) return
              store.getState().fitBounds(contentBounds, { w: el.clientWidth, h: el.clientHeight })
            }}
            className="flex h-5 w-5 items-center justify-center border-l border-line/40 pl-1 text-dim hover:text-ink cursor-pointer"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
