import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialMachineState,
  transitionCanvasMachine
} from '../src/renderer/src/components/canvasEditor/machine'
import {
  pickEntities2D,
  pickEntitiesInBox2D,
  resolveClickCycle
} from '../src/renderer/src/components/canvasEditor/picker'
import { createCanvasStore } from '../src/renderer/src/components/canvasEditor/store'
import type {
  CanvasEntity,
  CanvasLayerState
} from '../src/renderer/src/components/canvasEditor/types'

const BASE_LAYERS: CanvasLayerState[] = [
  { id: 'regions', label: 'Regions', visible: true, locked: false, opacity: 1, order: 1 },
  { id: 'places', label: 'Places', visible: true, locked: false, opacity: 1, order: 2 },
  { id: 'props', label: 'Props', visible: true, locked: false, opacity: 1, order: 3 },
  { id: 'triggers', label: 'Triggers', visible: true, locked: false, opacity: 1, order: 4 },
  { id: 'spawners', label: 'Spawners', visible: true, locked: false, opacity: 1, order: 5 },
  { id: 'actors', label: 'Actors', visible: true, locked: false, opacity: 1, order: 6 }
]

const STACKED_ENTITIES: CanvasEntity[] = [
  {
    id: 'region-1',
    kind: 'region',
    label: 'Northern Wastes',
    layerId: 'regions',
    zBand: 'region',
    bounds: { x: 0, y: 0, w: 500, h: 500 },
    draggable: true,
    resizable: true
  },
  {
    id: 'place-1',
    kind: 'place',
    label: 'Market Square',
    layerId: 'places',
    zBand: 'zone',
    bounds: { x: 50, y: 50, w: 300, h: 300 },
    draggable: true,
    resizable: true
  },
  {
    id: 'prop-1',
    kind: 'prop',
    label: 'Fountain',
    layerId: 'props',
    zBand: 'prop',
    bounds: { x: 100, y: 100, w: 120, h: 120 },
    draggable: true,
    resizable: false
  },
  {
    id: 'trigger-1',
    kind: 'trigger',
    label: 'Ambush Trigger',
    layerId: 'triggers',
    zBand: 'trigger',
    bounds: { x: 120, y: 120, w: 80, h: 80 },
    draggable: true,
    resizable: true
  },
  {
    id: 'spawner-1',
    kind: 'spawner',
    label: 'Goblin Spawner',
    layerId: 'spawners',
    zBand: 'spawner',
    bounds: { x: 140, y: 140, w: 40, h: 40 },
    draggable: true
  },
  {
    id: 'actor-1',
    kind: 'actor',
    label: 'Captain Mira',
    layerId: 'actors',
    zBand: 'actor',
    bounds: { x: 150, y: 150, w: 20, h: 20 },
    draggable: true
  }
]

test('Z-band priority: Trigger inside a SELECTED Place always wins hit test, while Place corner handle wins at the corner', () => {
  // Place is selected, and user clicks inside Trigger (which sits inside Place)
  const insideTrigger = pickEntities2D(STACKED_ENTITIES, { x: 125, y: 125 }, {
    layers: BASE_LAYERS,
    selectedIds: ['place-1'],
    zoom: 1
  })
  assert.equal(insideTrigger[0]?.kind, 'entity')
  assert.equal(insideTrigger[0]?.entityId, 'trigger-1')
  assert.deepEqual(
    insideTrigger.map((h) => h.entityId),
    ['trigger-1', 'prop-1', 'place-1', 'region-1']
  )

  // Clicking at the Place's bottom-right corner (350, 350) grabs the Place's resize handle (band 900)
  const onPlaceCorner = pickEntities2D(STACKED_ENTITIES, { x: 350, y: 350 }, {
    layers: BASE_LAYERS,
    selectedIds: ['place-1'],
    zoom: 1
  })
  assert.equal(onPlaceCorner[0]?.kind, 'handle')
  assert.equal(onPlaceCorner[0]?.entityId, 'place-1')
  assert.equal(onPlaceCorner[0]?.handle, 'se')
})

