import type { Component, ComponentRecord } from './Component'
import type { ParamSchema } from './params'

export interface ComponentClass {
  readonly type: string
  readonly DESCRIPTION: string
  readonly PARAMS: ParamSchema
  new (params: Record<string, unknown>, uid?: string): Component
}

export interface ComponentDef {
  type: string
  [param: string]: unknown
}

const types = new Map<string, ComponentClass>()

export function registerComponent(Class: ComponentClass): void {
  types.set(Class.type, Class)
}

export function componentClass(type: string): ComponentClass | null {
  return types.get(type) ?? null
}

export function componentTypes(): ComponentClass[] {
  return [...types.values()]
}

export function createComponent(def: ComponentDef): Component | null {
  const Class = componentClass(def.type)
  if (!Class) return null
  const { type: _type, comps, ...params } = def
  const comp = new Class(params)
  for (const child of Array.isArray(comps) ? (comps as ComponentDef[]) : []) {
    const made = createComponent(child)
    if (made) comp.add(made)
  }
  return comp
}

export function restoreComponent(record: ComponentRecord): Component | null {
  const Class = componentClass(record.type)
  if (!Class) return null
  const comp = new Class(record.params, record.uid)
  comp.fromJSON(record)
  for (const child of record.comps) {
    const made = restoreComponent(child)
    if (made) comp.add(made)
  }
  return comp
}
