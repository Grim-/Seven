import type { JsonSchema } from './schema'
import type { ToolDef } from './types'

type Schema = Record<string, unknown>

const NULL = 'null'

function nullable(s: Schema): boolean {
  if (Array.isArray(s.type)) return (s.type as string[]).includes(NULL)
  if (Array.isArray(s.enum)) return s.enum.includes(null)
  if (Array.isArray(s.oneOf)) return (s.oneOf as Schema[]).some((o) => o.type === NULL || nullable(o))
  return false
}

export function paramType(schema: JsonSchema | undefined): string {
  if (!schema || typeof schema !== 'object') return 'value'
  const s = schema as Schema
  if (Array.isArray(s.enum)) return s.enum.filter((x) => x !== null).map((x) => JSON.stringify(x)).join(' | ')
  if (Array.isArray(s.oneOf)) return (s.oneOf as JsonSchema[]).map(paramType).filter((x) => x !== NULL).join(' | ')
  const type = Array.isArray(s.type) ? (s.type as string[]).filter((t) => t !== NULL).join(' | ') : String(s.type ?? 'value')
  if (type === 'array') return `[${paramType(s.items as JsonSchema)}, …]`
  if (type === 'object') {
    const keys = Object.keys((s.properties as Schema | undefined) ?? {})
    return keys.length ? `{${keys.join(', ')}}` : '{field: value}'
  }
  return type
}

function properties(tool: Pick<ToolDef, 'params'>): [string, Schema][] {
  return Object.entries(((tool.params as { properties?: Record<string, Schema> }).properties ?? {}) as Record<string, Schema>)
}

export function toolSignature(tool: Pick<ToolDef, 'name' | 'params'>): string {
  return `${tool.name}(${properties(tool).map(([k]) => k).join(', ')})`
}

function inner(s: Schema): [string, Schema][] {
  const real = Array.isArray(s.oneOf) ? ((s.oneOf as Schema[]).find((o) => o.type !== NULL) ?? s) : s
  const shape = real.type === 'array' ? ((real.items as Schema | undefined) ?? {}) : real
  return Object.entries(((shape.properties as Record<string, Schema> | undefined) ?? {}) as Record<string, Schema>)
}

function paramLines(entries: [string, Schema][], indent: string): string[] {
  return entries.flatMap(([k, v]) => {
    const d = typeof v.description === 'string' ? v.description : ''
    const line = `${indent}- ${k}: ${paramType(v as JsonSchema)}${nullable(v) ? ', or null' : ''}${d ? `. ${d}` : ''}`
    const sub = inner(v).filter(([, s]) => typeof s.description === 'string' || Array.isArray(s.enum) || Array.isArray(s.oneOf))
    return [line, ...paramLines(sub, `${indent}  `)]
  })
}

export function toolGuide(tool: Pick<ToolDef, 'name' | 'description' | 'params'>): string {
  return [`- ${toolSignature(tool)}: ${tool.description}`, ...paramLines(properties(tool), '  ')].join('\n')
}
