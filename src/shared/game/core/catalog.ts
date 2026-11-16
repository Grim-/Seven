import type { ClockConfig } from './clock'
import type { ComponentDef } from './registry'
import type { Template } from './GameEntity'

export interface StatDef {
  id: string
  label: string
  domain: string
  default: number
  min: number
  max: number
  regenPerSecond: number
  regenScaledBy: string | null
  colour: string | null
}

export interface DamageTypeDef {
  id: string
  label: string
  resistedBy: string
  scalesWith: string | null
}

export interface TimeDef {
  id: string
  label: string
  clock: ClockConfig
  roundSeconds: number
}

export interface CheckDef {
  id: string
  label: string
  group: string
  dice: string
  bonus: string
}

export interface SlotDef {
  id: string
  label: string
  icon: string
  countStat: string | null
}

export interface Catalog {
  stat(id: string): StatDef | null
  stats(domain?: string): StatDef[]
  damageType(id: string): DamageTypeDef | null
  formula(id: string): string | null
  time(id: string): TimeDef | null
  times(): TimeDef[]
  check(id: string): CheckDef | null
  checks(group?: string): CheckDef[]
  slot(id: string): SlotDef | null
  slots(): SlotDef[]
  template(kind: string, id: string): ComponentDef | null
  templates?(kind: string): Record<string, ComponentDef>
  entity(kind: string, id: string): Template | null
}