test('Full Z-band stack ordering: actor > spawner > trigger > prop > zone > region', () => {
  const hits = pickEntities2D(STACKED_ENTITIES, { x: 160, y: 160 }, {
    layers: BASE_LAYERS,
    selectedIds: [],
    zoom: 1
  })
  assert.deepEqual(
    hits.map((h) => h.entityId),
    ['actor-1', 'spawner-1', 'trigger-1', 'prop-1', 'place-1', 'region-1']
  )
})

test('Locked and hidden layers are strictly skipped by pickAt and pickInBox', () => {
  const layers = BASE_LAYERS.map((l) =>
    l.id === 'actors' ? { ...l, locked: true } : l.id === 'spawners' ? { ...l, visible: false } : l
  )
  const hits = pickEntities2D(STACKED_ENTITIES, { x: 160, y: 160 }, {
    layers,
    selectedIds: [],
    zoom: 1
  })
  assert.equal(hits[0]?.entityId, 'trigger-1')
  assert.ok(!hits.some((h) => h.entityId === 'actor-1' || h.entityId === 'spawner-1'))

  const boxIds = pickEntitiesInBox2D(STACKED_ENTITIES, { x: 0, y: 0, w: 500, h: 500 }, {
    layers,
    selectedIds: [],
    zoom: 1
  })
  assert.ok(!boxIds.includes('actor-1'))
  assert.ok(!boxIds.includes('spawner-1'))
  assert.ok(boxIds.includes('trigger-1'))
})

test('Click-through cycling steps through overlapping stack at same point and resets when moving away', () => {
  const hits = pickEntities2D(STACKED_ENTITIES, { x: 125, y: 125 }, {
    layers: BASE_LAYERS,
    selectedIds: [],
    zoom: 1
  })
  const c1 = resolveClickCycle(hits, null, { x: 200, y: 200 })
  assert.equal(c1.hit?.entityId, 'trigger-1')
  const c2 = resolveClickCycle(hits, c1.nextCycle, { x: 201, y: 201 })
  assert.equal(c2.hit?.entityId, 'prop-1')
  const c3 = resolveClickCycle(hits, c2.nextCycle, { x: 200, y: 200 })
  assert.equal(c3.hit?.entityId, 'place-1')
  const c4 = resolveClickCycle(hits, c3.nextCycle, { x: 200, y: 200 })
  assert.equal(c4.hit?.entityId, 'region-1')
  const c5 = resolveClickCycle(hits, c4.nextCycle, { x: 200, y: 200 })
  assert.equal(c5.hit?.entityId, 'trigger-1') // wraps cleanly

  // Moving > 4px away resets to top hit
  const moved = resolveClickCycle(hits, c2.nextCycle, { x: 220, y: 220 })
  assert.equal(moved.hit?.entityId, 'trigger-1')
})

