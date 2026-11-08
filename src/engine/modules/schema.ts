import type { JsonObjectSchema, JsonSchema } from '../tools/schema'

type Json = Record<string, unknown>

const ANY: JsonSchema = { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] }
const PRIMITIVES = new Set(['string', 'number', 'integer', 'boolean', 'null'])

function described<T extends JsonSchema>(schema: T, source: Json): T {
  return typeof source.description === 'string' && source.description.trim() ? ({ ...schema, description: source.description.trim().slice(0, 400) } as T) : schema
}

function resolve(node: Json, root: Json): Json {
  let current = node
  for (let i = 0; i < 10 && typeof current.$ref === 'string'; i++) {
    const ref = current.$ref as string
    if (!ref.startsWith('#/')) return {}
    let target: unknown = root
    for (const part of ref.slice(2).split('/')) target = target && typeof target === 'object' ? (target as Json)[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined
    if (!target || typeof target !== 'object') return {}
    current = { ...(target as Json), ...(node.description ? { description: node.description } : {}) }
  }
  return current
}

function nullable(schema: JsonSchema): JsonSchema {
  return { oneOf: [schema, { type: 'null' }] }
}

function convert(input: unknown, root: Json, depth: number): JsonSchema {
  if (!input || typeof input !== 'object' || depth > 8) return ANY
  const node = resolve(input as Json, root)
  if (Array.isArray(node.enum)) {
    const values = node.enum.filter((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v)) as (string | number | boolean | null)[]
    if (values.length) return described({ enum: values }, node)
  }
  if ('const' in node && (node.const === null || ['string', 'number', 'boolean'].includes(typeof node.const))) return described({ const: node.const as string | number | boolean | null }, node)
  const options = (Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : null) as unknown[] | null
  if (options?.length) return described({ oneOf: options.slice(0, 8).map((o) => convert(o, root, depth + 1)) }, node)
  if (Array.isArray(node.allOf) && node.allOf.length) {
    const merged: Json = { type: 'object', properties: {}, required: [] }
    for (const part of node.allOf) {
      const p = resolve(part as Json, root)
      Object.assign(merged.properties as Json, p.properties ?? {})
      ;(merged.required as unknown[]).push(...((p.required as unknown[]) ?? []))
    }
    return convert({ ...merged, description: node.description }, root, depth + 1)
  }
  let type = node.type
  if (Array.isArray(type)) {
    const list = type.filter((t): t is string => typeof t === 'string')
    if (list.every((t) => PRIMITIVES.has(t))) return described({ type: list.map((t) => (t === 'integer' ? 'integer' : t)) } as JsonSchema, node)
    const others = list.filter((t) => t !== 'null')
    const inner = convert({ ...node, type: others[0] }, root, depth + 1)
    return list.includes('null') ? nullable(inner) : inner
  }
  if (!type) type = node.properties ? 'object' : node.items ? 'array' : undefined
  switch (type) {
    case 'string':
    case 'number':
    case 'integer':
    case 'boolean':
    case 'null':
      return described({ type } as JsonSchema, node)
    case 'array': {
      const out: Json = { type: 'array', items: node.items && !Array.isArray(node.items) ? convert(node.items, root, depth + 1) : ANY }
      if (typeof node.minItems === 'number') out.minItems = node.minItems
      if (typeof node.maxItems === 'number') out.maxItems = node.maxItems
      return described(out as JsonSchema, node)
    }
    case 'object':
      return objectOf(node, root, depth)
    default:
      return described(ANY, node)
  }
}

function objectOf(node: Json, root: Json, depth: number): JsonObjectSchema {
  const props = (node.properties && typeof node.properties === 'object' ? node.properties : {}) as Json
  const required = new Set(Array.isArray(node.required) ? node.required.map(String) : [])
  const properties: Record<string, JsonSchema> = {}
  for (const [key, value] of Object.entries(props)) {
    const converted = convert(value, root, depth + 1)
    properties[key] = required.has(key) ? converted : nullable(converted)
  }
  if (!Object.keys(properties).length && node.additionalProperties && typeof node.additionalProperties === 'object') {
    return described({ type: 'object', properties: {}, additionalProperties: convert(node.additionalProperties, root, depth + 1) } as JsonObjectSchema, node)
  }
  return described({ type: 'object', properties } as JsonObjectSchema, node)
}

export function toGrammarSchema(input: unknown): JsonObjectSchema {
  const root = (input && typeof input === 'object' ? input : {}) as Json
  return objectOf({ ...root, type: 'object' }, root, 0)
}

export function stripNulls(value: unknown, schema: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !schema || typeof schema !== 'object') return value
  const node = schema as Json
  const props = (node.properties ?? {}) as Json
  const required = new Set(Array.isArray(node.required) ? node.required.map(String) : [])
  const out: Json = {}
  for (const [key, v] of Object.entries(value as Json)) {
    if (v === null && !required.has(key)) continue
    out[key] = stripNulls(v, props[key])
  }
  return out
}
