import path from 'node:path'
import type { Events } from '@shared/protocol'
import { paths } from '../util/paths'
import { AssetStore } from './assets'
import { PageStore, type WriteContext } from './pages'
import { DashboardStore } from './dashboards'
import type { Dashboard, Page, WidgetSource } from '@shared/types'

type Emit = <K extends keyof Events>(event: K, payload: Events[K]) => void

export class DataHub {
  private emit: Emit = () => undefined
  readonly assets = new AssetStore(path.join(paths.data, 'assets'), (id, meta) => this.emit('asset.changed', { id, meta }))
  readonly pages = new PageStore(paths.data, (id) => this.assets.exists(id), (id, meta) => this.emit('page.changed', { id, meta }))
  readonly dashboards = new DashboardStore(path.join(paths.data, 'dashboards'), (id, dashboard) => this.emit('dashboard.changed', { id, dashboard }))

  placeSources(ref: string, sources: WidgetSource[], at: { x: number; y: number } | null, ctx: WriteContext = {}): Dashboard {
    let dashboard = this.dashboards.get(ref)
    sources.forEach((source, index) => {
      dashboard = this.dashboards.addWidget(dashboard.id, { source, layout: index === 0 && at ? at : null }, ctx).dashboard
    })
    return dashboard
  }

  private toolOn: (id: string) => boolean = () => false

  pageInfo(ref: string): { id: string; title: string; fields: Page['fields']; defaultView: string; typed: boolean } {
    const p = this.pages.get(ref)
    const items = p.fields.length > 0 && (p.records.length > 0 || !p.body.trim())
    const view = p.type ? 'addon' : items ? (p.view ?? (p.fields.some((f) => f.type === 'boolean') ? 'checklist' : 'table')) : 'text'
    return { id: p.id, title: p.title, fields: p.fields, defaultView: view, typed: Boolean(p.type) }
  }

  toolIsOn(id: string): boolean {
    return this.toolOn(id)
  }

  setToolCheck(fn: (id: string) => boolean): void {
    this.toolOn = fn
  }

  setEmitter(emit: Emit): void {
    this.emit = emit
  }

  describe(abs: string): string | null {
    const p = this.pages.idFromPath(abs)
    if (p) return `Page: ${this.pages.metaFor(p)?.title ?? p}`
    const a = this.assets.idFromPath(abs)
    if (a) return `File: ${this.assets.metaFor(a)?.name ?? a}`
    const d = this.dashboards.idFromPath(abs)
    if (d) return `Dashboard: ${this.dashboards.byId(d)?.name ?? d}`
    return null
  }

  refresh(absPaths: string[]): void {
    const done = new Set<string>()
    for (const abs of absPaths) {
      const p = this.pages.idFromPath(abs)
      if (p && !done.has(`p:${p}`)) {
        done.add(`p:${p}`)
        this.emit('page.changed', { id: p, meta: this.pages.metaFor(p) })
      }
      const a = this.assets.idFromPath(abs)
      if (a && !done.has(`a:${a}`)) {
        done.add(`a:${a}`)
        this.emit('asset.changed', { id: a, meta: this.assets.metaFor(a) })
      }
      const d = this.dashboards.idFromPath(abs)
      if (d && !done.has(`d:${d}`)) {
        done.add(`d:${d}`)
        this.emit('dashboard.changed', { id: d, dashboard: this.dashboards.byId(d) })
      }
    }
  }
}

export const data = new DataHub()

