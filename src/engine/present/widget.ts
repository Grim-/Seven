import type { PresentData, WidgetSource } from '@shared/types'
import { DataError } from '../data/validate'
import { registerWidgetProvider } from '../data/widgetSources'

registerWidgetProvider({
  kind: 'present',
  label: 'Presentation',
  views: ['present'],
  defaultView: 'present',
  check: (source: WidgetSource) => {
    const d = source.data as PresentData | undefined
    if (!d || typeof d.type !== 'string' || !d.fields || typeof d.fields !== 'object') throw new DataError('A presentation widget needs its presentation')
    return { kind: 'present', data: { type: d.type, fields: d.fields, where: 'board', key: d.key ?? null } }
  },
  title: () => 'Presentation',
  describe: (source) => `${(source.data as PresentData).type} presentation`
})
