import type { ShapeForm } from '@shared/shapes'
import { resolveParams, type ParamSchema } from '../core/params'

export type TriggerFires = 'enter' | 'interact'

export interface TriggerDef {
  id: string
  name: string
  type: string
  shape: ShapeForm
  fires: TriggerFires
  once: boolean
  needsItem: string
  needsFlag: string
  hiddenIfFlag?: string
  setsFlag: string
  values: Record<string, unknown>
}

export interface TriggerType {
  type: string
  label: string
  icon: string
  description: string
  fires: TriggerFires
  params: ParamSchema
}

const types = new Map<string, TriggerType>()

export function registerTriggerType(type: TriggerType): void {
  types.set(type.type, type)
}

export function triggerTypes(): TriggerType[] {
  return [...types.values()]
}

export function triggerType(type: string): TriggerType | null {
  return types.get(type) ?? null
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function cleanTrigger(raw: unknown, shape: ShapeForm | null): TriggerDef | null {
  const v = obj(raw)
  const type = triggerType(str(v.type))
  if (!type || !shape || !str(v.id)) return null
  return {
    id: str(v.id),
    name: str(v.name).trim() || type.label,
    type: type.type,
    shape,
    fires: v.fires === 'enter' || v.fires === 'interact' ? v.fires : type.fires,
    once: v.once === true,
    needsItem: str(v.needsItem),
    needsFlag: str(v.needsFlag),
    hiddenIfFlag: str(v.hiddenIfFlag),
    setsFlag: str(v.setsFlag),
    values: resolveParams(type.params, obj(v.values))
  }
}

export function newTrigger(type: TriggerType, shape: ShapeForm): TriggerDef {
  return { id: crypto.randomUUID(), name: type.label, type: type.type, shape, fires: type.fires, once: false, needsItem: '', needsFlag: '', hiddenIfFlag: '', setsFlag: '', values: resolveParams(type.params, {}) }
}
