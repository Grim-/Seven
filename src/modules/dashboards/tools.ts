import type { Dashboard, Widget, WidgetLayout } from '@shared/types'
import { data } from '../../engine/data/hub'
import { slug } from '../../engine/data/validate'
import { ToolError, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { boardView, widgetLine, writer } from '../../engine/present/places'
import { places } from '../../engine/user/places'
import { resolveThings, thingsFrom } from '../core/things'

const BOARD_KEYS = ['name', 'icon', 'toolbar']
const WIDGET_KEYS = ['title', 'view', 'options', 'x', 'y', 'w', 'h']

interface SurfaceTopSlot {
  id: string
  index: number
  label: string
  gx: number
  gy: number
}

interface BoardSurfacesState {
  activeId: string
  slots: SurfaceTopSlot[]
}

interface WidgetTokenPose {
  x: number
  y: number
  w: number
  h: number
  expanded: boolean
  surfaceId: string
}

const DEFAULT_SLOT: SurfaceTopSlot = { id: '0', index: 0, label: 'Main Surface', gx: 0, gy: 0 }

function getBoardSurfacesState(dashboardId: string): BoardSurfacesState {
  const raw = places.get()[`board.surfaces.${dashboardId}`]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { activeId: '0', slots: [DEFAULT_SLOT] }
  }
  const obj = raw as Partial<BoardSurfacesState>
  const slots: SurfaceTopSlot[] = Array.isArray(obj.slots)
    ? obj.slots.filter((s): s is SurfaceTopSlot => Boolean(s && typeof s === 'object' && typeof s.id === 'string'))
    : []
  if (!slots.some((s) => s.gx === 0 && s.gy === 0)) slots.unshift(DEFAULT_SLOT)
  const activeId = typeof obj.activeId === 'string' && slots.some((s) => s.id === obj.activeId) ? obj.activeId : slots[0].id
  return { activeId, slots }
}

function getActiveBoardForSession(sessionId: string): Dashboard {
  const allPlaces = places.get()
  const list = data.dashboards.list()
  const savedId = allPlaces[`board.session.${sessionId}`] ?? allPlaces['board.session.draft']
  if (typeof savedId === 'string') {
    const match = list.find((d) => d.id === savedId)
    if (match) return match
  }
  return list[0] ?? data.dashboards.home()
}

function assignWidgetsToSurface(dashboard: Dashboard, addedWidgets: Widget[], surfaceId: string, expand = true): void {
  if (!addedWidgets.length) return
  const key = `board.tokens.${dashboard.id}`
  const allPlaces = places.get()
  const raw = allPlaces[key]
  const map: Record<string, Partial<WidgetTokenPose>> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, Partial<WidgetTokenPose>>) } : {}
  addedWidgets.forEach((w) => {
    const idx = dashboard.widgets.findIndex((item) => item.id === w.id)
    const leftSide = idx % 2 === 0
    const row = Math.floor(Math.max(0, idx) / 2)
    const cur = map[w.id]
    map[w.id] = {
      x: typeof cur?.x === 'number' ? cur.x : leftSide ? 24 : 920,
      y: typeof cur?.y === 'number' ? cur.y : 44 + (row % 6) * 76,
      w: typeof cur?.w === 'number' ? cur.w : Math.max(360, Math.min(680, w.layout.w * 88)),
      h: typeof cur?.h === 'number' ? cur.h : Math.max(260, Math.min(540, w.layout.h * 60)),
      expanded: expand ? true : Boolean(cur?.expanded),
      surfaceId
    }
  })
  places.set(key, map)
}

function summary(d: Dashboard): string {
  return `Board "${d.name}"${d.onToolbar ? '' : ' (not on the toolbar)'}: ${d.widgets.length ? `\n${d.widgets.map(widgetLine).join('\n')}` : 'empty.'}`
}

function checkKeys(set: Record<string, unknown>, allowed: string[], what: string): void {
  const bad = Object.keys(set).filter((k) => !allowed.includes(k))
  if (bad.length) throw new ToolError(`${bad.join(', ')} can't be set on a ${what}. You can set: ${allowed.join(', ')}`)
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined)

