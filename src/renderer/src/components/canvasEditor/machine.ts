import { normalizeRect, resolveClickCycle, snapPointToGrid } from './picker'
import type {
  Camera2D,
  CanvasFsmReturnState,
  CanvasFsmState,
  CanvasHit,
  CanvasSnapSettings,
  ClickCycleState,
  Point2D,
  Rect2D,
  ResizeHandle,
  RightClickGestureState
} from './types'

export type CanvasMachineState = {
  fsm: CanvasFsmState
  camera: Camera2D
  selection: string[]
  clickCycle: ClickCycleState | null
  rightClickGesture: RightClickGestureState
  snap: CanvasSnapSettings
  dragThresholdPx: number
}

export type CanvasMachineModifiers = {
  ctrlOrMeta?: boolean
  shift?: boolean
  alt?: boolean
  space?: boolean
}

export type CanvasMachineEvent =
  | {
      type: 'pointer_down'
      pointerId: number
      button: number
      screenPt: Point2D
      worldPt: Point2D
      hits: readonly CanvasHit[]
      draggableIds?: ReadonlySet<string>
      modifiers?: CanvasMachineModifiers
      /** Set true if the active tool explicitly allows native/custom canvas context menu on right-click. */
      activeToolAllowsContextMenu?: boolean
    }
  | {
      type: 'pointer_move'
      pointerId: number
      screenPt: Point2D
      worldPt: Point2D
      modifiers?: CanvasMachineModifiers
    }
  | {
      type: 'pointer_up'
      pointerId: number
      button: number
      screenPt: Point2D
      worldPt: Point2D
      marqueePickedIds?: readonly string[]
      modifiers?: CanvasMachineModifiers
    }
  | {
      type: 'pointer_cancel'
      pointerId: number
    }
  | {
      type: 'context_menu'
      screenPt: Point2D
      worldPt: Point2D
      hits: readonly CanvasHit[]
      menuId: string
    }
  | {
      type: 'escape'
    }
  | {
      type: 'enter_tool'
      toolId: string
      stage?: number
      stagePayloads?: unknown[]
    }
  | {
      type: 'advance_tool_stage'
      payload?: unknown
      nextStage?: number
    }
  | {
      type: 'step_back_tool_stage'
    }
  | {
      type: 'exit_tool'
    }
  | {
      type: 'close_menu'
    }
  | {
      type: 'set_selection'
      ids: readonly string[]
    }
  | {
      type: 'toggle_selection'
      id: string
    }

export type CanvasMachineEffect =
  | { type: 'swallow_context_menu' }
  | { type: 'open_menu'; menuId: string; screenPt: Point2D; worldPt: Point2D; hits: readonly CanvasHit[]; selection: readonly string[] }
  | { type: 'close_menu'; menuId: string }
  | { type: 'drag_preview'; targetIds: readonly string[]; delta: Point2D }
  | { type: 'commit_drag'; targetIds: readonly string[]; delta: Point2D }
  | { type: 'abort_drag'; targetIds: readonly string[] }
  | { type: 'resize_preview'; targetId: string; handle: ResizeHandle; startWorld: Point2D; currentWorld: Point2D }
  | { type: 'commit_resize'; targetId: string; handle: ResizeHandle; startWorld: Point2D; currentWorld: Point2D }
  | { type: 'abort_resize'; targetId: string }
  | { type: 'marquee_preview'; rect: Rect2D }
  | { type: 'tool_pointer_down'; toolId: string; stage: number; payload: unknown; screenPt: Point2D; worldPt: Point2D; hits: readonly CanvasHit[]; modifiers?: CanvasMachineModifiers }
  | { type: 'tool_pointer_move'; toolId: string; stage: number; payload: unknown; screenPt: Point2D; worldPt: Point2D; modifiers?: CanvasMachineModifiers }
  | { type: 'tool_pointer_up'; toolId: string; stage: number; payload: unknown; screenPt: Point2D; worldPt: Point2D; modifiers?: CanvasMachineModifiers }
  | { type: 'tool_stage_changed'; toolId: string; fromStage: number; toStage: number; payload: unknown }
  | { type: 'tool_cancelled'; toolId: string }

