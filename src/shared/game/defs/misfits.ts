import { componentClass, type ComponentRecord, type EntityRecord, type ParamSpec } from '../core'
import { templateKindOf } from './templates'
import { defId } from './defs'

export interface Misfit {
  kind: string
  id: string
}

function referenced(spec: ParamSpec, value: unknown): string[] {
  if (spec.kind === 'template') return typeof value === 'string' && value ? [value] : []
  if (spec.kind === 'values') return value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : []
  if (spec.kind === 'list' && spec.of) {
    const of = spec.of
    return Array.isArray(value) ? value.flatMap((v) => referenced(of, v)) : []
  }
  return []
}

export function misfitsOf(record: EntityRecord, has: (kind: string, id: string) => boolean): Misfit[] {
  const found = new Map<string, Misfit>()
  const note = (kind: string, id: string) => {
    if (!has(kind, id)) found.set(`${kind}/${id}`, { kind, id })
  }
  const walk = (c: ComponentRecord, inside: boolean) => {
    const Class = componentClass(c.type)
    if (!Class) note('component', c.type)
    else
      for (const [key, spec] of Object.entries(Class.PARAMS as Record<string, ParamSpec>)) {
        if (!spec.templateKind) continue
        for (const id of [...referenced(spec, c.params[key]), ...referenced(spec, c.state?.[key])]) note(spec.templateKind, defId(id))
      }
    const kind = templateKindOf(c.type)
    if (kind && !inside && typeof c.params.id === 'string' && c.params.id) note(kind, defId(c.params.id))
    for (const child of c.comps ?? []) walk(child, inside || kind !== null)
  }
  for (const c of record.comps) walk(c, false)
  return [...found.values()]
}