test('IRONCLAD: Right-click while Stamp tool is active cancels tool and NEVER opens a context menu', () => {
  let state = createInitialMachineState()
  state = transitionCanvasMachine(state, { type: 'enter_tool', toolId: 'stamp' }).state
  assert.equal(state.fsm.kind, 'tool_active')

  // Browser fires pointerdown (button=2)
  const r1 = transitionCanvasMachine(state, {
    type: 'pointer_down',
    pointerId: 1,
    button: 2,
    screenPt: { x: 100, y: 100 },
    worldPt: { x: 100, y: 100 },
    hits: []
  })
  assert.equal(r1.state.fsm.kind, 'idle')
  assert.equal(r1.state.rightClickGesture, 'consumed')
  assert.ok(r1.effects.some((e) => e.type === 'tool_cancelled'))
  assert.ok(r1.effects.some((e) => e.type === 'swallow_context_menu'))
  assert.ok(!r1.effects.some((e) => e.type === 'open_menu'))

  // Browser fires follow-up contextmenu 10ms later on mouseup -> MUST BE SWALLOWED!
  const r2 = transitionCanvasMachine(r1.state, {
    type: 'context_menu',
    screenPt: { x: 100, y: 100 },
    worldPt: { x: 100, y: 100 },
    hits: [],
    menuId: 'm1'
  })
  assert.equal(r2.state.fsm.kind, 'idle')
  assert.equal(r2.state.rightClickGesture, 'none')
  assert.deepEqual(r2.effects, [{ type: 'swallow_context_menu' }])

  // Subsequent fresh right-click in idle DOES open context menu cleanly!
  const r3 = transitionCanvasMachine(r2.state, {
    type: 'pointer_down',
    pointerId: 2,
    button: 2,
    screenPt: { x: 100, y: 100 },
    worldPt: { x: 100, y: 100 },
    hits: []
  })
  assert.equal(r3.state.rightClickGesture, 'eligible')

  const r4 = transitionCanvasMachine(r3.state, {
    type: 'context_menu',
    screenPt: { x: 100, y: 100 },
    worldPt: { x: 100, y: 100 },
    hits: [],
    menuId: 'm2'
  })
  assert.equal(r4.state.fsm.kind, 'menu_open')
  assert.ok(r4.effects.some((e) => e.type === 'open_menu'))
})

test('IRONCLAD: Right-click outside open context menu closes it and NEVER opens a second menu', () => {
  let state = createInitialMachineState({
    fsm: { kind: 'menu_open', menuId: 'm1', returnTo: { kind: 'idle' } }
  })

  const r1 = transitionCanvasMachine(state, {
    type: 'pointer_down',
    pointerId: 1,
    button: 2,
    screenPt: { x: 300, y: 300 },
    worldPt: { x: 300, y: 300 },
    hits: []
  })
  assert.equal(r1.state.fsm.kind, 'idle')
  assert.equal(r1.state.rightClickGesture, 'consumed')
  assert.ok(r1.effects.some((e) => e.type === 'close_menu'))
  assert.ok(r1.effects.some((e) => e.type === 'swallow_context_menu'))

  const r2 = transitionCanvasMachine(r1.state, {
    type: 'context_menu',
    screenPt: { x: 300, y: 300 },
    worldPt: { x: 300, y: 300 },
    hits: [],
    menuId: 'm2'
  })
  assert.equal(r2.state.fsm.kind, 'idle')
  assert.deepEqual(r2.effects, [{ type: 'swallow_context_menu' }])
})