const board: ToolDef = {
  name: 'board',
  group: 'dashboards',
  needsWorkspace: false,
  description: 'Create, change or delete a board, or change or remove one of its widgets. A board that does not exist is created. Things go on boards with add_to_board.',
  params: {
    type: 'object',
    properties: {
      board: { type: 'string' },
      widget: { type: ['string', 'null'], description: 'A widget id or title, or null for the board itself' },
      set: {
        oneOf: [
          { type: 'null' },
          { type: 'object', properties: {}, additionalProperties: { oneOf: [{ type: ['string', 'number', 'boolean', 'null'] }, { type: 'object', properties: {}, additionalProperties: { oneOf: [{ type: ['string', 'number', 'boolean', 'null'] }, { type: 'array', items: { type: 'string' } }, { type: 'object', properties: {}, additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } }] } }] } }
        ],
        description: 'Board: name, icon (Lucide), toolbar. Widget: title, view, options, x, y, w, h (12-column grid).'
      },
      remove: { type: ['boolean', 'null'] }
    }
  },
  async execute(params, ctx) {
    const ref = str(params, 'board')
    const widget = text(params.widget)
    const set = params.set && typeof params.set === 'object' && !Array.isArray(params.set) ? (params.set as Record<string, unknown>) : {}
    const remove = params.remove === true
    const existing = data.dashboards.list().find((d) => d.id === ref || d.name.toLowerCase() === ref.toLowerCase())

    if (!existing) {
      if (remove || widget) throw new ToolError(`There is no board "${ref}". Set board to one of: ${data.dashboards.list().map((d) => d.name).join(', ') || 'none yet'}. To make a new board, call board with widget null and remove null.`)
      checkKeys(set, BOARD_KEYS, 'board')
      const d = data.dashboards.create({ name: text(set.name) ?? ref, icon: text(set.icon), onToolbar: set.toolbar !== false }, writer(ctx))
      return `Created. ${summary(d)}`
    }

    if (!widget) {
      if (remove) {
        data.dashboards.delete(existing.id, writer(ctx))
        return `Deleted board "${existing.name}". What it showed is kept.`
      }
      checkKeys(set, BOARD_KEYS, 'board')
      if (!Object.keys(set).length) return summary(existing)
      const d = data.dashboards.update(existing.id, { name: text(set.name), icon: text(set.icon), onToolbar: typeof set.toolbar === 'boolean' ? set.toolbar : null }, writer(ctx))
      return `Updated. ${summary(d)}`
    }

    if (remove) {
      const d = data.dashboards.removeWidget(existing.id, widget, writer(ctx))
      return `Removed. ${summary(d)}`
    }
    checkKeys(set, WIDGET_KEYS, 'widget')
    let d = existing
    let id = widget
    if (set.title !== undefined || set.view !== undefined || set.options !== undefined) {
      const r = data.dashboards.updateWidget(d.id, id, { title: text(set.title), view: text(set.view), options: set.options ?? null }, writer(ctx))
      d = r.dashboard
      id = r.widget.id
    }
    const layout: Partial<WidgetLayout> = {}
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      const v = num(set[k])
      if (v !== undefined) layout[k] = v
    }
    if (Object.keys(layout).length) d = data.dashboards.moveWidget(d.id, id, layout, writer(ctx)).dashboard
    const w = d.widgets.find((x) => x.id === id || x.title.toLowerCase() === id.toLowerCase())
    if (!w) return summary(d)
    return { text: `On board "${d.name}": ${widgetLine(w)}`, view: boardView(d, w) }
  }
}

const addToBoard: ToolDef = {
  name: 'add_to_board',
  group: 'dashboards',
  needsWorkspace: false,
  description:
    'Put things on a board, each as a widget. Omit board (or pass "current") to place them on the currently open tabletop and active SurfaceTop. A board name that does not exist is created.',
  params: {
    type: 'object',
    properties: {
      board: {
        type: ['string', 'null'],
        description: 'The board name, or null/"current" for the currently open tabletop board'
      },
      things: { type: 'array', items: { type: 'string' }, description: 'Links like @page:recipes/pancakes, @sheet:vesper, or file paths' }
    }
  },
  async execute(params, ctx) {
    const rawRef = text(params.board)
    const things = thingsFrom(params.things, ctx)
    if (!things.length) throw new ToolError('Give things: links like @page:recipes/pancakes, or file paths.')
    const { sources, notes } = resolveThings(things, true, { agentId: ctx.agentId })
    const useCurrent = !rawRef || rawRef.toLowerCase() === 'current' || rawRef.toLowerCase() === 'active'
    const target = useCurrent
      ? getActiveBoardForSession(ctx.sessionId)
      : (data.dashboards.list().find((d) => d.id === rawRef || d.name.toLowerCase() === rawRef.toLowerCase()) ??
        data.dashboards.create({ name: rawRef, icon: null, onToolbar: true }, writer(ctx)))
    const activeSurfaceId = getBoardSurfacesState(target.id).activeId
    const before = new Set(target.widgets.map((w) => w.id))
    const d = data.placeSources(target.id, sources, null, writer(ctx))
    const added = d.widgets.filter((w) => !before.has(w.id))
    assignWidgetsToSurface(d, added, activeSurfaceId, true)
    data.dashboards.notify(d.id)
    return {
      text: `On board "${d.name}" (SurfaceTop ${activeSurfaceId}):\n${added.map(widgetLine).join('\n')}${notes.length ? `\n${notes.join('\n')}` : ''}`,
      view: added.length === 1 ? boardView(d, added[0]) : undefined
    }
  }
}

