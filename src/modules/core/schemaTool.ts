import { schemaSources } from '../../engine/tools/schemaSources'
import { fieldGuide } from '../../engine/tools/signature'
import { moduleOnForAgent } from '../../engine/modules/isOn'
import type { JsonObjectSchema } from '../../engine/tools/schema'
import { ToolError, str, type ToolDef } from '../../engine/tools/types'

const onFor = (agentId: string | null) => (module: string) => moduleOnForAgent(module, agentId)

const scopeIds = (agentId: string | null): string[] => schemaSources().filter((s) => s.entries(onFor(agentId)).length).map((s) => s.id)

const inspectParams = (scopes: string[]): JsonObjectSchema => ({
  type: 'object',
  properties: {
    scope: scopes.length ? { enum: scopes } : { type: 'string' },
    names: { type: ['array', 'null'], items: { type: 'string' } }
  },
  required: ['scope']
})

export const INSPECT_SCHEMA: ToolDef = {
  name: 'inspect_schema',
  group: 'core',
  needsWorkspace: false,
  description: 'List the entries of a scope, or give the fields of the named ones.',
  params: inspectParams([]),
  forAgent: (scope) => ({ params: inspectParams(scopeIds(scope.agentId)) }),
  async execute(p, ctx) {
    const scope = str(p, 'scope')
    const source = schemaSources().find((s) => s.id === scope)
    if (!source) throw new ToolError(`No scope "${scope}". Scopes: ${scopeIds(ctx.agentId).join(', ')}.`)
    const entries = source.entries(onFor(ctx.agentId))
    const names = Array.isArray(p.names) ? p.names.filter((n): n is string => typeof n === 'string') : []
    if (!names.length) return entries.length ? entries.map((e) => `- ${e.name}: ${e.summary}`).join('\n') : 'None.'
    return names
      .map((n) => {
        const entry = entries.find((e) => e.name === n)
        if (!entry) throw new ToolError(`No ${n} in ${scope}. Entries: ${entries.map((e) => e.name).join(', ')}.`)
        return fieldGuide(entry.name, entry.summary, entry.params)
      })
      .join('\n')
  }
}
