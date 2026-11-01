import type { WidgetChoice, WidgetSource } from '@shared/types'
import { data } from './hub'
import { DataError } from './validate'
import { registerWidgetProvider } from './widgetSources'

const glances = new Map<string, WidgetChoice>()

export function registerGlance(glance: { id: string; label: string; module?: string }): void {
  glances.set(glance.id, { id: glance.id, label: glance.label, module: glance.module ?? null })
}

const glanceOf = (source: WidgetSource) => glances.get(String(source.tool ?? '').trim().toLowerCase())

registerWidgetProvider({
  kind: 'tool',
  label: 'Tool',
  views: ['tool'],
  defaultView: 'tool',
  check: (source) => {
    const glance = glanceOf(source)
    if (!glance) throw new DataError(`There is no tool widget "${String(source.tool ?? '')}". Use one of: ${[...glances.keys()].join(', ')}`)
    if (glance.module && !data.toolIsOn(glance.module)) throw new DataError(`The ${glance.label} tool is off, so its widget can't be shown. Turn the tool on first, or show something else.`)
    return { kind: 'tool', tool: glance.id }
  },
  title: (source) => glanceOf(source)?.label ?? 'Tool',
  describe: (source) => `${String(source.tool)} glance`,
  choices: () => [...glances.values()]
})

registerGlance({ id: 'clock', label: 'Clock' })
registerGlance({ id: 'today', label: 'Today' })
registerGlance({ id: 'recent', label: 'Recent changes' })
registerGlance({ id: 'system', label: 'System' })
registerGlance({ id: 'player', label: 'Media player' })
registerGlance({ id: 'theme', label: 'Theme' })
