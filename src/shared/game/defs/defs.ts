import { resolveParams, type ParamSchema } from '../core/params'
import type { CheckDef, DamageTypeDef, SlotDef, StatDef, TimeDef } from '../core/catalog'
import type { ComponentDef } from '../core/registry'
import type { Template } from '../core/GameEntity'

export interface GameDef {
  id: string
  name: string
  notes: string
  values: Record<string, unknown>
}

export interface CatalogData {
  stats: StatDef[]
  damageTypes: DamageTypeDef[]
  formulas: Record<string, string>
  times: TimeDef[]
  checks: CheckDef[]
  slots: SlotDef[]
  templates: Record<string, Record<string, ComponentDef>>
  entities: Record<string, Record<string, Template>>
}

export interface StarterDef {
  id: string
  name: string
  notes?: string
  values: Record<string, unknown>
}

export interface DefType {
  type: string
  label: string
  plural: string
  icon: string
  description: string
  params: ParamSchema
  starter: StarterDef[]
  line(def: GameDef): string
  addTo(data: CatalogData, def: GameDef): void
}

const types = new Map<string, DefType>()

export function registerDefType(type: DefType): void {
  types.set(type.type, type)
}

export function defTypes(): DefType[] {
  return [...types.values()]
}

export function defType(type: string): DefType | null {
  return types.get(type) ?? null
}

export function defId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function cleanDef(type: DefType, raw: unknown): GameDef | null {
  const v = obj(raw)
  const name = typeof v.name === 'string' ? v.name.trim() : ''
  const id = defId(typeof v.id === 'string' && v.id ? v.id : name)
  if (!name || !id) return null
  return { id, name, notes: typeof v.notes === 'string' ? v.notes : '', values: resolveParams(type.params, obj(v.values)) }
}

export function starterDefs(type: DefType): GameDef[] {
  return type.starter.map((s) => cleanDef(type, s)).filter((d): d is GameDef => d !== null)
}

export function emptyCatalogData(): CatalogData {
  return { stats: [], damageTypes: [], formulas: {}, times: [], checks: [], slots: [], templates: {}, entities: {} }
}

export function catalogData(defs: Record<string, GameDef[]>): CatalogData {
  const data = emptyCatalogData()
  for (const type of defTypes()) for (const def of defs[type.type] ?? []) type.addTo(data, def)
  return data
}

export function splitDefRef(ref: string): { id: string } {
  const at = ref.indexOf('/')
  return { id: at < 0 ? ref : ref.slice(at + 1) }
}
