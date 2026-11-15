import { showName } from '@shared/ids'
import type { WidgetSource } from '@shared/types'
import { findSheet, getSheet, sheetIds } from '../library/sheets'
import { noteFailure } from '../util/report'
import { DataError } from './validate'
import { registerWidgetProvider } from './widgetSources'

function cleanStatsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

function firstGameSheet(): string {
  const all = sheetIds()
  for (const s of all) {
    try {
      if (getSheet(s.id).game) return s.id
    } catch (err) {
      noteFailure(err, 'dashboards', 'Could not inspect character sheet for widget default')
    }
  }
  return all[0]?.id ?? ''
}

registerWidgetProvider({
  kind: 'character_stats',
  label: 'Character stats',
  views: ['stats'],
  defaultView: 'stats',
  check: (source: WidgetSource) => {
    const rawSheet = typeof source.sheet === 'string' ? source.sheet.trim() : ''
    const resolved = rawSheet ? findSheet(rawSheet) : null
    if (rawSheet && !resolved) {
      throw new DataError(`There is no character sheet "${rawSheet}". Pick an existing character sheet.`)
    }
    const stats = cleanStatsList(source.stats)
    return {
      kind: 'character_stats',
      sheet: resolved ?? '',
      ...(stats.length ? { stats } : {}),
      showResources: source.showResources !== false,
      showBuffs: source.showBuffs !== false,
      editable: source.editable !== false
    }
  },
  title: (source) => {
    const ref = typeof source.sheet === 'string' ? source.sheet : ''
    if (!ref) return 'Character stats'
    try {
      return `${showName(getSheet(ref).title)} · stats`
    } catch (err) {
      noteFailure(err, 'dashboards', 'Could not title character stats widget')
      return 'Character stats'
    }
  },
  describe: (source) => {
    const stats = cleanStatsList(source.stats)
    return stats.length ? `Tracks stats: ${stats.join(', ')}` : 'Tracks all game stats on a character sheet'
  },
  create: {
    label: 'Character stats',
    size: { w: 4, h: 4 },
    make: () => ({
      kind: 'character_stats',
      sheet: firstGameSheet(),
      showResources: true,
      showBuffs: true,
      editable: true
    })
  },
  choices: () =>
    sheetIds()
      .filter((s) => {
        try {
          return Boolean(getSheet(s.id).game)
        } catch (err) {
          noteFailure(err, 'dashboards', 'Could not filter character sheet choices')
          return false
        }
      })
      .map((s) => ({ id: s.id, label: showName(s.title), module: null }))
})
