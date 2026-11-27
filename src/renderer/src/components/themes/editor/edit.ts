import type { ThemeDraft, ThemeInput } from '@shared/theme'

export interface SectionProps {
  draft: ThemeDraft
  set: (patch: Partial<ThemeDraft>) => void
  defaults: ThemeInput
}

export function withKey<T extends object, K extends keyof T>(record: T, key: K, value: T[K] | null | undefined): T {
  const next = { ...record }
  if (value === null || value === undefined) delete (next as Record<PropertyKey, unknown>)[key]
  else next[key] = value
  return next
}

export function countKeys(record: object | null | undefined): number {
  return record ? Object.keys(record).length : 0
}
