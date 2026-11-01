import type { GbnfJsonSchema } from 'node-llama-cpp'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optInt, optStr, str, type ToolDef } from '../../engine/tools/types'
import { WorldError } from '../../engine/worlds/store'
import { bindingFor, postBoard, readBoard, recall, remember, search } from '../../engine/worlds/ops'
import { resolveIncludes } from '../../engine/library/includes'

export const SCALARS = { type: ['string', 'number', 'boolean', 'null'] } as const satisfies GbnfJsonSchema
export const NUMBERS = { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { type: ['string', 'number', 'null'] } }] } as const satisfies GbnfJsonSchema

export function guard<T>(fn: () => T): T {
  try {
    return fn()
  } catch (err) {
    if (err instanceof WorldError) throw new ToolError(err.message)
    throw err
  }
}

const strings = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v.trim() ? [v] : null)
const object = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)

const tools: ToolDef[] = [
  {
    name: 'world_recall',
    group: 'world',
    needsWorkspace: false,
    description: 'Read a record: yours when type and id are null. field narrows it; query filters entries.',
    params: {
      type: 'object',
      properties: {
        type: { type: ['string', 'null'] },
        id: { type: ['string', 'null'] },
        field: { type: ['string', 'null'] },
        query: { type: ['string', 'null'] },
        sort: { oneOf: [{ type: 'null' }, { enum: ['newest', 'oldest', 'weight'] }] }
      }
    },
    async execute(p, ctx) {
      return guard(() => resolveIncludes(recall(bindingFor(ctx.agentId), { type: optStr(p, 'type'), id: optStr(p, 'id'), field: optStr(p, 'field'), query: optStr(p, 'query'), sort: optStr(p, 'sort') }), { agentId: ctx.agentId }))
    }
  },
  {
    name: 'world_remember',
    group: 'world',
    needsWorkspace: false,
    description: 'Change your own record. Lists and logs: entries (and weight / link). Maps: target with values and/or shift. Other fields: value.',
    params: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        entries: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }] },
        weight: { type: ['integer', 'null'] },
        link: { type: ['string', 'null'] },
        target: { type: ['string', 'null'] },
        values: NUMBERS,
        shift: NUMBERS,
        value: { oneOf: [SCALARS, { type: 'array', items: { type: 'string' } }] }
      }
    },
    async execute(p, ctx) {
      return guard(() =>
        remember(bindingFor(ctx.agentId), str(p, 'field'), {
          entries: strings(p.entries),
          weight: optInt(p, 'weight'),
          link: optStr(p, 'link'),
          target: optStr(p, 'target'),
          values: object(p.values),
          shift: object(p.shift),
          value: p.value ?? null
        })
      )
    }
  },
  {
    name: 'world_search',
    group: 'world',
    needsWorkspace: false,
    description: 'Find records by text in any field.',
    params: { type: 'object', properties: { query: { type: 'string' }, type: { type: ['string', 'null'] }, limit: { type: ['integer', 'null'] } } },
    async execute(p, ctx) {
      return guard(() => search(bindingFor(ctx.agentId), str(p, 'query'), optStr(p, 'type'), optInt(p, 'limit')))
    }
  },
  {
    name: 'world_post',
    group: 'world',
    needsWorkspace: false,
    description: 'Post to the shared board, signed as you. to is a record id, or null for everyone.',
    params: { type: 'object', properties: { message: { type: 'string' }, to: { type: ['string', 'null'] } } },
    async execute(p, ctx) {
      return guard(() => postBoard(bindingFor(ctx.agentId), str(p, 'message'), optStr(p, 'to')))
    }
  },
  {
    name: 'world_board',
    group: 'world',
    needsWorkspace: false,
    description: 'Read the latest board posts, optionally only those matching query.',
    params: { type: 'object', properties: { limit: { type: ['integer', 'null'] }, query: { type: ['string', 'null'] } } },
    async execute(p, ctx) {
      return guard(() => readBoard(bindingFor(ctx.agentId), optInt(p, 'limit'), optStr(p, 'query')))
    }
  }
]

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(add: { add(tool: ToolDef): void }): void {
      for (const t of tools) add.add(t)
    }
  }

export default factory
