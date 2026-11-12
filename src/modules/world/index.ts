import type { JsonSchema } from '../../engine/tools/schema'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optInt, optStr, str, type ToolDef } from '../../engine/tools/types'
import { WorldError, worlds } from '../../engine/worlds/store'
import { bindingFor, createRecord, editEntries, postBoard, readBoard, recall, remember, search, writeField } from '../../engine/worlds/ops'
import { resolveIncludes } from '../../engine/library/includes'
import type { Action, ActionCheck, ActionNeeds } from '@shared/actions'
import { cleanSwap } from '@shared/cardDecks'
import { cleanDecision } from '@shared/decisions'

export const SCALARS = { type: ['string', 'number', 'boolean', 'null'] } as const satisfies JsonSchema
export const NUMBERS = { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { type: ['string', 'number', 'null'] } }] } as const satisfies JsonSchema

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

const CARD_SWAP_SCHEMA = {
  type: 'object',
  properties: {
    add: { type: 'array', items: { type: 'string' } },
    remove: { type: 'array', items: { type: 'string' } }
  }
} as const

const DECISION_OPTION_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    cards: CARD_SWAP_SCHEMA
  },
  required: ['text']
} as const

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    options: { type: 'array', items: DECISION_OPTION_SCHEMA },
    own: { type: 'boolean' },
    decider: { type: ['string', 'null'] }
  },
  required: ['question', 'options']
} as const

const ACTION_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    against: { type: ['string', 'null'] },
    difficulty: { type: ['number', 'null'] },
    base: { type: ['number', 'null'] },
    pass: { type: ['string', 'null'] },
    fail: { type: ['string', 'null'] },
    passCards: CARD_SWAP_SCHEMA,
    failCards: CARD_SWAP_SCHEMA
  }
} as const

const ACTION_SCHEMA = {
  type: 'object',
  properties: {
    attempt: { type: 'string' },
    needs: { type: 'string' },
    by: { type: ['string', 'null'] },
    checks: { type: 'array', items: ACTION_CHECK_SCHEMA },
    pass: { type: 'string' },
    fail: { type: 'string' },
    passCards: CARD_SWAP_SCHEMA,
    failCards: CARD_SWAP_SCHEMA
  },
  required: ['attempt', 'pass', 'fail']
} as const

export function cleanActionCheck(raw: unknown): ActionCheck {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    against: typeof v.against === 'string' ? v.against : null,
    difficulty: typeof v.difficulty === 'number' ? v.difficulty : null,
    base: typeof v.base === 'number' ? v.base : null,
    pass: typeof v.pass === 'string' ? v.pass : null,
    fail: typeof v.fail === 'string' ? v.fail : null,
    passCards: cleanSwap(v.passCards),
    failCards: cleanSwap(v.failCards)
  }
}

export function cleanAction(raw: unknown): Action {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null)
  const checks = Array.isArray(v.checks) ? v.checks.map(cleanActionCheck) : []
  return {
    attempt: text(v.attempt) ?? 'Attempting an action...',
    needs: (v.needs as ActionNeeds) ?? 'none',
    by: text(v.by),
    checks,
    pass: text(v.pass) ?? '',
    fail: text(v.fail) ?? '',
    passCards: cleanSwap(v.passCards),
    failCards: cleanSwap(v.failCards)
  }
}