function describeOpenTabletop(ctx: ToolContext): string {
  const allPlaces = places.get()
  const modeRaw = (allPlaces['view.chat.tabletop.mode'] ?? {}) as Record<string, unknown>
  const windowed = Boolean(modeRaw.windowed)
  const layoutMode =
    modeRaw.layoutMode === 'grid' ? 'grid' : modeRaw.layoutMode === 'creator' ? 'creator' : 'tabletop'
  const creatorSheetId = typeof modeRaw.creatorSheetId === 'string' ? modeRaw.creatorSheetId : null
  const board = getActiveBoardForSession(ctx.sessionId)
  const surfaces = getBoardSurfacesState(board.id)
  const activeSlot = surfaces.slots.find((s) => s.id === surfaces.activeId) ?? surfaces.slots[0] ?? DEFAULT_SLOT
  const tokensRaw = (allPlaces[`board.tokens.${board.id}`] ?? {}) as Record<string, Partial<WidgetTokenPose>>
  const validSurfaceIds = new Set(surfaces.slots.map((s) => s.id))

  const onActive: Widget[] = []
  const onOther = new Map<string, Widget[]>()
  for (const w of board.widgets) {
    const sid = tokensRaw[w.id]?.surfaceId
    const resolvedSid = typeof sid === 'string' && validSurfaceIds.has(sid) ? sid : '0'
    if (resolvedSid === activeSlot.id) onActive.push(w)
    else onOther.set(resolvedSid, [...(onOther.get(resolvedSid) ?? []), w])
  }

  const viewLabel = !windowed
    ? 'default chat (tabletop closed)'
    : layoutMode === 'creator'
      ? `creator (Character Creator dual-panel${creatorSheetId ? ` · sheet: @sheet:${creatorSheetId}` : ''})`
      : layoutMode
  const surfaceLines = surfaces.slots.map((s) => {
    const count = s.id === activeSlot.id ? onActive.length : (onOther.get(s.id)?.length ?? 0)
    return `${s.index}: "${s.label}" (${count} slate${count === 1 ? '' : 's'})${s.id === activeSlot.id ? ' [ACTIVE]' : ''}`
  })

  return [
    `Chat view mode: ${viewLabel}`,
    `Open Tabletop board: "${board.name}" (id: ${board.id})`,
    `Active SurfaceTop: ${activeSlot.index}: "${activeSlot.label}"`,
    `All SurfaceTops on "${board.name}": ${surfaceLines.join(', ')}`,
    `Slates on active SurfaceTop (${activeSlot.index}: "${activeSlot.label}"): ${
      onActive.length ? `\n${onActive.map(widgetLine).join('\n')}` : 'none.'
    }`
  ].join('\n')
}

