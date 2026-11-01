import { describeWidgetSource } from '../data/widgetSources'
import type { ViewRef } from '@shared/types'
import { data } from '../data/hub'
import type { Dashboard, Widget } from '@shared/types'
import { ToolError, type ToolContext } from '../tools/types'

export type Place = { kind: 'inline' | 'panel' | 'stage' } | { kind: 'board'; board: Dashboard }

export const WHERE_FIELD = { type: 'string' as const, description: 'inline, panel, stage or board:<name>' }
export const KEY_FIELD = { type: ['string', 'null'] as ['string', 'null'], description: 'Replace the earlier one with this key (on a board: a widget id or title), or null' }

export function parsePlace(value: unknown, ctx: ToolContext): Place {
  const raw = typeof value === 'string' ? value.trim() : ''
  const lower = raw.toLowerCase()
  if (!raw || lower === 'inline' || lower === 'chat') return { kind: 'inline' }
  if (lower === 'panel' || lower === 'side panel') return { kind: 'panel' }
  if (lower === 'stage') return { kind: 'stage' }
  const m = /^(?:board|dashboard)\s*:\s*(.+)$/i.exec(raw)
  if (!m) throw new ToolError(`"${raw}" is not a place. Set where to one of: inline, panel, stage, or board:<name> (e.g. board:Home).`)
  if (!ctx.groups.includes('dashboards')) throw new ToolError('This agent has no boards. Set where to inline, panel or stage instead.')
  const boards = data.dashboards.list()
  const name = m[1].trim()
  const board = boards.find((b) => b.name.toLowerCase() === name.toLowerCase() || b.id === name)
  if (!board) throw new ToolError(`There is no board "${name}". ${boards.length ? `Set where to board:<name> with one of: ${boards.map((b) => b.name).join(', ')}` : 'There are no boards yet: create one with the board tool, or set where to inline, panel or stage'}.`)
  return { kind: 'board', board }
}

export function widgetLine(w: Widget): string {
  const what = describeWidgetSource(w.source)
  const opts = Object.keys(w.options).length ? ` ${JSON.stringify(w.options)}` : ''
  return `${w.id} "${w.title}": ${what} as ${w.view} at ${w.layout.x},${w.layout.y} size ${w.layout.w}x${w.layout.h}${opts}`
}

export function boardView(d: Dashboard, w: Widget): ViewRef {
  return { kind: 'widget', title: `${d.name} · ${w.title}`, data: { dashboardId: d.id, widgetId: w.id } }
}

export function writer(ctx: ToolContext) {
  return { checkpoint: (abs: string, previous: Buffer | null) => ctx.checkpoints.save(abs, previous) }
}