const tools: ToolDef[] = [
  // --- Participant / Player Tools ---
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
  },

  // --- Authoring / Builder Tools ---
  {
    name: 'world_create',
    group: 'world',
    needsWorkspace: false,
    description: 'Create a record. values maps field names to values (lists and logs take arrays of text).',
    params: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        id: { type: 'string' },
        values: { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { oneOf: [SCALARS, { type: 'array', items: { type: 'string' } }] } }] }
      }
    },
    async execute(p, ctx) {
      return guard(() => createRecord(bindingFor(ctx.agentId).worldId, str(p, 'type'), str(p, 'id'), (p.values && typeof p.values === 'object' ? p.values : {}) as Record<string, unknown>))
    }
  },
  {
    name: 'world_set_property',
    group: 'world',
    needsWorkspace: false,
    description: 'Set basic state attributes, descriptions, or values on any world record.',
    params: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Target entity type' },
        id: { type: 'string', description: 'Entity ID' },
        field: { type: 'string', description: 'Property field name (e.g., status, description, health)' },
        value: { oneOf: [SCALARS, { type: 'array', items: { type: 'string' } }] }
      },
      required: ['type', 'id', 'field', 'value']
    } as const,
    async execute(p, ctx) {
      return guard(() =>
        writeField(
          bindingFor(ctx.agentId).worldId,
          str(p, 'type'),
          str(p, 'id'),
          str(p, 'field'),
          { entries: null, weight: null, link: null, target: null, values: null, shift: null, value: p.value ?? null },
          null
        )
      )
    }
  },
  {
    name: 'world_add_action',
    group: 'world',
    needsWorkspace: false,
    description:
      'Attach interactive actions with skill/stat checks, pass/fail narrative outcomes, and card gains/losses to any object, place, or character in the world.',
    params: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Target entity type (e.g. place, object, character)' },
        id: { type: 'string', description: 'ID of the target entity' },
        field: { type: 'string', description: 'Record field name storing actions (e.g. actions)' },
        action: ACTION_SCHEMA,
        actions: { type: 'array', items: ACTION_SCHEMA }
      },
      required: ['type', 'id', 'field']
    } as const,
    async execute(p, ctx) {
      const actionsList = Array.isArray(p.actions) && p.actions.length > 0
        ? p.actions
        : p.action
          ? [p.action]
          : Array.isArray(p.actions)
            ? p.actions
            : null

      const actions = actionsList ? actionsList.map(cleanAction) : null

      return guard(() =>
        writeField(
          bindingFor(ctx.agentId).worldId,
          str(p, 'type'),
          str(p, 'id'),
          str(p, 'field'),
          { value: actions } as any,
          null
        )
      )
    }
  },
  {
    name: 'world_add_decision',
    group: 'world',
    needsWorkspace: false,
    description:
      'Attach branching decision points with clear options, decider rules (user vs. agent), and card swap outcomes to any place, object, or scene element.',
    params: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Target entity type (e.g. place, object, character)' },
        id: { type: 'string', description: 'ID of the target entity' },
        field: { type: 'string', description: 'Record field name storing decisions (e.g. decisions)' },
        decision: DECISION_SCHEMA,
        decisions: { type: 'array', items: DECISION_SCHEMA }
      },
      required: ['type', 'id', 'field']
    } as const,
    async execute(p, ctx) {
      const decisionsList = Array.isArray(p.decisions) && p.decisions.length > 0
        ? p.decisions
        : p.decision
          ? [p.decision]
          : Array.isArray(p.decisions)
            ? p.decisions
            : null

      const decisions = decisionsList ? decisionsList.map(cleanDecision) : null

      return guard(() =>
        writeField(
          bindingFor(ctx.agentId).worldId,
          str(p, 'type'),
          str(p, 'id'),
          str(p, 'field'),
          { value: decisions } as any,
          null
        )
      )
    }
  },
  {
    name: 'world_entries',
    group: 'world',
    needsWorkspace: false,
    description: "Add, edit, remove or clear entries in any record's list or log. Fixed entries are kept.",
    params: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        id: { type: 'string' },
        field: { type: 'string' },
        add: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }] },
        edit: { oneOf: [{ type: 'null' }, { type: 'object', properties: { index: { type: 'integer' }, text: { type: 'string' } } }] },
        remove: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'integer' } }] },
        clear: { type: ['boolean', 'null'] }
      }
    },
    async execute(p, ctx) {
      const edit = p.edit && typeof p.edit === 'object' ? (p.edit as { index: number; text: string }) : null
      return guard(() =>
        editEntries(bindingFor(ctx.agentId).worldId, str(p, 'type'), str(p, 'id'), str(p, 'field'), {
          add: Array.isArray(p.add) ? p.add.map(String) : null,
          edit,
          remove: Array.isArray(p.remove) ? p.remove.map(Number) : null,
          clear: p.clear === true
        })
      )
    }
  },
  {
    name: 'world_delete',
    group: 'world',
    needsWorkspace: false,
    permission: 'ask',
    description: 'Delete a record.',
    params: { type: 'object', properties: { type: { type: 'string' }, id: { type: 'string' } } },
    async execute(p, ctx) {
      const b = bindingFor(ctx.agentId)
      return guard(() => {
        if (!worlds.remove(b.worldId, str(p, 'type'), str(p, 'id'))) throw new ToolError(`There is no ${str(p, 'type')} "${str(p, 'id')}". Use world_search to find the right id.`)
        return 'Deleted.'
      })
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
