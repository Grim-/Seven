import type { ViewRef, WidgetSource } from '@shared/types'
import type { KindWidget } from '../../data/widgetSources'
import type { Kind, KindContext, KindHit, TrailStep } from './types'

export interface KindRuntime {
  kinds(ctx?: KindContext): Kind[]
  kindFor(name: string, ctx: KindContext): Kind | undefined
  kindOf(entry: string, ctx?: KindContext): { kind: Kind; id: string }
  resolveEntry(entry: string, kindName?: string | null, ctx?: KindContext): { kind: Kind; id: string; trail?: TrailStep[]; path?: string }
  entryView(kind: Kind, id: string, part: string | null, ctx?: KindContext): ViewRef
  entryId(kind: Kind, id: string, title: string, ctx: KindContext): string
  pathVia(steps: [Kind, string][], ctx: KindContext): string | null
  searchKind(k: Kind, query: string, limit: number, ctx: KindContext): KindHit[]
}

let bound: KindRuntime | null = null

export function setKindRuntime(rt: KindRuntime): void {
  bound = rt
}

export function kindRt(): KindRuntime {
  if (!bound) throw new Error('Kind runtime has not been initialized yet.')
  return bound
}

const entryOf = (source: WidgetSource) => kindRt().kindOf(`${source.kind}/${String(source.id ?? '')}`)

export const ENTRY_WIDGET: KindWidget = {
  views: ['entry'],
  defaultView: 'entry',
  check: (source) => {
    const { kind, id } = entryOf(source)
    return { kind: kind.kind, id, part: typeof source.part === 'string' ? source.part : null }
  },
  title: (source) => {
    const { kind, id } = entryOf(source)
    return kind.title(id)
  },
  describe: (source) => {
    const { kind, id } = entryOf(source)
    return `${kind.label.toLowerCase()} ${kind.title(id)}`
  }
}
