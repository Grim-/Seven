import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import fs from 'node:fs'
import path from 'node:path'
import type { Dashboard, FieldDef, ViewOptions, Widget, WidgetLayout, WidgetSource } from '@shared/types'
import { GRID_COLS, HOME_BOARD, NAMED_SIZES, cleanViewOptions, defaultSize, placeWidget } from '@shared/widgets'
import { readJson, removePath, writeJson } from '../util/fs'
import type { WriteContext } from './pages'
import { DataError, slug } from './validate'
import { upgradeWidgetSources, widgetProvider } from './widgetSources'

const MAX_WIDGETS = 40
const ICON = /^[a-z0-9]+(-[a-z0-9]+)*$/

interface StoredDashboard extends Dashboard {
  nextWidget: number
}

function readFile(file: string): Buffer | null {
  try {
    return fs.readFileSync(file)
  } catch (err) {
    noteFailure(err, 'data', 'Could not read a dashboard file')
    return null
  }
}

function cleanIcon(icon: unknown): string {
  const value = typeof icon === 'string' ? icon.trim().toLowerCase() : ''
  return ICON.test(value) ? value : 'layout-dashboard'
}

export class DashboardStore {
  constructor(
    private dir: string,
    private changed: (id: string, dashboard: Dashboard | null) => void
  ) {}

  fileFor(id: string): string {
    return path.join(this.dir, `${id}.json`)
  }

  private load(id: string): StoredDashboard | null {
    const data = readJson<StoredDashboard | null>(this.fileFor(id), null)
    if (!data || !Array.isArray(data.widgets)) return null
    upgradeWidgetSources(data.widgets)
    return data
  }

  private strip(data: StoredDashboard): Dashboard {
    const { nextWidget: _n, ...rest } = data
    return rest
  }

  private save(data: StoredDashboard, ctx: WriteContext): Dashboard {
    const file = this.fileFor(data.id)
    ctx.checkpoint?.(file, readFile(file))
    data.version += 1
    data.updatedAt = Date.now()
    writeJson(file, data)
    const clean = this.strip(data)
    this.changed(data.id, clean)
    return clean
  }

  list(): Dashboard[] {
    if (!fs.existsSync(this.dir)) return []
    const out: Dashboard[] = []
    for (const name of fs.readdirSync(this.dir)) {
      if (!name.endsWith('.json')) continue
      const data = this.load(name.slice(0, -5))
      if (data) out.push(this.strip(data))
    }
    return out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  }

  resolve(ref: string): string {
    const wanted = (ref ?? '').trim()
    const list = this.list()
    const found = list.find((d) => d.id === wanted) ?? list.find((d) => d.name.toLowerCase() === wanted.toLowerCase()) ?? list.find((d) => d.id === slug(wanted))
    if (found) return found.id
    if (!list.length) throw notFound(new DataError(`There is no dashboard named "${wanted}". There are no dashboards yet; create one with the board tool.`))
    throw notFound(new DataError(`There is no dashboard named "${wanted}". Use one of: ${list.map((d) => d.name).join(', ')}`))
  }

  private require(ref: string): StoredDashboard {
    const data = this.load(this.resolve(ref))
    if (!data) throw new DataError(`Dashboard "${ref}" could not be read; its saved file may be damaged. Use another dashboard, or create a new one with the board tool.`)
    return data
  }

  get(ref: string): Dashboard {
    return this.strip(this.require(ref))
  }

  create(input: { name: string; icon?: string | null; onToolbar?: boolean | null }, ctx: WriteContext = {}): Dashboard {
    const name = (input.name ?? '').trim()
    const id = slug(name)
    if (!id) throw new DataError('Give the dashboard a name with at least one letter or number, e.g. Garden.')
    const existing = this.list()
    const clash = existing.find((d) => d.id === id)
    if (clash) throw new DataError(`A dashboard named "${clash.name}" already exists. Add widgets to it instead.`)
    const now = Date.now()
    const data: StoredDashboard = {
      id,
      name,
      icon: cleanIcon(input.icon),
      color: null,
      order: existing.reduce((m, d) => Math.max(m, d.order), 0) + 1,
      onToolbar: input.onToolbar !== false,
      widgets: [],
      version: 0,
      createdAt: now,
      updatedAt: now,
      nextWidget: 1
    }
    return this.save(data, ctx)
  }

