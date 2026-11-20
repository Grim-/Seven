import type { JsonObjectSchema, JsonSchema } from './schema'
import { ToolError } from './types'

export interface SchemaEntry {
  name: string
  summary: string
  params: JsonObjectSchema
}

export interface SchemaSource {
  id: string
  entries(on: (module: string) => boolean): SchemaEntry[]
}

const sources = new Map<string, SchemaSource>()

export function registerSchemaSource(source: SchemaSource): void {
  sources.set(source.id, source)
}

export function schemaSources(): SchemaSource[] {
  return [...sources.values()]
}

function propertiesAt(schema: JsonSchema, path: readonly string[]): Record<string, JsonSchema> {
  return path.reduce<JsonSchema>((s, key) => s.properties?.[key] ?? {}, schema).properties ?? {}
}

export function checkKeys(scope: string, name: string, given: Record<string, unknown>, extra: readonly string[] = [], path: readonly string[] = []): void {
  const entry = sources.get(scope)?.entries(() => true).find((e) => e.name === name)
  if (!entry) return
  const known = [...extra, ...Object.keys(propertiesAt(entry.params, path))]
  const unknown = Object.keys(given).filter((k) => !known.includes(k))
  if (unknown.length) throw new ToolError(`${[name, ...path].join('.')} has no ${unknown.join(', ')}. Its fields: ${known.join(', ')}.`)
}
