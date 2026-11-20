import { EventEmitter } from 'node:events'
import type { AttributionEntry, ModuleInfo, ResolvedAttribution } from '@shared/types'

const entries = new Map<string, AttributionEntry>()
export const creditsEvents = new EventEmitter()

function emitChanged(): void {
  creditsEvents.emit('changed')
}

export function registerAttribution(entry: AttributionEntry): void {
  entries.set(entry.id, { ...entry })
  emitChanged()
}

export function registerAttributions(list: AttributionEntry[]): void {
  if (list.length === 0) return
  for (const entry of list) entries.set(entry.id, { ...entry })
  emitChanged()
}

export function unregisterAttributionsByPrefix(prefix: string): void {
  let removed = false
  for (const [id, entry] of entries) {
    if (entry.source?.startsWith(prefix)) {
      entries.delete(id)
      removed = true
    }
  }
  if (removed) emitChanged()
}

export function listAttributions(modulesList: ModuleInfo[] = []): ResolvedAttribution[] {
  const byModule = new Map(modulesList.map((m) => [m.id, m]))
  return [...entries.values()]
    .map((entry): ResolvedAttribution => {
      if (!entry.moduleId) return { ...entry }
      const mod = byModule.get(entry.moduleId)
      return {
        ...entry,
        ...(mod ? { moduleName: mod.name, moduleDisabled: mod.state !== 'on' } : {})
      }
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export function registerCoreAttributions(): void {
  registerAttribution({
    id: 'electron',
    name: 'Electron',
    category: 'Runtime',
    license: 'MIT',
    url: 'https://www.electronjs.org',
    usedFor: 'Desktop application shell running Seven locally.',
    source: 'core'
  })
}
