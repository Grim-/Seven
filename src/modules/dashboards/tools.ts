import type { Dashboard, WidgetLayout } from '@shared/types'
import { data } from '../../engine/data/hub'
import { ToolError, str, type ToolDef } from '../../engine/tools/types'
import { boardView, widgetLine, writer } from '../../engine/present/places'
import { resolveThings, thingsFrom } from '../core/things'

const BOARD_KEYS = ['name', 'icon', 'toolbar']
const WIDGET_KEYS = ['title', 'view', 'options', 'x', 'y', 'w', 'h']

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
  description: 'Put things on a board, each as a widget. A board that does not exist is made.',
  params: {
    type: 'object',
    properties: {
      board: { type: 'string', description: 'The board name' },
      things: { type: 'array', items: { type: 'string' }, description: 'Links like @page:recipes/pancakes, or file paths' }
    }
  },
  async execute(params, ctx) {
    const ref = str(params, 'board').trim()
    if (!ref) throw new ToolError('Give board: the board name.')
    const things = thingsFrom(params.things, ctx)
    if (!things.length) throw new ToolError('Give things: links like @page:recipes/pancakes, or file paths.')
    const { sources, notes } = resolveThings(things, true, { agentId: ctx.agentId })
    const target = data.dashboards.list().find((d) => d.id === ref || d.name.toLowerCase() === ref.toLowerCase()) ?? data.dashboards.create({ name: ref, icon: null, onToolbar: true }, writer(ctx))
    const before = new Set(target.widgets.map((w) => w.id))
    const d = data.placeSources(target.id, sources, null, writer(ctx))
    const added = d.widgets.filter((w) => !before.has(w.id))
    return { text: `On board "${d.name}":\n${added.map(widgetLine).join('\n')}${notes.length ? `\n${notes.join('\n')}` : ''}`, view: added.length === 1 ? boardView(d, added[0]) : undefined }
  }
}

export const DASHBOARD_TOOLS: ToolDef[] = [board, addToBoard]
