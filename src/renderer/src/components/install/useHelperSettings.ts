import type { InstallHelperState } from '@shared/types'
import { useAutosavedState, type AutosavedState } from '../ui'
import { engine } from '../../lib/ipc'

export function useHelperSettings(state: InstallHelperState): AutosavedState<Record<string, unknown>> {
  return useAutosavedState<Record<string, unknown>>(state.settings, (v) => engine('install.settings', { helper: state.id, values: v }))
}

export function settingSections(state: InstallHelperState): string[] {
  return [...new Set(Object.values(state.schema).map((spec) => spec.section ?? 'General'))]
}

export function settingKeys(state: InstallHelperState, section: string): string[] {
  return Object.entries(state.schema)
    .filter(([, spec]) => (spec.section ?? 'General') === section)
    .map(([key]) => key)
}

export function settingMatches(state: InstallHelperState, query: string): string[] {
  const q = query.trim().toLowerCase()
  return Object.entries(state.schema)
    .filter(([key, spec]) => [key, spec.label ?? '', spec.description].some((w) => w.toLowerCase().includes(q)))
    .map(([key]) => key)
}
