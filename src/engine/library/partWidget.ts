import type { WidgetSource } from '@shared/types'
import { DataError } from '../data/validate'
import { registerWidgetProvider } from '../data/widgetSources'
import { kindOf, partView, type KindContext } from './kinds'

interface PartSource extends WidgetSource {
  kind: 'part'
  entry: string
  id: string
  part: string
}

export function partSource(entry: string, part: string | null, ctx: KindContext): WidgetSource {
  const ref = partView(entry, part, null, ctx)
  const d = ref.data as { kind: string; id: string; part: string }
  return { kind: 'part', entry: d.kind, id: d.id, part: d.part }
}

registerWidgetProvider({
  kind: 'part',
  label: 'Part',
  views: ['part'],
  defaultView: 'part',
  check: (source) => {
    const s = source as PartSource
    if (!s.entry || !s.id || !s.part) throw new DataError('A part widget needs the entry kind, id and part')
    return { kind: 'part', entry: s.entry, id: s.id, part: s.part }
  },
  title: (source) => {
    const s = source as PartSource
    return kindOf(`${s.entry}/${s.id}`).kind.title(s.id)
  },
  describe: (source) => {
    const s = source as PartSource
    return `${s.part} of ${s.entry} ${s.id}`
  }
})
