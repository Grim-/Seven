import { componentClass, type ComponentDef } from './registry'

export type ParamKind =
  | 'number'
  | 'duration'
  | 'text'
  | 'choice'
  | 'formula'
  | 'template'
  | 'list'
  | 'flag'
  | 'values'
  | 'components'
  | 'storedAction'
  | 'entry'
  | 'signal'
  | 'gameTag'
  | 'storyFlag'
  | 'conditions'
  | 'classRewards'
  | 'clutchTriggers'

export interface ParamSpec {
  kind: ParamKind
  default: unknown
  description: string
  label?: string
  min?: number
  max?: number
  choices?: string[]
  labels?: Record<string, string>
  templateKind?: string
  entryKind?: string
  host?: string
  long?: boolean
  of?: ParamSpec
  section?: string
  more?: boolean
}

export type ParamSchema = Record<string, ParamSpec>

function clean(spec: ParamSpec, raw: unknown): unknown {
  if (raw === undefined || raw === null) return spec.default
  if (spec.kind === 'number' || spec.kind === 'duration') {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(n)) return spec.default
    return Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, n))
  }
  if (spec.kind === 'flag') return raw === true
  if (spec.kind === 'formula' && typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (spec.kind === 'components') return cleanComponents(raw)
  if (spec.kind === 'conditions') return Array.isArray(raw) ? raw.filter((item) => item && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).type === 'string') : spec.default
  if (spec.kind === 'classRewards') return Array.isArray(raw) ? raw.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : spec.default
  if (spec.kind === 'clutchTriggers') return Array.isArray(raw) ? raw.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : spec.default
  if (spec.kind === 'values') return raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) : spec.default
  if (spec.kind === 'choice') return typeof raw === 'string' && spec.choices?.includes(raw) ? raw : spec.default
  if (spec.kind === 'list') return Array.isArray(raw) ? raw.map((item) => (spec.of ? clean(spec.of, item) : item)) : spec.default
  return typeof raw === 'string' ? raw : spec.default
}

export const choiceLabel = (spec: ParamSpec, value: string): string => spec.labels?.[value] ?? value

export function cleanComponents(raw: unknown): ComponentDef[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): ComponentDef[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const { type, comps, ...rest } = item as Record<string, unknown>
    if (typeof type !== 'string' || !type) return []
    const Class = componentClass(type)
    if (!Class) return [item as ComponentDef]
    return [{ type, ...resolveParams(Class.PARAMS, rest), comps: cleanComponents(comps) }]
  })
}

export function resolveParams(schema: ParamSchema, raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(schema).map(([key, spec]) => [key, clean(spec, raw[key])]))
}
