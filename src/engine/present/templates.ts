import fs from 'node:fs'
import path from 'node:path'
import type { GbnfJsonSchema } from 'node-llama-cpp'
import type { TemplateField, TemplateSpec } from '../modules/manifest'
import { ToolError, type ToolDef } from '../tools/types'
import { presentationTool } from './define'

const MAX_TEMPLATE = 200 * 1024

function schemaOf(field: TemplateField): GbnfJsonSchema {
  const description = field.description || undefined
  if (field.type === 'list') {
    const list = { type: 'array' as const, items: { type: 'string' as const } }
    return field.optional ? { oneOf: [{ type: 'null' }, list], description } : { ...list, description }
  }
  const type = field.type === 'number' ? 'number' : field.type === 'boolean' ? 'boolean' : 'string'
  return { type: field.optional ? [type, 'null'] : type, description } as GbnfJsonSchema
}

export function templateTool(moduleId: string, dir: string, spec: TemplateSpec): ToolDef {
  const file = path.join(dir, spec.template)
  return presentationTool({
    type: spec.type,
    group: moduleId,
    description: spec.description || `Show a ${spec.type.replace(/_/g, ' ')}.`,
    fields: Object.fromEntries(Object.entries(spec.fields).map(([name, f]) => [name, schemaOf(f)])),
    check: (values) => {
      for (const [name, f] of Object.entries(spec.fields)) {
        const v = values[name]
        if (!f.optional && (v === null || v === undefined || v === '')) throw new ToolError(`present_${spec.type} needs ${name}${f.description ? ` (${f.description})` : ''}. Call it again with ${name} filled in.`)
      }
    },
    title: (values) => {
      const first = Object.values(values).find((v) => typeof v === 'string' && v.trim())
      return typeof first === 'string' ? first.slice(0, 60) : spec.type
    },
    as: (values) => {
      if (path.relative(dir, file).startsWith('..')) throw new ToolError(`present_${spec.type} is broken: its add-on's template file is outside the add-on folder. Tell the user, and show this another way.`)
      let html: string
      try {
        html = fs.readFileSync(file, 'utf8')
      } catch {
        throw new ToolError(`present_${spec.type} is broken: its template file ${spec.template} is missing from its add-on folder. Tell the user, and show this another way.`)
      }
      if (html.length > MAX_TEMPLATE) throw new ToolError(`present_${spec.type} is broken: its template file ${spec.template} is over 200 KB. Tell the user, and show this another way.`)
      return { type: 'template', fields: { name: spec.type, html, values } }
    }
  })
}
