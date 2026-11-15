import { moduleList, type ModuleEntry } from './moduleList'

export interface CheckName {
  id: string
  label: string
  group: string
}

export interface CheckValue {
  id: string
  label: string
  bonus: number
}

export interface CheckSource extends ModuleEntry {
  names: () => CheckName[]
  defences: () => CheckName[]
  checks: (sheet: object) => CheckValue[]
  defence: (sheet: object, id: string) => number | null
}

export const checkSources = moduleList<CheckSource>()

let gate: (module: string) => boolean = () => true

export function gateCheckSources(isOn: (module: string) => boolean): void {
  gate = isOn
}

export function activeCheckSources(): CheckSource[] {
  return checkSources.on(gate)
}
