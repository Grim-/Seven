export type SettingValue = number | string | boolean | string[]
export type SettingValues = Record<string, SettingValue>

export interface SettingOption {
  value: string
  label: string
}

export interface SettingSpec {
  name: string
  label: string
  type: string
  default: SettingValue
  min?: number
  max?: number
  step?: number
  options?: SettingOption[]
  themed?: boolean
  hint?: string
}

export interface SettingType {
  type: string
  clean(spec: SettingSpec, value: unknown): SettingValue | undefined
  schema(spec: SettingSpec): Record<string, unknown>
}

const types = new Map<string, SettingType>()

export function registerSettingType(t: SettingType): void {
  types.set(t.type, t)
}

export function cleanSettingValue(spec: SettingSpec, value: unknown): SettingValue | undefined {
  return types.get(spec.type)?.clean(spec, value)
}

export function settingsSchema(specs: SettingSpec[]): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const s of specs) if (!(s.name in out) && types.has(s.type)) out[s.name] = types.get(s.type)!.schema(s)
  return out
}

export function settingsFor(specs: SettingSpec[], saved: Record<string, unknown> | null | undefined): SettingValues {
  const out: SettingValues = {}
  for (const s of specs) out[s.name] = cleanSettingValue(s, saved?.[s.name]) ?? s.default
  return out
}

export function pickSettings(specs: SettingSpec[], value: unknown, only?: string[]): SettingValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const v = value as Record<string, unknown>
  const out: SettingValues = {}
  for (const s of specs) {
    if (only && !only.includes(s.name)) continue
    if (!(s.name in v)) continue
    const clean = cleanSettingValue(s, v[s.name])
    if (clean !== undefined) out[s.name] = clean
  }
  return out
}

export const THEME_COLORS: { value: string; label: string }[] = [
  { value: 'accent', label: 'Accent' },
  { value: 'secondary', label: 'Secondary' }
]

export function isThemeColor(value: unknown): value is string {
  return THEME_COLORS.some((c) => c.value === value)
}