  update(ref: string, patch: { name?: string | null; icon?: string | null; color?: string | null; onToolbar?: boolean | null }, ctx: WriteContext = {}): Dashboard {
    const data = this.require(ref)
    const name = patch.name?.trim()
    if (name && name !== data.name) {
      const other = this.list().find((d) => d.id !== data.id && (d.id === slug(name) || d.name.toLowerCase() === name.toLowerCase()))
      if (other) throw new DataError(`There is already a dashboard named "${other.name}". Pick a different name.`)
      data.name = name
    }
    if (patch.icon) data.icon = cleanIcon(patch.icon)
    if (patch.color !== undefined) data.color = patch.color && /^#[0-9a-f]{6}$/i.test(patch.color) ? patch.color : null
    if (typeof patch.onToolbar === 'boolean') data.onToolbar = patch.onToolbar
    return this.save(data, ctx)
  }

  reorder(ids: string[]): Dashboard[] {
    ids.forEach((id, i) => {
      const data = this.load(id)
      if (data && data.order !== i + 1) {
        data.order = i + 1
        this.save(data, {})
      }
    })
    return this.list()
  }

  home(): Dashboard {
    const existing = this.load(HOME_BOARD)
    if (existing) return this.strip(existing)
    const now = Date.now()
    const glance = (n: number, tool: string, layout: WidgetLayout): Widget => {
      const source = { kind: 'tool', tool }
      return { id: `w${n}`, title: widgetProvider(source).title(source), source, view: 'tool', options: {}, layout }
    }
    const data: StoredDashboard = {
      id: HOME_BOARD,
      name: 'Home',
      icon: 'house',
      color: null,
      order: 0,
      onToolbar: false,
      widgets: [
        glance(1, 'clock', { x: 0, y: 0, w: 4, h: 5 }),
        glance(2, 'today', { x: 4, y: 0, w: 4, h: 11 }),
        glance(3, 'recent', { x: 8, y: 0, w: 4, h: 11 }),
        glance(4, 'system', { x: 0, y: 5, w: 4, h: 6 })
      ],
      version: 0,
      createdAt: now,
      updatedAt: now,
      nextWidget: 5
    }
    return this.save(data, {})
  }

  delete(ref: string, ctx: WriteContext = {}): boolean {
    const id = this.resolve(ref)
    if (id === HOME_BOARD) throw new DataError('The Home board always stays. Remove its widgets instead.')
    const file = this.fileFor(id)
    ctx.checkpoint?.(file, readFile(file))
    removePath(file)
    this.changed(id, null)
    return true
  }

  private findWidget(data: StoredDashboard, ref: string): Widget {
    const wanted = (ref ?? '').trim()
    const widget = data.widgets.find((w) => w.id === wanted) ?? data.widgets.find((w) => w.title.toLowerCase() === wanted.toLowerCase())
    if (widget) return widget
    if (!data.widgets.length) throw new DataError(`"${data.name}" has no widgets yet. Put things on it with add_to_board.`)
    throw new DataError(`"${data.name}" has no widget "${wanted}". Use one of these widget ids or titles: ${data.widgets.map((w) => `${w.id} "${w.title}"`).join(', ')}`)
  }

  private fieldsOf(source: WidgetSource): FieldDef[] | null {
    return widgetProvider(source).fields?.(source) ?? null
  }

  checkSource(source: WidgetSource): WidgetSource {
    if (!source || typeof source !== 'object') throw new DataError('A widget needs a source')
    return widgetProvider(source).check(source)
  }

  private cleanView(source: WidgetSource, view: string | null | undefined): string {
    const provider = widgetProvider(source)
    if (!view) return provider.viewFor?.(source) ?? provider.defaultView
    const v = view.trim().toLowerCase()
    if (!provider.views.includes(v)) throw new DataError(`A ${provider.label.toLowerCase()} widget can't be shown as "${v}". Set view to one of: ${provider.views.join(', ')}, or leave it empty for the usual one.`)
    provider.checkView?.(source, v)
    return v
  }

  private clampLayout(layout: WidgetLayout): WidgetLayout {
    const w = Math.min(GRID_COLS, Math.max(2, Math.round(layout.w)))
    const h = Math.min(40, Math.max(2, Math.round(layout.h)))
    const x = Math.min(GRID_COLS - w, Math.max(0, Math.round(layout.x)))
    const y = Math.max(0, Math.round(layout.y))
    return { x, y, w, h }
  }

