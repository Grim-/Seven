import type { ToolParamDoc } from '@shared/types'
import { noteFailure } from '../util/report'
import type { JsonObjectSchema, JsonSchema } from './schema'
import type { ToolDef } from './types'

type Schema = Record<string, unknown>

const NULL = 'null'
const MAX_PARAM_DEPTH = 5
const resolvingTools = new Set<string>()

function nullable(s: Schema): boolean {
  if (Array.isArray(s.type)) return (s.type as string[]).includes(NULL)
  if (Array.isArray(s.enum)) return s.enum.includes(null)
  if (Array.isArray(s.oneOf)) return (s.oneOf as Schema[]).some((o) => o.type === NULL || nullable(o))
  return false
}

export function resolveToolParams(tool: Pick<ToolDef, 'name' | 'params' | 'forAgent'>): JsonObjectSchema {
  if (!tool.forAgent || resolvingTools.has(tool.name)) return tool.params
  resolvingTools.add(tool.name)
  try {
    return tool.forAgent({ agentId: null, files: true }).params
  } catch (err) {
    noteFailure(err, 'tools', `Could not inspect live parameters for "${tool.name}"`)
    return tool.params
  } finally {
    resolvingTools.delete(tool.name)
  }
}

export function paramType(schema: JsonSchema | undefined): string {
  if (!schema || typeof schema !== 'object') return 'value'
  const s = schema as Schema
  if ('const' in s && s.const !== undefined) return JSON.stringify(s.const)
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

function properties(tool: Pick<ToolDef, 'name' | 'params' | 'forAgent'>): [string, Schema][] {
  const params = resolveToolParams(tool)
  return Object.entries(((params as { properties?: Record<string, Schema> }).properties ?? {}) as Record<string, Schema>)
}

export function toolSignature(tool: Pick<ToolDef, 'name' | 'params' | 'forAgent'>): string {
  return `${tool.name}(${properties(tool).map(([k]) => k).join(', ')})`
}

function formatChoice(value: unknown): string {
  return typeof value === 'string' ? value : String(value)
}

function collectChoices(schema: Schema): string[] {
  const seen = new Set<string>()
  const push = (vals: unknown[]) => {
    for (const v of vals) {
      if (v === null || v === undefined) continue
      seen.add(formatChoice(v))
    }
  }
  if ('const' in schema && schema.const !== undefined && schema.const !== null) {
    seen.add(formatChoice(schema.const))
  }
  if (Array.isArray(schema.enum)) push(schema.enum)
  const items = schema.items as Schema | undefined
  if (items) {
    if ('const' in items && items.const !== undefined && items.const !== null) seen.add(formatChoice(items.const))
    if (Array.isArray(items.enum)) push(items.enum)
  }
  if (Array.isArray(schema.oneOf)) {
    for (const option of schema.oneOf as Schema[]) {
      if (!option) continue
      if ('const' in option && option.const !== undefined && option.const !== null) seen.add(formatChoice(option.const))
      if (Array.isArray(option.enum)) push(option.enum)
    }
  }
  return [...seen]
}

function mergeChildDocs(groups: ToolParamDoc[][]): ToolParamDoc[] {
  if (groups.length === 0) return []
  if (groups.length === 1) return groups[0]
  const byName = new Map<string, { doc: ToolParamDoc; count: number; types: Set<string>; choices: Set<string>; descs: Set<string> }>()
  for (const list of groups) {
    for (const item of list) {
      let entry = byName.get(item.name)
      if (!entry) {
        entry = {
          doc: { ...item },
          count: 0,
          types: new Set([item.type]),
          choices: new Set(item.choices ?? []),
          descs: new Set(item.description ? [item.description] : [])
        }
        byName.set(item.name, entry)
      } else {
        entry.types.add(item.type)
        for (const c of item.choices ?? []) entry.choices.add(c)
        if (item.description) entry.descs.add(item.description)
        if (item.children?.length && !entry.doc.children?.length) entry.doc.children = item.children
      }
      entry.count += 1
      if (!item.required) entry.doc.required = false
      if (item.nullable) entry.doc.nullable = true
    }
  }
  return [...byName.values()].map(({ doc, count, types, choices, descs }) => ({
    ...doc,
    required: doc.required && count === groups.length,
    type: [...types].join(' | '),
    description: [...descs].join(' / '),
    ...(choices.size ? { choices: [...choices] } : {})
  }))
}

function childObjectsOf(schema: Schema): Schema[] {
  const out: Schema[] = []
  const inspect = (candidate: Schema) => {
    if (!candidate || typeof candidate !== 'object') return
    if (candidate.properties && typeof candidate.properties === 'object') {
      out.push(candidate)
      return
    }
    if (candidate.items && typeof candidate.items === 'object') {
      inspect(candidate.items as Schema)
      return
    }
    if (Array.isArray(candidate.oneOf)) {
      for (const option of candidate.oneOf as Schema[]) inspect(option)
    }
  }
  inspect(schema)
  return out
}

function extractParams(schema: Schema, depth: number): ToolParamDoc[] {
  if (depth >= MAX_PARAM_DEPTH) return []
  const props = (schema.properties as Record<string, Schema> | undefined) ?? {}
  const req = new Set(Array.isArray(schema.required) ? schema.required.filter((x): x is string => typeof x === 'string') : [])
  return Object.entries(props).map(([name, prop]) => {
    const isNullable = nullable(prop)
    const choices = collectChoices(prop)
    const variants = Array.isArray(prop.oneOf)
      ? (prop.oneOf as JsonSchema[])
          .filter((o) => (o as Schema)?.type !== NULL)
          .map(paramType)
      : []
    const childGroups = childObjectsOf(prop).map((obj) => extractParams(obj, depth + 1)).filter((g) => g.length > 0)
    const children = mergeChildDocs(childGroups)
    return {
      name,
      type: paramType(prop as JsonSchema),
      required: req.has(name) && !isNullable,
      nullable: isNullable,
      description: typeof prop.description === 'string' ? prop.description : '',
      ...(choices.length ? { choices } : {}),
      ...(variants.length > 1 ? { variants } : {}),
      ...(children.length ? { children } : {})
    }
  })
}

export function toolApiDoc(tool: Pick<ToolDef, 'name' | 'params' | 'forAgent'>): {
  signature: string
  params: ToolParamDoc[]
  schema: Record<string, unknown>
} {
  const schema = resolveToolParams(tool)
  return {
    signature: toolSignature({ name: tool.name, params: schema }),
    params: extractParams(schema as unknown as Schema, 0),
    schema: schema as unknown as Record<string, unknown>
  }
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

export function toolGuide(tool: Pick<ToolDef, 'name' | 'description' | 'params' | 'forAgent'>): string {
  const params = resolveToolParams(tool)
  return [`- ${toolSignature({ name: tool.name, params })}: ${tool.description}`, ...paramLines(properties({ name: tool.name, params }), '  ')].join('\n')
}