export type CanvasMachineResult = {
  state: CanvasMachineState
  effects: CanvasMachineEffect[]
}

export function createInitialMachineState(overrides?: Partial<CanvasMachineState>): CanvasMachineState {
  return {
    fsm: { kind: 'idle' },
    camera: { x: 0, y: 0, zoom: 1 },
    selection: [],
    clickCycle: null,
    rightClickGesture: 'none',
    snap: { grid: false, gridSize: 16, guides: true },
    dragThresholdPx: 4,
    ...overrides
  }
}

function dedupeIds(ids: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

function currentToolPayload(fsm: Extract<CanvasFsmState, { kind: 'tool_active' }>): unknown {
  return fsm.stagePayloads[fsm.stage]
}

function asReturnState(fsm: CanvasFsmState): CanvasFsmReturnState {
  if (fsm.kind === 'tool_active') {
    return {
      kind: 'tool_active',
      toolId: fsm.toolId,
      stage: fsm.stage,
      stagePayloads: fsm.stagePayloads
    }
  }
  return { kind: 'idle' }
}

function rollbackToolOrExit(
  state: CanvasMachineState,
  fsm: Extract<CanvasFsmState, { kind: 'tool_active' }>,
  consumeRightClick: boolean
): CanvasMachineResult {
  const effects: CanvasMachineEffect[] = []
  if (consumeRightClick) effects.push({ type: 'swallow_context_menu' })

  if (fsm.stage > 0) {
    const toStage = fsm.stage - 1
    const nextPayloads = fsm.stagePayloads.slice(0, toStage + 1)
    effects.push({
      type: 'tool_stage_changed',
      toolId: fsm.toolId,
      fromStage: fsm.stage,
      toStage,
      payload: nextPayloads[toStage]
    })
    return {
      state: {
        ...state,
        fsm: {
          kind: 'tool_active',
          toolId: fsm.toolId,
          stage: toStage,
          stagePayloads: nextPayloads
        },
        rightClickGesture: consumeRightClick ? 'consumed' : state.rightClickGesture
      },
      effects
    }
  }

  effects.push({ type: 'tool_cancelled', toolId: fsm.toolId })
  return {
    state: {
      ...state,
      fsm: { kind: 'idle' },
      rightClickGesture: consumeRightClick ? 'consumed' : state.rightClickGesture
    },
    effects
  }
}

function handlePointerDown(
  state: CanvasMachineState,
  ev: Extract<CanvasMachineEvent, { type: 'pointer_down' }>
): CanvasMachineResult {
  const { fsm } = state
  const mods = ev.modifiers ?? {}

  // --- RIGHT MOUSE BUTTON (button === 2): Gesture-Atomic Cancel or Menu Eligibility ---
  if (ev.button === 2) {
    if (fsm.kind === 'dragging') {
      return {
        state: { ...state, fsm: { kind: 'idle' }, rightClickGesture: 'consumed' },
        effects: [
          { type: 'abort_drag', targetIds: fsm.targetIds },
          { type: 'swallow_context_menu' }
        ]
      }
    }
    if (fsm.kind === 'resizing') {
      return {
        state: { ...state, fsm: { kind: 'idle' }, rightClickGesture: 'consumed' },
        effects: [
          { type: 'abort_resize', targetId: fsm.targetId },
          { type: 'swallow_context_menu' }
        ]
      }
    }
    if (fsm.kind === 'marquee' || fsm.kind === 'pending_drag' || fsm.kind === 'panning') {
      const returnTo = fsm.kind === 'panning' ? fsm.returnTo : { kind: 'idle' as const }
      return {
        state: { ...state, fsm: returnTo, rightClickGesture: 'consumed' },
        effects: [{ type: 'swallow_context_menu' }]
      }
    }
    if (fsm.kind === 'menu_open') {
      return {
        state: { ...state, fsm: fsm.returnTo, rightClickGesture: 'consumed' },
        effects: [
          { type: 'close_menu', menuId: fsm.menuId },
          { type: 'swallow_context_menu' }
        ]
      }
    }
    if (fsm.kind === 'tool_active') {
      if (ev.activeToolAllowsContextMenu) {
        return {
          state: { ...state, rightClickGesture: 'eligible' },
          effects: []
        }
      }
      return rollbackToolOrExit(state, fsm, true)
    }
    // In idle state: mark eligible so follow-up `context_menu` opens the menu cleanly.
    return {
      state: { ...state, rightClickGesture: 'eligible' },
      effects: []
    }
  }

  // --- MIDDLE BUTTON (button === 1) OR SPACE+LEFT: Pan ---
  if (ev.button === 1 || (ev.button === 0 && mods.space)) {
    const returnTo = asReturnState(fsm)
    const effects: CanvasMachineEffect[] =
      fsm.kind === 'menu_open' ? [{ type: 'close_menu', menuId: fsm.menuId }] : []
    return {
      state: {
        ...state,
        fsm: {
          kind: 'panning',
          pointerId: ev.pointerId,
          startScreen: ev.screenPt,
          originCamera: state.camera,
          returnTo
        }
      },
      effects
    }
  }

  if (ev.button !== 0) return { state, effects: [] }

  // Left-click while menu is open dismisses menu first
  if (fsm.kind === 'menu_open') {
    return {
      state: { ...state, fsm: fsm.returnTo },
      effects: [{ type: 'close_menu', menuId: fsm.menuId }]
    }
  }

  // Left-click while a non-select tool is active routes straight to the tool
  if (fsm.kind === 'tool_active') {
    return {
      state,
      effects: [
        {
          type: 'tool_pointer_down',
          toolId: fsm.toolId,
          stage: fsm.stage,
          payload: currentToolPayload(fsm),
          screenPt: ev.screenPt,
          worldPt: ev.worldPt,
          hits: ev.hits,
          modifiers: mods
        }
      ]
    }
  }

  if (fsm.kind !== 'idle') return { state, effects: [] }

  const topHit = ev.hits[0] ?? null

  // 1. Resize handle hit (Z-band 900) takes priority over everything
  if (topHit && topHit.kind === 'handle' && topHit.handle) {
    return {
      state: {
        ...state,
        fsm: {
          kind: 'resizing',
          pointerId: ev.pointerId,
          targetId: topHit.entityId,
          handle: topHit.handle,
          startWorld: ev.worldPt,
          currentWorld: ev.worldPt
        }
      },
      effects: []
    }
  }

  // 2. Entity hit
  if (topHit && topHit.kind === 'entity') {
    const isDraggable = !ev.draggableIds || ev.draggableIds.has(topHit.entityId)

    // Ctrl/Cmd+Click: toggle membership (add if absent, REMOVE if already selected!)
    if (mods.ctrlOrMeta) {
      const alreadySelected = state.selection.includes(topHit.entityId)
      const nextSelection = alreadySelected
        ? state.selection.filter((id) => id !== topHit.entityId)
        : dedupeIds([...state.selection, topHit.entityId])
      const nextFsm: CanvasFsmState =
        !alreadySelected && isDraggable
          ? {
              kind: 'pending_drag',
              pointerId: ev.pointerId,
              startScreen: ev.screenPt,
              startWorld: ev.worldPt,
              targetIds: nextSelection,
              originHit: topHit,
              preservedMultiSelect: false
            }
          : { kind: 'idle' }
      return {
        state: {
          ...state,
          selection: nextSelection,
          clickCycle: null,
          fsm: nextFsm
        },
        effects: []
      }
    }

    // Shift+Click: additive selection
    if (mods.shift) {
      const nextSelection = dedupeIds([...state.selection, topHit.entityId])
      return {
        state: {
          ...state,
          selection: nextSelection,
          clickCycle: null,
          fsm: isDraggable
            ? {
                kind: 'pending_drag',
                pointerId: ev.pointerId,
                startScreen: ev.screenPt,
                startWorld: ev.worldPt,
                targetIds: nextSelection,
                originHit: topHit,
                preservedMultiSelect: false
              }
            : { kind: 'idle' }
        },
        effects: []
      }
    }

    // Plain click on an item that is ALREADY part of a multi-selection:
    // Preserve multi-selection so dragging moves the whole group; if released without drag, resolve single click.
    if (state.selection.length > 1 && state.selection.includes(topHit.entityId)) {
      return {
        state: {
          ...state,
          fsm: isDraggable
            ? {
                kind: 'pending_drag',
                pointerId: ev.pointerId,
                startScreen: ev.screenPt,
                startWorld: ev.worldPt,
                targetIds: state.selection,
                originHit: topHit,
                preservedMultiSelect: true
              }
            : { kind: 'idle' }
        },
        effects: []
      }
    }

    // Plain click: resolve z-stack click-through cycling at the same spot
    const { hit: picked, nextCycle } = resolveClickCycle(ev.hits, state.clickCycle, ev.screenPt)
    const chosen = picked ?? topHit
    const chosenDraggable = !ev.draggableIds || ev.draggableIds.has(chosen.entityId)
    return {
      state: {
        ...state,
        selection: [chosen.entityId],
        clickCycle: nextCycle,
        fsm: chosenDraggable
          ? {
              kind: 'pending_drag',
              pointerId: ev.pointerId,
              startScreen: ev.screenPt,
              startWorld: ev.worldPt,
              targetIds: [chosen.entityId],
              originHit: chosen,
              preservedMultiSelect: false
            }
          : { kind: 'idle' }
      },
      effects: []
    }
  }

  // 3. Blank canvas click: start marquee selection
  const additive = Boolean(mods.ctrlOrMeta || mods.shift)
  return {
    state: {
      ...state,
      selection: additive ? state.selection : [],
      clickCycle: null,
      fsm: {
        kind: 'marquee',
        pointerId: ev.pointerId,
        startWorld: ev.worldPt,
        currentWorld: ev.worldPt,
        additive
      }
    },
    effects: []
  }
}

function handlePointerMove(
  state: CanvasMachineState,
  ev: Extract<CanvasMachineEvent, { type: 'pointer_move' }>
): CanvasMachineResult {
  const { fsm } = state
  const mods = ev.modifiers ?? {}

  if (fsm.kind === 'panning') {
    if (ev.pointerId !== fsm.pointerId) return { state, effects: [] }
    return {
      state: {
        ...state,
        camera: {
          ...state.camera,
          x: fsm.originCamera.x + (ev.screenPt.x - fsm.startScreen.x),
          y: fsm.originCamera.y + (ev.screenPt.y - fsm.startScreen.y)
        }
      },
      effects: []
    }
  }

  if (fsm.kind === 'marquee') {
    if (ev.pointerId !== fsm.pointerId) return { state, effects: [] }
    const rect = normalizeRect(fsm.startWorld, ev.worldPt)
    return {
      state: {
        ...state,
        fsm: { ...fsm, currentWorld: ev.worldPt }
      },
      effects: [{ type: 'marquee_preview', rect }]
    }
  }

  if (fsm.kind === 'pending_drag') {
    if (ev.pointerId !== fsm.pointerId) return { state, effects: [] }
    const movedPx = Math.hypot(ev.screenPt.x - fsm.startScreen.x, ev.screenPt.y - fsm.startScreen.y)
    if (movedPx < state.dragThresholdPx) return { state, effects: [] }

    const snapped = snapPointToGrid(ev.worldPt, state.snap.gridSize, state.snap.grid && !mods.alt)
    const delta = { x: snapped.x - fsm.startWorld.x, y: snapped.y - fsm.startWorld.y }
    return {
      state: {
        ...state,
        clickCycle: null,
        fsm: {
          kind: 'dragging',
          pointerId: fsm.pointerId,
          startWorld: fsm.startWorld,
          currentWorld: snapped,
          targetIds: fsm.targetIds
        }
      },
      effects: [{ type: 'drag_preview', targetIds: fsm.targetIds, delta }]
    }
  }

  if (fsm.kind === 'dragging') {
    if (ev.pointerId !== fsm.pointerId) return { state, effects: [] }
    const snapped = snapPointToGrid(ev.worldPt, state.snap.gridSize, state.snap.grid && !mods.alt)
    const delta = { x: snapped.x - fsm.startWorld.x, y: snapped.y - fsm.startWorld.y }
    return {
      state: {
        ...state,
        fsm: { ...fsm, currentWorld: snapped }
      },
      effects: [{ type: 'drag_preview', targetIds: fsm.targetIds, delta }]
    }
  }

  if (fsm.kind === 'resizing') {
    if (ev.pointerId !== fsm.pointerId) return { state, effects: [] }
    const snapped = snapPointToGrid(ev.worldPt, state.snap.gridSize, state.snap.grid && !mods.alt)
    return {
      state: {
        ...state,
        fsm: { ...fsm, currentWorld: snapped }
      },
      effects: [
        {
          type: 'resize_preview',
          targetId: fsm.targetId,
          handle: fsm.handle,
          startWorld: fsm.startWorld,
          currentWorld: snapped
        }
      ]
    }
  }

  if (fsm.kind === 'tool_active') {
    return {
      state,
      effects: [
        {
          type: 'tool_pointer_move',
          toolId: fsm.toolId,
          stage: fsm.stage,
          payload: currentToolPayload(fsm),
          screenPt: ev.screenPt,
          worldPt: ev.worldPt,
          modifiers: mods
        }
      ]
    }
  }

  return { state, effects: [] }
}

function handlePointerUp(
  state: CanvasMachineState,
  ev: Extract<CanvasMachineEvent, { type: 'pointer_up' }>
): CanvasMachineResult {
  const { fsm } = state

  if (fsm.kind === 'panning' && ev.pointerId === fsm.pointerId) {
    return { state: { ...state, fsm: fsm.returnTo }, effects: [] }
  }

  if (fsm.kind === 'marquee' && ev.pointerId === fsm.pointerId) {
    const picked = ev.marqueePickedIds ?? []
    const nextSelection = fsm.additive ? dedupeIds([...state.selection, ...picked]) : dedupeIds(picked)
    return {
      state: {
        ...state,
        selection: nextSelection,
        fsm: { kind: 'idle' }
      },
      effects: []
    }
  }

  if (fsm.kind === 'pending_drag' && ev.pointerId === fsm.pointerId) {
    // User clicked an item in a multi-selection without dragging -> collapse selection to that item
    const nextSelection = fsm.preservedMultiSelect ? [fsm.originHit.entityId] : state.selection
    return {
      state: {
        ...state,
        selection: nextSelection,
        fsm: { kind: 'idle' }
      },
      effects: []
    }
  }

  if (fsm.kind === 'dragging' && ev.pointerId === fsm.pointerId) {
    const delta = { x: fsm.currentWorld.x - fsm.startWorld.x, y: fsm.currentWorld.y - fsm.startWorld.y }
    const moved = delta.x !== 0 || delta.y !== 0
    return {
      state: { ...state, fsm: { kind: 'idle' } },
      effects: moved ? [{ type: 'commit_drag', targetIds: fsm.targetIds, delta }] : []
    }
  }

  if (fsm.kind === 'resizing' && ev.pointerId === fsm.pointerId) {
    return {
      state: { ...state, fsm: { kind: 'idle' } },
      effects: [
        {
          type: 'commit_resize',
          targetId: fsm.targetId,
          handle: fsm.handle,
          startWorld: fsm.startWorld,
          currentWorld: fsm.currentWorld
        }
      ]
    }
  }

  if (fsm.kind === 'tool_active' && ev.button === 0) {
    return {
      state,
      effects: [
        {
          type: 'tool_pointer_up',
          toolId: fsm.toolId,
          stage: fsm.stage,
          payload: currentToolPayload(fsm),
          screenPt: ev.screenPt,
          worldPt: ev.worldPt,
          modifiers: ev.modifiers
        }
      ]
    }
  }

  return { state, effects: [] }
}

function handlePointerCancel(
  state: CanvasMachineState,
  ev: Extract<CanvasMachineEvent, { type: 'pointer_cancel' }>
): CanvasMachineResult {
  const { fsm } = state
  if (fsm.kind === 'dragging' && ev.pointerId === fsm.pointerId) {
    return {
      state: { ...state, fsm: { kind: 'idle' } },
      effects: [{ type: 'abort_drag', targetIds: fsm.targetIds }]
    }
  }
  if (fsm.kind === 'resizing' && ev.pointerId === fsm.pointerId) {
    return {
      state: { ...state, fsm: { kind: 'idle' } },
      effects: [{ type: 'abort_resize', targetId: fsm.targetId }]
    }
  }
  if (fsm.kind === 'panning' && ev.pointerId === fsm.pointerId) {
    return { state: { ...state, fsm: fsm.returnTo }, effects: [] }
  }
  if ((fsm.kind === 'marquee' || fsm.kind === 'pending_drag') && ev.pointerId === fsm.pointerId) {
    return { state: { ...state, fsm: { kind: 'idle' } }, effects: [] }
  }
  return { state, effects: [] }
}

function handleContextMenu(
  state: CanvasMachineState,
  ev: Extract<CanvasMachineEvent, { type: 'context_menu' }>
): CanvasMachineResult {
  // IRONCLAD INVARIANT:
  // If rightClickGesture was already consumed (cancel tool / abort drag / close menu),
  // OR if we are NOT in idle state, NEVER open another context menu!
  if (state.rightClickGesture === 'consumed' || state.fsm.kind !== 'idle') {
    return {
      state: { ...state, rightClickGesture: 'none' },
      effects: [{ type: 'swallow_context_menu' }]
    }
  }

  return {
    state: {
      ...state,
      rightClickGesture: 'none',
      fsm: {
        kind: 'menu_open',
        menuId: ev.menuId,
        returnTo: { kind: 'idle' }
      }
    },
    effects: [
      {
        type: 'open_menu',
        menuId: ev.menuId,
        screenPt: ev.screenPt,
        worldPt: ev.worldPt,
        hits: ev.hits,
        selection: state.selection
      }
    ]
  }
}

function handleEscape(state: CanvasMachineState): CanvasMachineResult {
  const { fsm } = state
  if (fsm.kind === 'dragging') {
    return {
      state: { ...state, fsm: { kind: 'idle' } },
      effects: [{ type: 'abort_drag', targetIds: fsm.targetIds }]
    }
  }
  if (fsm.kind === 'resizing') {
    return {
      state: { ...state, fsm: { kind: 'idle' } },
      effects: [{ type: 'abort_resize', targetId: fsm.targetId }]
    }
  }
  if (fsm.kind === 'marquee' || fsm.kind === 'pending_drag') {
    return { state: { ...state, fsm: { kind: 'idle' } }, effects: [] }
  }
  if (fsm.kind === 'panning') {
    return { state: { ...state, fsm: fsm.returnTo }, effects: [] }
  }
  if (fsm.kind === 'menu_open') {
    return {
      state: { ...state, fsm: fsm.returnTo },
      effects: [{ type: 'close_menu', menuId: fsm.menuId }]
    }
  }
  if (fsm.kind === 'tool_active') {
    return rollbackToolOrExit(state, fsm, false)
  }
  if (state.selection.length > 0) {
    return {
      state: { ...state, selection: [], clickCycle: null },
      effects: []
    }
  }
  return { state, effects: [] }
}

/**
 * Pure, deterministic CanvasEditor FSM transition function.
 * Zero DOM globals, zero React hooks, zero side effects.
 */
export function transitionCanvasMachine(
  state: CanvasMachineState,
  event: CanvasMachineEvent
): CanvasMachineResult {
  if (event.type === 'pointer_down') return handlePointerDown(state, event)
  if (event.type === 'pointer_move') return handlePointerMove(state, event)
  if (event.type === 'pointer_up') return handlePointerUp(state, event)
  if (event.type === 'pointer_cancel') return handlePointerCancel(state, event)
  if (event.type === 'context_menu') return handleContextMenu(state, event)
  if (event.type === 'escape') return handleEscape(state)

  if (event.type === 'enter_tool') {
    if (event.toolId === 'select') {
      const effects: CanvasMachineEffect[] =
        state.fsm.kind === 'tool_active' ? [{ type: 'tool_cancelled', toolId: state.fsm.toolId }] : []
      return {
        state: { ...state, fsm: { kind: 'idle' }, rightClickGesture: 'none' },
        effects
      }
    }
    const stage = Math.max(0, event.stage ?? 0)
    const stagePayloads = event.stagePayloads ? [...event.stagePayloads] : Array.from({ length: stage + 1 }, () => undefined)
    return {
      state: {
        ...state,
        fsm: { kind: 'tool_active', toolId: event.toolId, stage, stagePayloads },
        rightClickGesture: 'none'
      },
      effects: []
    }
  }

  if (event.type === 'advance_tool_stage') {
    if (state.fsm.kind !== 'tool_active') return { state, effects: [] }
    const fromStage = state.fsm.stage
    const toStage = event.nextStage ?? fromStage + 1
    const nextPayloads = state.fsm.stagePayloads.slice(0, toStage)
    while (nextPayloads.length < toStage) nextPayloads.push(undefined)
    nextPayloads.push(event.payload)
    return {
      state: {
        ...state,
        fsm: {
          kind: 'tool_active',
          toolId: state.fsm.toolId,
          stage: toStage,
          stagePayloads: nextPayloads
        }
      },
      effects: [
        {
          type: 'tool_stage_changed',
          toolId: state.fsm.toolId,
          fromStage,
          toStage,
          payload: event.payload
        }
      ]
    }
  }

  if (event.type === 'step_back_tool_stage') {
    if (state.fsm.kind !== 'tool_active') return { state, effects: [] }
    return rollbackToolOrExit(state, state.fsm, false)
  }

  if (event.type === 'exit_tool') {
    if (state.fsm.kind !== 'tool_active') return { state, effects: [] }
    return {
      state: { ...state, fsm: { kind: 'idle' } },
      effects: [{ type: 'tool_cancelled', toolId: state.fsm.toolId }]
    }
  }

  if (event.type === 'close_menu') {
    if (state.fsm.kind !== 'menu_open') return { state, effects: [] }
    return {
      state: { ...state, fsm: state.fsm.returnTo },
      effects: [{ type: 'close_menu', menuId: state.fsm.menuId }]
    }
  }

  if (event.type === 'set_selection') {
    return {
      state: { ...state, selection: dedupeIds(event.ids), clickCycle: null },
      effects: []
    }
  }

  if (event.type === 'toggle_selection') {
    const exists = state.selection.includes(event.id)
    return {
      state: {
        ...state,
        selection: exists ? state.selection.filter((id) => id !== event.id) : [...state.selection, event.id],
        clickCycle: null
      },
      effects: []
    }
  }

  return { state, effects: [] }
}
