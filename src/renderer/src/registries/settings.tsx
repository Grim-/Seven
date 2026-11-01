import type { ComponentType, ReactNode } from 'react'

export interface SettingsSection {
  id: string
  group: string
  label: string
  hint: string
  icon: ReactNode
  words?: string[]
  Page: ComponentType
}

export const SETTINGS_GROUPS = ['You', 'Look and feel', 'Storage', 'Agents', 'Security', 'Seven']

const sections = new Map<string, SettingsSection>()

export function registerSettings(section: SettingsSection): void {
  sections.set(section.id, section)
}

export function settingsSections(): SettingsSection[] {
  const rank = (g: string) => {
    const i = SETTINGS_GROUPS.indexOf(g)
    return i < 0 ? SETTINGS_GROUPS.length : i
  }
  return [...sections.values()].sort((a, b) => rank(a.group) - rank(b.group))
}

export function settingsMatch(section: SettingsSection, query: string): boolean {
  const q = query.trim().toLowerCase()
  return !q || [section.label, section.hint, ...(section.words ?? [])].some((w) => w.toLowerCase().includes(q))
}