const tabletop: ToolDef = {
  name: 'tabletop',
  group: 'dashboards',
  needsWorkspace: false,
  description:
    'Check which tabletop board, SurfaceTop, and layout mode (tabletop, grid, creator, or default) is currently open in chat, or switch the open tabletop, SurfaceTop, Character Creator sheet, or place things onto the active SurfaceTop. Call with all parameters null to inspect the current state.',
  params: {
    type: 'object',
    properties: {
      mode: {
        type: ['string', 'null'],
        enum: ['tabletop', 'grid', 'creator', 'default', null],
        description:
          'Optional view mode to switch to: "tabletop" (freeform slates), "grid" (resizable grid), "creator" (dual-panel Character Creator with sheet on the left and chat on the right), or "default" (standard chat).'
      },
      board: {
        type: ['string', 'null'],
        description: 'Optional board name or id to switch to (creates the board if it does not exist).'
      },
      surface: {
        type: ['string', 'null'],
        description:
          'Optional SurfaceTop index (e.g. "0", "1") or name to switch to on the active board. If no SurfaceTop matches, a new SurfaceTop with that name is created and made active.'
      },
      sheet: {
        type: ['string', 'null'],
        description:
          'Optional character sheet id or name (e.g. "vesper" or "@sheet:vesper") to open in the left panel when using "creator" (Character Creator) mode.'
      },
      things: {
        type: ['array', 'null'],
        items: { type: 'string' },
        description: 'Optional links (like @sheet:vesper, @cards.card:fireball) or file paths to place onto the active SurfaceTop.'
      }
    }
  },
  async execute(params, ctx) {
    const modeArg = text(params.mode)?.toLowerCase() ?? null
    const boardArg = text(params.board)
    const surfaceArg = text(params.surface)
    const sheetArg = text(params.sheet)
    const rawThings = Array.isArray(params.things) ? thingsFrom(params.things, ctx) : []

    let targetBoard = getActiveBoardForSession(ctx.sessionId)
    let mutated = false

    if (boardArg && boardArg.toLowerCase() !== 'current' && boardArg.toLowerCase() !== 'active') {
      targetBoard =
        data.dashboards.list().find((d) => d.id === boardArg || d.name.toLowerCase() === boardArg.toLowerCase()) ??
        data.dashboards.create({ name: boardArg, icon: null, onToolbar: true }, writer(ctx))
      places.set(`board.session.${ctx.sessionId}`, targetBoard.id)
      mutated = true
    }

    if (surfaceArg) {
      const surfaces = getBoardSurfacesState(targetBoard.id)
      const matched =
        surfaces.slots.find((s) => s.id === surfaceArg || String(s.index) === surfaceArg) ??
        surfaces.slots.find((s) => s.label.toLowerCase() === surfaceArg.toLowerCase())
      if (matched) {
        places.set(`board.surfaces.${targetBoard.id}`, { ...surfaces, activeId: matched.id })
      } else {
        const occupied = new Set(surfaces.slots.map((s) => `${s.gx},${s.gy}`))
        const dirs = [
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 }
        ]
        let chosen = { gx: surfaces.slots.length, gy: 0 }
        outer: for (const s of surfaces.slots) {
          for (const d of dirs) {
            const key = `${s.gx + d.dx},${s.gy + d.dy}`
            if (!occupied.has(key)) {
              chosen = { gx: s.gx + d.dx, gy: s.gy + d.dy }
              break outer
            }
          }
        }
        const usedIndices = new Set(surfaces.slots.map((s) => s.index))
        let nextIndex = 1
        while (usedIndices.has(nextIndex)) nextIndex++
        const newSlot: SurfaceTopSlot = {
          id: String(nextIndex),
          index: nextIndex,
          label: surfaceArg,
          gx: chosen.gx,
          gy: chosen.gy
        }
        places.set(`board.surfaces.${targetBoard.id}`, {
          activeId: newSlot.id,
          slots: [...surfaces.slots, newSlot]
        })
      }
      mutated = true
    }

    const allPlaces = places.get()
    const curMode = (allPlaces['view.chat.tabletop.mode'] ?? {}) as Record<string, unknown>
    const nextMode: Record<string, unknown> = {
      windowed: Boolean(curMode.windowed),
      layoutMode: curMode.layoutMode === 'grid' ? 'grid' : curMode.layoutMode === 'creator' ? 'creator' : 'tabletop',
      editingGrid: Boolean(curMode.editingGrid),
      showPlayTable: Boolean(curMode.showPlayTable),
      peekTable: Boolean(curMode.peekTable),
      pinnedChat: Boolean(curMode.pinnedChat),
      creatorSheetId: typeof curMode.creatorSheetId === 'string' ? curMode.creatorSheetId : null
    }

    if (sheetArg) {
      const cleaned = sheetArg
        .replace(/^@sheet:/i, '')
        .replace(/^sheet\//i, '')
        .trim()
      const resolvedSheetId = slug(cleaned) || cleaned
      nextMode.creatorSheetId = resolvedSheetId
      if (!modeArg) {
        nextMode.windowed = true
        nextMode.layoutMode = 'creator'
      }
      mutated = true
    }

    if (modeArg) {
      if (modeArg === 'default') {
        nextMode.windowed = false
        nextMode.peekTable = false
      } else if (modeArg === 'tabletop' || modeArg === 'grid' || modeArg === 'creator') {
        nextMode.windowed = true
        nextMode.layoutMode = modeArg
        nextMode.peekTable = false
      } else {
        throw new ToolError('mode must be one of: "tabletop", "grid", "creator", "default", or null.')
      }
      mutated = true
    }

    if (mutated) {
      places.set('view.chat.tabletop.mode', nextMode)
    }

    let placedNotes: string[] = []
    if (rawThings.length > 0) {
      const { sources, notes } = resolveThings(rawThings, true, { agentId: ctx.agentId })
      placedNotes = notes
      const activeSurfaceId = getBoardSurfacesState(targetBoard.id).activeId
      const before = new Set(targetBoard.widgets.map((w) => w.id))
      targetBoard = data.placeSources(targetBoard.id, sources, null, writer(ctx))
      const added = targetBoard.widgets.filter((w) => !before.has(w.id))
      assignWidgetsToSurface(targetBoard, added, activeSurfaceId, true)
      mutated = true
    }

    if (mutated) {
      data.dashboards.notify(targetBoard.id)
    }

    const status = describeOpenTabletop(ctx)
    return placedNotes.length ? `${status}\n${placedNotes.join('\n')}` : status
  }
}

export const DASHBOARD_TOOLS: ToolDef[] = [board, addToBoard, tabletop]