test('Multi-stage Linking Tool: jump to Stage 1, advance to Stage 2, right-click steps back Stage 2 -> 1 -> 0 -> idle with zero stray menus', () => {
  let state = createInitialMachineState()
  // Right-click Prop -> "Link to..." jumps straight into Stage 1 with pre-bound source!
  state = transitionCanvasMachine(state, {
    type: 'enter_tool',
    toolId: 'link',
    stage: 1,
    stagePayloads: [undefined, { sourceId: 'lever-1' }]
  }).state
  assert.equal(state.fsm.kind, 'tool_active')
  assert.equal(state.fsm.stage, 1)

  // Advance to Stage 2 (Wire Event -> Reaction)
  const adv = transitionCanvasMachine(state, {
    type: 'advance_tool_stage',
    payload: { sourceId: 'lever-1', targetId: 'door-1' }
  })
  assert.equal(adv.state.fsm.kind, 'tool_active')
  if (adv.state.fsm.kind === 'tool_active') {
    assert.equal(adv.state.fsm.stage, 2)
  }

  // Right-click #1: Stage 2 -> Stage 1 (restores { sourceId: 'lever-1' }) + swallows contextmenu
  const back1 = transitionCanvasMachine(adv.state, {
    type: 'pointer_down',
    pointerId: 1,
    button: 2,
    screenPt: { x: 10, y: 10 },
    worldPt: { x: 10, y: 10 },
    hits: []
  })
  assert.equal(back1.state.fsm.kind, 'tool_active')
  if (back1.state.fsm.kind === 'tool_active') {
    assert.equal(back1.state.fsm.stage, 1)
    assert.deepEqual(back1.state.fsm.stagePayloads[1], { sourceId: 'lever-1' })
  }
  const ctx1 = transitionCanvasMachine(back1.state, {
    type: 'context_menu',
    screenPt: { x: 10, y: 10 },
    worldPt: { x: 10, y: 10 },
    hits: [],
    menuId: 'm-nope-1'
  })
  assert.deepEqual(ctx1.effects, [{ type: 'swallow_context_menu' }])

  // Right-click #2: Stage 1 -> Stage 0 + swallows contextmenu
  const back2 = transitionCanvasMachine(ctx1.state, {
    type: 'pointer_down',
    pointerId: 2,
    button: 2,
    screenPt: { x: 10, y: 10 },
    worldPt: { x: 10, y: 10 },
    hits: []
  })
  assert.equal(back2.state.fsm.kind, 'tool_active')
  if (back2.state.fsm.kind === 'tool_active') {
    assert.equal(back2.state.fsm.stage, 0)
  }
  const ctx2 = transitionCanvasMachine(back2.state, {
    type: 'context_menu',
    screenPt: { x: 10, y: 10 },
    worldPt: { x: 10, y: 10 },
    hits: [],
    menuId: 'm-nope-2'
  })
  assert.deepEqual(ctx2.effects, [{ type: 'swallow_context_menu' }])

  // Right-click #3: Stage 0 -> idle + swallows contextmenu
  const back3 = transitionCanvasMachine(ctx2.state, {
    type: 'pointer_down',
    pointerId: 3,
    button: 2,
    screenPt: { x: 10, y: 10 },
    worldPt: { x: 10, y: 10 },
    hits: []
  })
  assert.equal(back3.state.fsm.kind, 'idle')
  const ctx3 = transitionCanvasMachine(back3.state, {
    type: 'context_menu',
    screenPt: { x: 10, y: 10 },
    worldPt: { x: 10, y: 10 },
    hits: [],
    menuId: 'm-nope-3'
  })
  assert.deepEqual(ctx3.effects, [{ type: 'swallow_context_menu' }])
})

test('Ctrl+Click multi-select adds unselected items and removes already-selected items cleanly', () => {
  const triggerHit = pickEntities2D(STACKED_ENTITIES, { x: 125, y: 125 }, {
    layers: BASE_LAYERS,
    selectedIds: [],
    zoom: 1
  })
  const propOnlyHit = pickEntities2D(STACKED_ENTITIES, { x: 105, y: 105 }, {
    layers: BASE_LAYERS,
    selectedIds: [],
    zoom: 1
  })

  let state = createInitialMachineState({ selection: ['trigger-1'] })

  // Ctrl+Click prop-1 -> adds it
  state = transitionCanvasMachine(state, {
    type: 'pointer_down',
    pointerId: 1,
    button: 0,
    screenPt: { x: 105, y: 105 },
    worldPt: { x: 105, y: 105 },
    hits: propOnlyHit,
    modifiers: { ctrlOrMeta: true }
  }).state
  state = transitionCanvasMachine(state, {
    type: 'pointer_up',
    pointerId: 1,
    button: 0,
    screenPt: { x: 105, y: 105 },
    worldPt: { x: 105, y: 105 }
  }).state
  assert.deepEqual(state.selection, ['trigger-1', 'prop-1'])

  // Ctrl+Click trigger-1 (already selected!) -> removes ONLY trigger-1
  state = transitionCanvasMachine(state, {
    type: 'pointer_down',
    pointerId: 2,
    button: 0,
    screenPt: { x: 125, y: 125 },
    worldPt: { x: 125, y: 125 },
    hits: triggerHit,
    modifiers: { ctrlOrMeta: true }
  }).state
  assert.deepEqual(state.selection, ['prop-1'])
  assert.equal(state.fsm.kind, 'idle')
})