  addWidget(
    ref: string,
    input: { title?: string | null; source: WidgetSource; view?: string | null; options?: unknown; size?: string | null; layout?: Partial<WidgetLayout> | null },
    ctx: WriteContext = {}
  ): { dashboard: Dashboard; widget: Widget } {
    const data = this.require(ref)
    if (data.widgets.length >= MAX_WIDGETS) throw new DataError(`A dashboard holds at most ${MAX_WIDGETS} widgets. Remove a widget from it first, or put this on another dashboard.`)
    input = { ...input, source: this.checkSource(input.source) }
    const view = this.cleanView(input.source, input.view)
    const options = cleanViewOptions(view, input.options, this.fieldsOf(input.source), true)
    const size = (input.size && NAMED_SIZES[input.size]) || widgetProvider(input.source).size?.(input.source) || defaultSize(view)
    const placed = placeWidget(
      data.widgets.map((w) => w.layout),
      { w: input.layout?.w ?? size.w, h: input.layout?.h ?? size.h }
    )
    const layout = this.clampLayout({ ...placed, ...(input.layout?.x !== undefined && input.layout?.y !== undefined ? { x: input.layout.x, y: input.layout.y } : {}) })
    const title = (input.title ?? '').trim() || widgetProvider(input.source).title(input.source)
    const widget: Widget = { id: `w${data.nextWidget++}`, title: title.slice(0, 80), source: input.source, view, options, layout }
    data.widgets.push(widget)
    const dashboard = this.save(data, ctx)
    return { dashboard, widget }
  }

  createWidget(ref: string, kind: string, ctx: WriteContext = {}): Dashboard {
    const create = widgetProvider({ kind }).create
    if (!create) throw new DataError(`A ${kind} widget can't be made new; put an existing one on the board instead.`)
    return this.addWidget(ref, { source: create.make(ctx), layout: create.size ?? null }, ctx).dashboard
  }

  updateWidget(
    ref: string,
    widgetRef: string,
    patch: { title?: string | null; view?: string | null; options?: unknown; source?: WidgetSource | null },
    ctx: WriteContext = {}
  ): { dashboard: Dashboard; widget: Widget } {
    const data = this.require(ref)
    const widget = this.findWidget(data, widgetRef)
    const source = patch.source ? this.checkSource(patch.source) : widget.source
    const view = patch.view ? this.cleanView(source, patch.view) : widgetProvider(source).views.includes(widget.view) ? widget.view : this.cleanView(source, null)
    let options: ViewOptions = widget.options
    if (patch.options !== undefined && patch.options !== null) options = cleanViewOptions(view, patch.options, this.fieldsOf(source), true)
    else if (view !== widget.view || patch.source) options = cleanViewOptions(view, widget.options, this.fieldsOf(source), false)
    if (patch.title?.trim()) widget.title = patch.title.trim().slice(0, 80)
    widget.source = source
    widget.view = view
    widget.options = options
    const dashboard = this.save(data, ctx)
    return { dashboard, widget }
  }

  removeWidget(ref: string, widgetRef: string, ctx: WriteContext = {}): Dashboard {
    const data = this.require(ref)
    const widget = this.findWidget(data, widgetRef)
    data.widgets = data.widgets.filter((w) => w !== widget)
    return this.save(data, ctx)
  }

  moveWidget(ref: string, widgetRef: string, layout: Partial<WidgetLayout>, ctx: WriteContext = {}): { dashboard: Dashboard; widget: Widget } {
    const data = this.require(ref)
    const widget = this.findWidget(data, widgetRef)
    widget.layout = this.clampLayout({ ...widget.layout, ...Object.fromEntries(Object.entries(layout).filter(([, v]) => typeof v === 'number')) })
    const dashboard = this.save(data, ctx)
    return { dashboard, widget }
  }

  setLayouts(ref: string, layouts: { id: string; x: number; y: number; w: number; h: number }[]): Dashboard {
    const data = this.require(ref)
    let changed = false
    for (const l of layouts) {
      const widget = data.widgets.find((w) => w.id === l.id)
      if (!widget) continue
      const next = this.clampLayout(l)
      if (next.x !== widget.layout.x || next.y !== widget.layout.y || next.w !== widget.layout.w || next.h !== widget.layout.h) {
        widget.layout = next
        changed = true
      }
    }
    return changed ? this.save(data, {}) : this.strip(data)
  }

  idFromPath(abs: string): string | null {
    const rel = path.relative(this.dir, abs)
    if (rel.startsWith('..') || path.isAbsolute(rel) || !rel.endsWith('.json') || rel.includes(path.sep)) return null
    return rel.slice(0, -5)
  }

  byId(id: string): Dashboard | null {
    const data = this.load(id)
    return data ? this.strip(data) : null
  }

  notify(id: string): void {
    this.changed(id, this.byId(id))
  }
}
