import type { ThemeDraft, ThemeInput } from '@shared/theme'

export interface SectionProps {
  draft: ThemeDraft
  set: (patch: Partial<ThemeDraft>) => void
  defaults: ThemeInput
}

export function withKey<K extends string, V>(record: Partial<Record<K, V>>, key: K, value: V | null | undefined): Partial<Record<K, V>> {
  const next = { ...record }
  if (value === null || value === undefined) delete next[key]
  else next[key] = value
  return next
}

export function countKeys(record: object | null | undefined): number {
  return record ? Object.keys(record).length : 0
}
