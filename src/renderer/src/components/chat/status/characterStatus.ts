import type { CharacterSheet } from '@shared/types'
import { moduleList, type ModuleEntry } from '@shared/moduleList'

export interface Health {
  cur: number
  max: number
  temp: number
}

export interface StatusRead {
  health?: Health | null
  effects?: string[]
}

export interface StatusSource extends ModuleEntry {
  read: (sheet: CharacterSheet) => StatusRead
}

export interface CharacterStatus {
  name: string
  health: Health | null
  effects: string[]
}

export const statusSources = moduleList<StatusSource>()

export interface HealthChange {
  from: number
  to: number
}

export interface HealthWriter extends ModuleEntry {
  change: (sheet: CharacterSheet, delta: number) => Promise<HealthChange> | null
}

export const healthWriters = moduleList<HealthWriter>()
