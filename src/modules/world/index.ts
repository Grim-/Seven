import type { JsonSchema } from '../../engine/tools/schema'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optBool, optInt, optStr, str, type ToolDef } from '../../engine/tools/types'
import { effectDefListSchema, normalizeEffectDefs } from '../../engine/tools/effectSchema'
import { WorldError, worlds } from '../../engine/worlds/store'
import { secure } from '../../engine/util/secure'
import { bindingFor, bindingOrNull, createRecord, editEntries, postBoard, readBoard, recall, remember, search, writeField } from '../../engine/worlds/ops'
import { resolveIncludes } from '../../engine/library/includes'
import { factions } from '../../engine/factions/store'
import { lootTablesStore } from '../../engine/lootTables/store'
import { triggerActionsStore } from '../../engine/triggerActions/store'
import type { Action, ActionCheck, ActionNeeds } from '@shared/actions'
import { cleanSwap } from '@shared/cardDecks'
import { cleanDecision } from '@shared/decisions'
import { FACTION_STANCES, type FactionStance } from '@shared/game/factions'
import { toId } from '@shared/ids'
import { linkFor } from '@shared/text'
import { STARTER_SCHEMA } from '@shared/world'
import type { JsonObjectSchema } from '../../engine/tools/schema'
import './cardVariation'
import './targets'

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

function worldTypeSchema(agentId: string | null, nullable: boolean, live: boolean): JsonSchema {
  if (live && secure.unlocked) {
    const binding = bindingOrNull(agentId)
    if (binding) {
      const types = Object.keys(worlds.schema(binding.worldId).types)
      if (types.length) {
        return {
          enum: nullable ? [...types, null] : types,
          description: `World record type in this world: ${types.join(', ')}`
        }
      }
    }
    const known = [...new Set([...Object.keys(STARTER_SCHEMA.types), ...worlds.allTypeKeys()])]
    return {
      type: nullable ? ['string', 'null'] : 'string',
      description: `World record type key from the bound world schema (check the World section of your instructions; known types: ${known.join(', ')})`
    }
  }
  const starter = Object.keys(STARTER_SCHEMA.types)
  return {
    type: nullable ? ['string', 'null'] : 'string',
    description: `World record type key from the bound world schema (check the World section of your instructions; default: ${starter.join(', ')})`
  }
}

function withWorldTypes(
  base: Omit<ToolDef, 'params' | 'forAgent'>,
  nullable: boolean,
  props: (typeSchema: JsonSchema) => Record<string, JsonSchema>,
  required?: readonly string[]
): ToolDef {
  const build = (agentId: string | null, live: boolean): JsonObjectSchema => ({
    type: 'object',
    properties: props(worldTypeSchema(agentId, nullable, live)),
    ...(required?.length ? { required } : {})
  })
  return {
    ...base,
    params: build(null, false),
    forAgent: (scope) => ({ params: build(scope.agentId, true) })
  }
}

