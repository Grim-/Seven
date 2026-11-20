import '@shared/game/components'
import { Effects } from '@shared/game/components'
import { componentsFor, type ComponentClass, type ComponentDef, type ParamSpec } from '@shared/game/core'
import { cleanComponents, type ParamSchema } from '@shared/game/core/params'
import type { JsonObjectSchema, JsonSchema } from './schema'
import { checkKeys, registerSchemaSource } from './schemaSources'

export const EFFECT_SCOPE = 'effect'

export function effectPieceClasses(host: string = Effects.type): ComponentClass[] {
  return componentsFor(host)
}

export function paramSpecToSchema(spec: ParamSpec, includeDescription = true): JsonSchema {
  const desc = includeDescription && spec.description ? { description: spec.description } : {}
  if (spec.kind === 'number') {
    return { type: ['number', 'null'], ...desc }
  }
  if (spec.kind === 'flag') {
    return { type: ['boolean', 'null'], ...desc }
  }
  if (spec.kind === 'choice' && spec.choices?.length) {
    return { enum: [...spec.choices, null], ...desc }
  }
  if (spec.kind === 'formula') {
    return { type: ['string', 'number', 'null'], ...desc }
  }
  if (spec.kind === 'list') {
    return {
      oneOf: [{ type: 'null' }, { type: 'array', items: spec.of ? paramSpecToSchema(spec.of, includeDescription) : { type: 'string' } }],
      ...desc
    }
  }
  if (spec.kind === 'values') {
    return {
      oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { type: 'number' } }],
      ...desc
    }
  }
  if (spec.kind === 'components') {
    return {
      oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object' } }],
      ...desc
    }
  }
  return { type: ['string', 'null'], ...desc }
}

export function paramsSchema(params: ParamSchema): JsonObjectSchema {
  return { type: 'object', properties: Object.fromEntries(Object.entries(params).map(([key, spec]) => [key, paramSpecToSchema(spec)])) }
}

export function effectItemSchema(host: string = Effects.type): JsonSchema {
  const typeNames = effectPieceClasses(host).map((c) => c.type)
  return {
    type: 'object',
    properties: {
      type: typeNames.length ? { enum: typeNames } : { type: 'string' },
      on: { type: ['string', 'null'] }
    },
    additionalProperties: true,
    required: ['type']
  }
}

registerSchemaSource({
  id: EFFECT_SCOPE,
  entries: () =>
    effectPieceClasses().map((c) => {
      const own = paramsSchema(c.PARAMS)
      return {
        name: c.type,
        summary: c.DESCRIPTION,
        params: { ...own, properties: { ...own.properties, on: { type: ['string', 'null'] }, comps: { type: ['array', 'null'], items: { type: 'object' } } } }
      }
    })
})

export function checkEffectKeys(raw: unknown): void {
  for (const item of Array.isArray(raw) ? raw : []) {
    if (item && typeof item === 'object' && !Array.isArray(item) && typeof (item as { type?: unknown }).type === 'string') checkKeys(EFFECT_SCOPE, (item as { type: string }).type, item as Record<string, unknown>, ['type'])
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
