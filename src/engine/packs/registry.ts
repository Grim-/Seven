import type { ModelTraitSet } from '@shared/types'

export interface PackFacts {
  traits: ModelTraitSet
  architecture: string | null
  paramsB: number | null
  fileBytes: number | null
  vramTotalMb: number | null
  vramFreeMb: number | null
  computeCap: number | null
  ramMb: number
  cpuCores: number
  backends: string[]
  flags: string[] | null
}

export interface PackCondition {
  name: string
  valid(value: unknown): string | null
  check(value: unknown, facts: PackFacts): string | null
}

const conditions = new Map<string, PackCondition>()

export function registerCondition(condition: PackCondition): void {
  conditions.set(condition.name, condition)
}

export function conditionOf(name: string): PackCondition | null {
  return conditions.get(name) ?? null
}