const tools: ToolDef[] = [
  // --- Participant / Player Tools ---
  withWorldTypes(
    {
      name: 'world_recall',
      group: 'world',
      needsWorkspace: false,
      description: 'Read a record: yours when type and id are null. field narrows it; query filters entries.',
      async execute(p, ctx) {
        return guard(() => resolveIncludes(recall(bindingFor(ctx.agentId), { type: optStr(p, 'type'), id: optStr(p, 'id'), field: optStr(p, 'field'), query: optStr(p, 'query'), sort: optStr(p, 'sort') }), { agentId: ctx.agentId }))
      }
    },
    true,
    (typeSchema) => ({
      type: typeSchema,
      id: { type: ['string', 'null'] },
      field: { type: ['string', 'null'] },
      query: { type: ['string', 'null'] },
      sort: { oneOf: [{ type: 'null' }, { enum: ['newest', 'oldest', 'weight'] }] }
    })
  ),
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
  withWorldTypes(
    {
      name: 'world_search',
      group: 'world',
      needsWorkspace: false,
      description: 'Find records by text in any field.',
      async execute(p, ctx) {
        return guard(() => search(bindingFor(ctx.agentId), str(p, 'query'), optStr(p, 'type'), optInt(p, 'limit')))
      }
    },
    true,
    (typeSchema) => ({ query: { type: 'string' }, type: typeSchema, limit: { type: ['integer', 'null'] } }),
    ['query']
  ),
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
  withWorldTypes(
    {
      name: 'world_create',
      group: 'world',
      needsWorkspace: false,
      description: 'Create a record. values maps field names to values (lists and logs take arrays of text).',
      async execute(p, ctx) {
        return guard(() => createRecord(bindingFor(ctx.agentId).worldId, str(p, 'type'), str(p, 'id'), (p.values && typeof p.values === 'object' ? p.values : {}) as Record<string, unknown>))
      }
    },
    false,
    (typeSchema) => ({
      type: typeSchema,
      id: { type: 'string' },
      values: { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { oneOf: [SCALARS, { type: 'array', items: { type: 'string' } }] } }] }
    }),
    ['type', 'id']
  ),
  withWorldTypes(
    {
      name: 'world_set_property',
      group: 'world',
      needsWorkspace: false,
      description: 'Set basic state attributes, descriptions, or values on any world record.',
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
    false,
    (typeSchema) => ({
      type: typeSchema,
      id: { type: 'string', description: 'Entity ID' },
      field: { type: 'string', description: 'Property field name (e.g., status, description, health)' },
      value: { oneOf: [SCALARS, { type: 'array', items: { type: 'string' } }] }
    }),
    ['type', 'id', 'field', 'value']
  ),
  withWorldTypes(
    {
      name: 'world_add_action',
      group: 'world',
      needsWorkspace: false,
      description:
        'Attach interactive actions with skill/stat checks, pass/fail narrative outcomes, and card gains/losses to any object, place, or character in the world.',
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
    false,
    (typeSchema) => ({
      type: typeSchema,
      id: { type: 'string', description: 'ID of the target entity' },
      field: { type: 'string', description: 'Record field name storing actions (e.g. actions)' },
      action: ACTION_SCHEMA,
      actions: { type: 'array', items: ACTION_SCHEMA }
    }),
    ['type', 'id', 'field']
  ),
  withWorldTypes(
    {
      name: 'world_add_decision',
      group: 'world',
      needsWorkspace: false,
      description:
        'Attach branching decision points with clear options, decider rules (user vs. agent), and card swap outcomes to any place, object, or scene element.',
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
    false,
    (typeSchema) => ({
      type: typeSchema,
      id: { type: 'string', description: 'ID of the target entity' },
      field: { type: 'string', description: 'Record field name storing decisions (e.g. decisions)' },
      decision: DECISION_SCHEMA,
      decisions: { type: 'array', items: DECISION_SCHEMA }
    }),
    ['type', 'id', 'field']
  ),
  withWorldTypes(
    {
      name: 'world_entries',
      group: 'world',
      needsWorkspace: false,
      description: "Add, edit, remove or clear entries in any record's list or log. Fixed entries are kept.",
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
    false,
    (typeSchema) => ({
      type: typeSchema,
      id: { type: 'string' },
      field: { type: 'string' },
      add: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }] },
      edit: { oneOf: [{ type: 'null' }, { type: 'object', properties: { index: { type: 'integer' }, text: { type: 'string' } } }] },
      remove: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'integer' } }] },
      clear: { type: ['boolean', 'null'] }
    }),
    ['type', 'id', 'field']
  ),
  withWorldTypes(
    {
      name: 'world_delete',
      group: 'world',
      needsWorkspace: false,
      permission: 'ask',
      description: 'Delete a record.',
      async execute(p, ctx) {
        const b = bindingFor(ctx.agentId)
        return guard(() => {
          if (!worlds.remove(b.worldId, str(p, 'type'), str(p, 'id'))) throw new ToolError(`There is no ${str(p, 'type')} "${str(p, 'id')}". Use world_search to find the right id.`)
          return 'Deleted.'
        })
      }
    },
    false,
    (typeSchema) => ({ type: typeSchema, id: { type: 'string' } }),
    ['type', 'id']
  ),
  {
    name: 'set_trigger_action',
    group: 'world',
    needsWorkspace: false,
    description: 'Create or update a reusable trigger action (@trigger_action:id) made of effect components.',
    params: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Trigger action name (new creates, existing updates)' },
        id: { type: ['string', 'null'], description: 'Optional explicit id' },
        description: { type: ['string', 'null'], description: 'What this trigger action does' },
        effects: { type: 'array', items: effectDefListSchema(false), description: 'Ordered effect components from registered ActionPiece/WorldPiece defs' },
        tags: { type: ['array', 'null'], items: { type: 'string' } }
      },
      required: ['name']
    },
    forAgent: () => ({
      params: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Trigger action name (new creates, existing updates)' },
          id: { type: ['string', 'null'], description: 'Optional explicit id' },
          description: { type: ['string', 'null'], description: 'What this trigger action does' },
          effects: { type: 'array', items: effectDefListSchema(true), description: 'Ordered effect components from registered ActionPiece/WorldPiece defs' },
          tags: { type: ['array', 'null'], items: { type: 'string' } }
        },
        required: ['name']
      }
    }),
    async execute(p) {
      const name = str(p, 'name').trim()
      const ref = optStr(p, 'id') ?? name
      const prev = triggerActionsStore.find(ref)
      const effects = 'effects' in p ? normalizeEffectDefs(p.effects, 'OnUse') : (prev?.effects ?? [])
      const tags = strings(p.tags) ?? prev?.tags ?? []
      const description = optStr(p, 'description') ?? prev?.description ?? ''
      const saved = triggerActionsStore.save(
        {
          id: prev?.id ?? (optStr(p, 'id') ? toId(optStr(p, 'id')!) : toId(name)),
          name,
          description,
          effects,
          tags,
          updatedAt: Date.now()
        },
        prev?.id ?? null
      )
      return `${prev ? 'Updated' : 'Created'} ${linkFor('trigger_action', saved.id)} (${saved.effects.length} effect${saved.effects.length === 1 ? '' : 's'}).`
    }
  },
  {
    name: 'set_faction',
    group: 'world',
    needsWorkspace: false,
    description: 'Create or update a world faction (@faction:id), its default stance, inter-faction relations, and tags.',
    params: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Faction name' },
        id: { type: ['string', 'null'], description: 'Optional explicit faction id' },
        description: { type: ['string', 'null'], description: 'Faction goals, tenets, and behavior' },
        defaultStance: { enum: [...FACTION_STANCES], description: 'Default stance toward unknown factions' },
        relations: {
          oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { enum: [...FACTION_STANCES] } }],
          description: 'Map of other faction ids to stance'
        },
        tags: { type: ['array', 'null'], items: { type: 'string' } }
      },
      required: ['name']
    },
    async execute(p) {
      const name = str(p, 'name').trim()
      const ref = optStr(p, 'id') ?? name
      const prev = factions.find(ref)
      const rawStance = optStr(p, 'defaultStance')
      const defaultStance: FactionStance =
        rawStance && (FACTION_STANCES as readonly string[]).includes(rawStance) ? (rawStance as FactionStance) : (prev?.defaultStance ?? 'neutral')
      const relPatch = object(p.relations)
      const relations: Record<string, FactionStance> = { ...(prev?.relations ?? {}) }
      if (relPatch) {
        for (const [k, v] of Object.entries(relPatch)) {
          if (typeof v === 'string' && (FACTION_STANCES as readonly string[]).includes(v)) {
            relations[toId(k)] = v as FactionStance
          }
        }
      }
      const saved = factions.save(
        {
          id: prev?.id ?? (optStr(p, 'id') ? toId(optStr(p, 'id')!) : toId(name)),
          name,
          description: optStr(p, 'description') ?? prev?.description ?? '',
          defaultStance,
          relations,
          tags: strings(p.tags) ?? prev?.tags ?? [],
          updatedAt: Date.now()
        },
        prev?.id ?? null
      )
      return `${prev ? 'Updated' : 'Created'} ${linkFor('faction', saved.id)} (default: ${saved.defaultStance}).`
    }
  },
  {
    name: 'set_loot_table',
    group: 'world',
    needsWorkspace: false,
    description: 'Create or update a weighted loot table (@loot_table:id) with dice roll count, item/gold/repo/nested-table entries, and optional guaranteed drops.',
    params: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Loot table name' },
        id: { type: ['string', 'null'], description: 'Optional explicit id' },
        description: { type: ['string', 'null'] },
        rolls: { type: ['string', 'null'], description: 'Number or dice formula for rolls, e.g. "1" or "1d3"' },
        unique: { type: ['boolean', 'null'], description: 'Prevent duplicate entry picks in the same roll' },
        tags: { type: ['array', 'null'], items: { type: 'string' } },
        entries: {
          oneOf: [
            { type: 'null' },
            {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { enum: ['item', 'gold', 'repo', 'table', 'nothing'] },
                  weight: { type: 'number', description: 'Relative weight (positive number)' },
                  itemId: { type: ['string', 'null'], description: 'Game item template id when type=item' },
                  quantity: { type: ['string', 'null'], description: 'Dice/count formula, e.g. "1" or "1d4"' },
                  gold: { type: ['string', 'null'], description: 'Gold dice formula when type=gold, e.g. "2d10"' },
                  repoId: { type: ['string', 'null'], description: 'Repo id when type=repo' },
                  tableId: { type: ['string', 'null'], description: 'Nested loot table id when type=table' },
                  label: { type: ['string', 'null'] }
                },
                required: ['type', 'weight']
              }
            }
          ]
        }
      },
      required: ['name']
    },
    async execute(p) {
      const name = str(p, 'name').trim()
      const ref = optStr(p, 'id') ?? name
      const prev = lootTablesStore.find(ref)
      const unique = optBool(p, 'unique')
      const saved = lootTablesStore.save(
        {
          id: prev?.id ?? (optStr(p, 'id') ? toId(optStr(p, 'id')!) : toId(name)),
          name,
          description: optStr(p, 'description') ?? prev?.description ?? '',
          rolls: optStr(p, 'rolls') ?? prev?.rolls ?? '1',
          unique: unique !== null ? unique : (prev?.unique ?? false),
          entries: Array.isArray(p.entries) ? p.entries : (prev?.entries ?? []),
          guaranteed: prev?.guaranteed,
          tags: strings(p.tags) ?? prev?.tags ?? [],
          updatedAt: Date.now()
        },
        prev?.id ?? null
      )
      return `${prev ? 'Updated' : 'Created'} ${linkFor('loot_table', saved.id)} (${saved.entries.length} entries, ${saved.rolls} rolls).`
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