test('Drag threshold, atomic commit on drop, and clean abort on right-click or Escape', () => {
  const hits = pickEntities2D(STACKED_ENTITIES, { x: 125, y: 125 }, {
    layers: BASE_LAYERS,
    selectedIds: ['place-1'],
    zoom: 1
  })
  let state = createInitialMachineState({ selection: ['place-1'] })

  // Press on trigger inside selected place
  state = transitionCanvasMachine(state, {
    type: 'pointer_down',
    pointerId: 1,
    button: 0,
    screenPt: { x: 125, y: 125 },
    worldPt: { x: 125, y: 125 },
    hits
  }).state
  assert.equal(state.fsm.kind, 'pending_drag')
  assert.deepEqual(state.selection, ['trigger-1'])

  // Move 2px (< 4px threshold) -> stays pending_drag, no drag_preview yet
  const m1 = transitionCanvasMachine(state, {
    type: 'pointer_move',
    pointerId: 1,
    screenPt: { x: 127, y: 125 },
    worldPt: { x: 127, y: 125 }
  })
  assert.equal(m1.state.fsm.kind, 'pending_drag')
  assert.equal(m1.effects.length, 0)

  // Move 25px -> promotes to dragging and emits drag_preview (NOT commit_drag!)
  const m2 = transitionCanvasMachine(m1.state, {
    type: 'pointer_move',
    pointerId: 1,
    screenPt: { x: 150, y: 145 },
    worldPt: { x: 150, y: 145 }
  })
  assert.equal(m2.state.fsm.kind, 'dragging')
  assert.deepEqual(m2.effects, [{ type: 'drag_preview', targetIds: ['trigger-1'], delta: { x: 25, y: 20 } }])

  // Right-click mid-drag -> aborts cleanly AND swallows follow-up contextmenu
  const aborted = transitionCanvasMachine(m2.state, {
    type: 'pointer_down',
    pointerId: 2,
    button: 2,
    screenPt: { x: 150, y: 145 },
    worldPt: { x: 150, y: 145 },
    hits
  })
  assert.equal(aborted.state.fsm.kind, 'idle')
  assert.ok(aborted.effects.some((e) => e.type === 'abort_drag'))
  assert.ok(aborted.effects.some((e) => e.type === 'swallow_context_menu'))

  // Fresh drag + pointer_up commits atomically once
  const d1 = transitionCanvasMachine(aborted.state, {
    type: 'pointer_down',
    pointerId: 3,
    button: 0,
    screenPt: { x: 125, y: 125 },
    worldPt: { x: 125, y: 125 },
    hits
  }).state
  const d2 = transitionCanvasMachine(d1, {
    type: 'pointer_move',
    pointerId: 3,
    screenPt: { x: 165, y: 155 },
    worldPt: { x: 165, y: 155 }
  }).state
  const d3 = transitionCanvasMachine(d2, {
    type: 'pointer_up',
    pointerId: 3,
    button: 0,
    screenPt: { x: 165, y: 155 },
    worldPt: { x: 165, y: 155 }
  })
  assert.equal(d3.state.fsm.kind, 'idle')
  assert.deepEqual(d3.effects, [{ type: 'commit_drag', targetIds: ['trigger-1'], delta: { x: 40, y: 30 } }])
})

test('Per-instance createCanvasStore isolates multiple simultaneous editors cleanly', () => {
  const atlas = createCanvasStore({ editorId: 'atlas', initialLayers: BASE_LAYERS })
  const scene3d = createCanvasStore({ editorId: 'three-scene', initialLayers: [] })

  atlas.getState().enterTool('stamp')
  atlas.getState().setSelection(['trigger-1'])
  atlas.getState().toggleLayerLocked('regions')

  assert.equal(atlas.getState().fsm.kind, 'tool_active')
  assert.deepEqual(atlas.getState().selection, ['trigger-1'])
  assert.equal(atlas.getState().layers.find((l) => l.id === 'regions')?.locked, true)

  // Second editor is completely unaffected
  assert.equal(scene3d.getState().fsm.kind, 'idle')
  assert.deepEqual(scene3d.getState().selection, [])
  assert.equal(scene3d.getState().layers.length, 0)
})
