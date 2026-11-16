import '@shared/game/components'
import { Effects } from '@shared/game/components'
import { componentsFor, type ComponentClass, type ComponentDef, type ParamSpec } from '@shared/game/core'
import { cleanComponents } from '@shared/game/core/params'
import type { JsonSchema } from './schema'

export function effectPieceClasses(host: string = Effects.type): ComponentClass[] {
  return componentsFor(host)
}

function paramSpecToSchema(spec: ParamSpec): JsonSchema {
  if (spec.kind === 'number') {
    return { type: ['number', 'null'], description: spec.description }
  }
  if (spec.kind === 'flag') {
    return { type: ['boolean', 'null'], description: spec.description }
  }
  if (spec.kind === 'choice' && spec.choices?.length) {
    return { enum: [...spec.choices, null], description: spec.description }
  }
  if (spec.kind === 'formula') {
    return { type: ['string', 'number', 'null'], description: spec.description }
  }
  if (spec.kind === 'list') {
    return {
      oneOf: [{ type: 'null' }, { type: 'array', items: spec.of ? paramSpecToSchema(spec.of) : { type: 'string' } }],
      description: spec.description
    }
  }
  if (spec.kind === 'values') {
    return {
      oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { type: 'number' } }],
      description: spec.description
    }
  }
  if (spec.kind === 'components') {
    return {
      oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object' } }],
      description: spec.description
    }
  }
  return { type: ['string', 'null'], description: spec.description }
}

function componentSchema(cls: ComponentClass): JsonSchema {
  const props: Record<string, JsonSchema> = {
    type: { enum: [cls.type], description: cls.DESCRIPTION },
    comps: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object' } }], description: 'Optional nested child pieces' }
  }
  for (const [key, spec] of Object.entries(cls.PARAMS)) {
    props[key] = paramSpecToSchema(spec)
  }
  return {
    type: 'object',
    description: cls.DESCRIPTION,
    properties: props,
    additionalProperties: false,
    required: ['type']
  }
}

export function effectDefListSchema(live = false, host: string = Effects.type): JsonSchema {
  const classes = effectPieceClasses(host)
  if (live && classes.length) {
    return { oneOf: classes.map(componentSchema) }
  }
  const typeNames = classes.map((c) => c.type)
  const merged: Record<string, JsonSchema> = {
    type: typeNames.length
      ? { enum: typeNames, description: 'Registered effect piece type' }
      : { type: 'string', description: 'Registered effect piece type' },
    comps: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object' } }], description: 'Optional nested child pieces' }
  }
  for (const cls of classes) {
    for (const [key, spec] of Object.entries(cls.PARAMS)) {
      if (!(key in merged)) merged[key] = paramSpecToSchema(spec)
    }
  }
  return {
    type: 'object',
    properties: merged,
    additionalProperties: true,
    required: ['type']
  }
}

export function normalizeEffectDefs(raw: unknown, defaultEvent?: string): ComponentDef[] {
  const list = Array.isArray(raw) ? raw : []
  const cleaned = cleanComponents(list)
  if (!defaultEvent) return cleaned
  return cleaned.map((def, i) => {
    const rawItem = list[i] && typeof list[i] === 'object' && !Array.isArray(list[i]) ? (list[i] as Record<string, unknown>) : null
    const explicitOn = rawItem && typeof rawItem.on === 'string' && rawItem.on.trim() ? rawItem.on.trim() : null
    return { ...def, on: explicitOn ?? defaultEvent }
  })
}
