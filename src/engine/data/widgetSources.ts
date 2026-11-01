import type { FieldDef, WidgetChoice, WidgetInfo, WidgetSource } from '@shared/types'
import type { WriteContext } from './pages'
import { DataError } from './validate'

export interface WidgetProvider {
  kind: string
  label: string
  views: readonly string[]
  defaultView: string
  viewFor?(source: WidgetSource): string
  check(source: WidgetSource): WidgetSource
  title(source: WidgetSource): string
  describe(source: WidgetSource): string
  fields?(source: WidgetSource): FieldDef[]
  checkView?(source: WidgetSource, view: string): void
  size?(source: WidgetSource): { w: number; h: number } | null
  merge?(sources: WidgetSource[]): WidgetSource[]
  create?: { label: string; size?: { w: number; h: number }; make(ctx: WriteContext): WidgetSource }
  choices?(): WidgetChoice[]
  formerly?: string[]
  upgrade?(old: WidgetSource, view: string): { source: WidgetSource; view: string }
}

export type KindWidget = Omit<WidgetProvider, 'kind' | 'label'>

const providers = new Map<string, WidgetProvider>()
let widgetKinds: () => { kind: string; label: string; presents?: { widget?: KindWidget } }[] = () => []

export function registerWidgetProvider(provider: WidgetProvider): void {
  providers.set(provider.kind, provider)
}

export function setWidgetKinds(list: () => { kind: string; label: string; presents?: { widget?: KindWidget } }[]): void {
  widgetKinds = list
}

function everyProvider(): WidgetProvider[] {
  const fromKinds = widgetKinds().flatMap((k) => (k.presents?.widget ? [{ ...k.presents.widget, kind: k.kind, label: k.label }] : []))
  return [...fromKinds, ...providers.values()]
}

function providerOf(kind: string): WidgetProvider | undefined {
  return everyProvider().find((p) => p.kind === kind)
}

export function widgetProvider(source: { kind: string }): WidgetProvider {
  const provider = providerOf(source?.kind)
  if (!provider) throw new DataError(`A widget can show: ${everyProvider().map((p) => p.kind).join(', ')}. "${source?.kind}" isn't one of them.`)
  return provider
}

export function upgradeWidgetSources(widgets: { source: WidgetSource; view: string }[]): void {
  const all = everyProvider()
  for (const w of widgets) {
    if (all.some((p) => p.kind === w.source.kind)) continue
    const provider = all.find((p) => p.formerly?.includes(w.source.kind))
    if (provider) Object.assign(w, provider.upgrade?.(w.source, w.view) ?? { source: { ...w.source, kind: provider.kind } })
  }
}

export function mergeWidgetSources(sources: WidgetSource[]): WidgetSource[] {
  const groups = new Map<string, WidgetSource[]>()
  for (const s of sources) groups.set(s.kind, [...(groups.get(s.kind) ?? []), s])
  return [...groups.entries()].flatMap(([kind, group]) => providerOf(kind)?.merge?.(group) ?? group)
}

export function describeWidgetSource(source: WidgetSource): string {
  return providerOf(source.kind)?.describe(source) ?? source.kind
}

export function widgetInfo(): WidgetInfo {
  return {
    providers: everyProvider().map((p) => ({ kind: p.kind, label: p.label, views: p.views, defaultView: p.defaultView, create: p.create?.label ?? null, choices: p.choices?.() ?? null }))
  }
}
