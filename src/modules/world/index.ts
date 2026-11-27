import type { JsonSchema } from '../../engine/tools/schema'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optBool, optInt, optStr, str, type ToolDef } from '../../engine/tools/types'
import { checkEffectKeys, effectItemSchema, normalizeEffectDefs } from '../../engine/tools/effectSchema'
import { checkKeys, registerSchemaSource } from '../../engine/tools/schemaSources'
import { WorldError, worlds } from '../../engine/worlds/store'
import { secure } from '../../engine/util/secure'
import { bindingFor, bindingOrNull, createRecord, editEntries, postBoard, readBoard, recall, remember, search, writeField } from '../../engine/worlds/ops'
import { resolveIncludes } from '../../engine/library/includes'
import { factions } from '../../engine/factions/store'
import { grantKnowledge, knowledge } from '../../engine/worlds/knowledge'
import { campaignOf } from '../../engine/library/holds'
import { findSheet, getSheet } from '../../engine/library/sheets'
import { knowledgeRef, splitKnowledgeRef } from '@shared/worldKnowledge'
import { lootTablesStore } from '../../engine/lootTables/store'
import { triggerActionsStore } from '../../engine/triggerActions/store'
import { almanacs } from '../../engine/almanac/store'
import { npcs } from '../../engine/worlds/npcs'
import { stampNpcs } from '../../engine/worlds/npcStamp'
import { worldEvents } from '../../engine/worlds/events'
import { saves } from '../../engine/worlds/saves'
import { advanceWorldTime, clockOf } from '../../engine/worlds/time'
import { sessionAccess } from '../../engine/sessions/access'
import { sessionWorld } from '../../engine/worlds/chatWorld'
import { formatAlmanacClock, formatAlmanacTime } from '@shared/almanac'
import { npcActorId } from '@shared/worldNpcs'
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

const WORLD_SCOPE = 'world'
const WORLD_ACTION = 'action'
const WORLD_DECISION = 'decision'

registerSchemaSource({
  id: WORLD_SCOPE,
  entries: (on) =>
    on('world')
      ? [
          { name: WORLD_ACTION, summary: 'world_add_action item', params: ACTION_SCHEMA },
          { name: WORLD_DECISION, summary: 'world_add_decision item', params: DECISION_SCHEMA }
        ]
      : []
})

function checkedItem(name: string, raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) checkKeys(WORLD_SCOPE, name, raw as Record<string, unknown>)
  return raw
}

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
        const actions = Array.isArray(p.actions) ? p.actions.map((a) => cleanAction(checkedItem(WORLD_ACTION, a))) : null

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
      actions: { type: 'array', items: { type: 'object' }, description: `fields: inspect_schema(${WORLD_SCOPE}, ${WORLD_ACTION})` }
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
        const decisions = Array.isArray(p.decisions) ? p.decisions.map((d) => cleanDecision(checkedItem(WORLD_DECISION, d))) : null

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
      decisions: { type: 'array', items: { type: 'object' }, description: `fields: inspect_schema(${WORLD_SCOPE}, ${WORLD_DECISION})` }
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
        effects: { type: 'array', items: effectItemSchema(), description: 'Ordered effect pieces; fields: inspect_schema(effect, <type>)' },
        tags: { type: ['array', 'null'], items: { type: 'string' } }
      },
      required: ['name']
    },
    async execute(p) {
      const name = str(p, 'name').trim()
      const ref = optStr(p, 'id') ?? name
      const prev = triggerActionsStore.find(ref)
      if ('effects' in p) checkEffectKeys(p.effects)
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
    name: 'record_world_knowledge',
    group: 'world',
    needsWorkspace: false,
    description: 'Write a new piece of world knowledge (@knowledge): lore, a magic system, a belief, a custom or a secret that is true in this world. Global knowledge is known by every character in the world; local knowledge only by the characters that are given it. Link places, people and pages in the text with @ links. Existing knowledge is only changed by the user.',
    params: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name, e.g. "The Veil"' },
        text: { type: 'string', description: 'What is true, written to stand on its own' },
        scope: { enum: ['global', 'local'], description: "'global': every character in the world knows it; 'local': only characters given it" },
        tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Topic keywords that bring it to mind' },
        world: { type: ['string', 'null'], description: 'World id; defaults to the world this chat is in' }
      },
      required: ['name', 'text', 'scope']
    },
    async execute(p, ctx) {
      const world = optStr(p, 'world') ?? bindingOrNull(ctx.agentId)?.worldId
      if (!world) throw new ToolError('This chat is not in a world. Pass world with the world id.')
      const name = str(p, 'name').trim()
      if (knowledge.find(world, name)) throw new ToolError(`${name} is already known in ${world}. Only the user changes existing knowledge.`)
      const saved = guard(() => knowledge.save(world, { name, text: str(p, 'text'), scope: str(p, 'scope'), tags: strings(p.tags) ?? [] }))
      return `Recorded @world:${world}/knowledge/${saved.id} (${saved.scope}).`
    }
  },
  {
    name: 'grant_knowledge',
    group: 'world',
    needsWorkspace: false,
    description: "Give a character a piece of local world knowledge (@knowledge) they have just come to know, by being told, reading, or finding out for themselves. In a campaign it is kept with that campaign. Global knowledge is already known by everyone in the world.",
    params: {
      type: 'object',
      properties: {
        sheet: { type: 'string', description: 'The character who now knows it' },
        knowledge: { type: 'string', description: 'The knowledge: @knowledge:world/entry, or its name in this chat\'s world' },
        source: { type: ['string', 'null'], description: 'Who or what they learned it from, if anyone or anything (a person, a book); null when they found it out themselves' }
      },
      required: ['sheet', 'knowledge']
    },
    async execute(p, ctx) {
      const raw = str(p, 'knowledge')
      const parts = splitKnowledgeRef(raw)
      const world = parts?.world ?? bindingOrNull(ctx.agentId)?.worldId ?? sessionWorld(ctx.sessionId, ctx.agentId)
      const sheet = findSheet(str(p, 'sheet'), world)
      if (!sheet) throw new ToolError(`No character or world NPC "${str(p, 'sheet')}". find with kind sheet or world lists them.`)
      if (!world) throw new ToolError('Pass the knowledge as @knowledge:world/entry; this chat is not in a world.')
      const entry = guard(() => knowledge.find(world, parts?.id ?? raw))
      if (!entry) throw new ToolError(`No knowledge ${raw} in ${world}. find with kind knowledge lists it.`)
      if (entry.scope === 'global') return `${entry.name} is global: everyone in ${world} already knows it.`
      const ref = knowledgeRef(world, entry.id)
      const campaign = campaignOf(ctx.sessionId)
      const title = getSheet(sheet).title
      if (!grantKnowledge(sheet, campaign, ref, { source: optStr(p, 'source'), where: sessionAccess.get(ctx.sessionId)?.scene?.where ?? '' })) return `${title} already knows ${entry.name}.`
      return `${title} now knows @world:${world}/knowledge/${entry.id}${campaign ? ' in this campaign' : ''}.`
    }
  },
  {
    name: 'set_faction',
    group: 'world',
    needsWorkspace: false,
    description: 'Create or update a world faction (@faction:world/id), its default stance, inter-faction relations, and tags.',
    params: {
      type: 'object',
      properties: {
        world: { type: ['string', 'null'], description: 'Target world id (defaults to the current scene world)' },
        name: { type: 'string', description: 'Faction name' },
        id: { type: ['string', 'null'], description: 'Optional explicit faction id' },
        description: { type: ['string', 'null'], description: 'Faction goals, tenets, and behavior' },
        defaultStance: { enum: [...FACTION_STANCES], description: 'Default stance toward unknown factions' },
        relations: {
          oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { enum: [...FACTION_STANCES] } }],
          description: 'Map of other faction ids to stance'
        },
        relationNotes: {
          oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { type: 'string' } }],
          description: 'Map of other faction ids to a short reason or history behind the stance; an empty string removes one'
        },
        tags: { type: ['array', 'null'], items: { type: 'string' } }
      },
      required: ['name']
    },
    async execute(p, ctx) {
      const world = optStr(p, 'world') ?? bindingOrNull(ctx.agentId)?.worldId ?? sessionWorld(ctx.sessionId, ctx.agentId) ?? worlds.list()[0]?.id ?? null
      if (!world) throw new ToolError('Pass a world id for this faction.')
      const name = str(p, 'name').trim()
      const ref = optStr(p, 'id') ?? name
      const prev = factions.find(ref, world)
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
      const notePatch = object(p.relationNotes)
      const relationNotes: Record<string, string> = { ...(prev?.relationNotes ?? {}) }
      if (notePatch) {
        for (const [k, v] of Object.entries(notePatch)) {
          if (typeof v !== 'string') continue
          if (v.trim()) relationNotes[toId(k)] = v.trim()
          else delete relationNotes[toId(k)]
        }
      }
      const saved = factions.save(
        {
          ...prev,
          id: prev?.id ?? (optStr(p, 'id') ? toId(optStr(p, 'id')!) : toId(name)),
          name,
          description: optStr(p, 'description') ?? prev?.description ?? '',
          defaultStance,
          relations,
          relationNotes,
          tags: strings(p.tags) ?? prev?.tags ?? [],
          updatedAt: Date.now()
        },
        world,
        prev?.id ?? null
      )
      return `${prev ? 'Updated' : 'Created'} @world:${world}/faction/${saved.id} (default: ${saved.defaultStance}).`
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
  },
  {
    name: 'almanac_log',
    group: 'world',
    needsWorkspace: false,
    description:
      'Record a chronicle event (combat, travel, milestone, world event) or update a story thread on the active Almanac (@almanac:id) and optionally advance the world clock.',
    params: {
      type: 'object',
      properties: {
        almanac: { type: ['string', 'null'], description: 'Almanac id or title (defaults to the current chat scene Almanac)' },
        title: { type: 'string', description: 'Event title' },
        tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Optional tags for this scene/event' },
        summary: { type: ['string', 'null'], description: 'Concise summary of what happened' },
        outcome: { type: ['string', 'null'], description: 'Mechanical or narrative outcome' },
        secret: { type: ['string', 'null'], description: 'Optional hidden/GM note (omitted from #public reads and newspapers)' },
        where: { type: ['string', 'null'], description: 'Location ref, e.g. @world:<world>/place/<key>' },
        who: { type: ['array', 'null'], items: { type: 'string' }, description: 'Participants, e.g. ["@sheet:kaelen"]' },
        advanceMinutes: { type: ['integer', 'number', 'null'], description: 'Minutes to advance the Almanac world clock before logging' }
      },
      required: ['title']
    },
    async execute(p, ctx) {
      const sessionScene = ctx.sessionId ? sessionAccess.get(ctx.sessionId)?.scene : null
      const ref = optStr(p, 'almanac') ?? sessionScene?.almanacId ?? almanacs.list()[0]?.id
      if (!ref) throw new ToolError('No Almanac specified and no Almanac is bound to this chat.')
      let alm = almanacs.find(ref)
      if (!alm) {
        alm = almanacs.save({ title: ref, currentTime: 8 * 3600 })
      }
      const advMins = optInt(p, 'advanceMinutes')
      if (advMins && advMins > 0) {
        alm = almanacs.advanceClock(alm.id, advMins * 60)
      }
      const tags = strings(p.tags) ?? []
      const where = optStr(p, 'where') ?? sessionScene?.where ?? ''
      const who = strings(p.who) ?? sessionScene?.characters ?? []
      const { almanac: saved, entry } = almanacs.recordEntry(alm.id, {
        kind: 'scene',
        ...(tags.length ? { tags } : {}),
        title: str(p, 'title'),
        summary: optStr(p, 'summary') ?? '',
        outcome: optStr(p, 'outcome') ?? '',
        ...(optStr(p, 'secret') ? { secret: optStr(p, 'secret')! } : {}),
        where,
        who
      })
      return `Logged "${entry.title}" on ${linkFor('almanac', saved.id)} at ${formatAlmanacTime(entry.when)} (#${entry.when.seq}, clock now ${formatAlmanacClock(saved.currentTime)}).`
    }
  },
  {
    name: 'resolve_world_event',
    group: 'world',
    needsWorkspace: false,
    description:
      'Resolves an active world event in the current save (either picking a specific outcomeId or letting its scored factors decide), executing its world-mutation pieces and logging to the Almanac.',
    params: {
      type: 'object',
      properties: {
        event: { type: 'string', description: 'World event id or @world:<world>/event/<id> link' },
        outcomeId: { type: ['string', 'null'], description: 'Optional specific outcome id; omit/null to score by current save flags and participant power' },
        summary: { type: ['string', 'null'], description: 'Optional secret aftermath summary recorded in the Almanac' },
        world: { type: ['string', 'null'], description: 'World id; defaults to the current scene world' }
      },
      required: ['event']
    },
    async execute(p, ctx) {
      const raw = str(p, 'event').trim()
      const world =
        optStr(p, 'world') ??
        (raw.includes('/') ? raw.replace(/^@?world:/i, '').split('/')[0] : null) ??
        bindingOrNull(ctx.agentId)?.worldId ??
        sessionWorld(ctx.sessionId, ctx.agentId) ??
        null
      const resolved = worldEvents.resolve(raw, {
        worldId: world,
        outcomeId: optStr(p, 'outcomeId') ?? null,
        transcriptSummary: optStr(p, 'summary') ?? null
      })
      return `Resolved "${resolved.title}" → ${resolved.resolution?.outcomeLabel ?? 'done'}.`
    }
  },
  {
    name: 'advance_world_time',
    group: 'world',
    needsWorkspace: false,
    description:
      'Advances the world clock forward in narrative leaps (rounds, minutes, hours, or days) for the active save and syncs bound Almanacs. Use only when meaningful story time passes (travel, waiting, nightfall, time skips)—do not call every turn.',
    params: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Positive amount of time to advance.' },
        unit: {
          type: 'string',
          enum: ['rounds', 'minutes', 'hours', 'days'],
          description: 'Time unit for the leap (defaults to minutes).'
        },
        reason: { type: ['string', 'null'], description: 'Optional short reason (e.g. "travel to harbor", "nightfall").' },
        world: { type: ['string', 'null'], description: 'World id; defaults to the current scene world.' }
      },
      required: ['amount']
    },
    async execute(p, ctx) {
      const amount = Number(p.amount)
      if (!Number.isFinite(amount) || amount <= 0) throw new ToolError('amount must be a positive number.')
      const unit = optStr(p, 'unit')?.toLowerCase() ?? 'minutes'
      const scene = sessionAccess.get(ctx.sessionId)?.scene
      const worldId =
        optStr(p, 'world') ??
        sessionWorld(ctx.sessionId, ctx.agentId) ??
        null
      const save =
        (scene?.saveId ? saves.read(scene.saveId) : null) ??
        (worldId ? saves.current(worldId) : null)
      if (!save) throw new ToolError('No active world save found to advance time on.')
      const def = clockOf(save)
      const unitSeconds: Record<string, number> = {
        rounds: def.roundSeconds,
        minutes: 60,
        hours: def.clock.hourSeconds,
        days: def.clock.hourSeconds * def.clock.hoursPerDay
      }
      const mult = unitSeconds[unit]
      if (!mult) throw new ToolError(`Unknown time unit "${unit}". Use rounds, minutes, hours, or days.`)
      const seconds = Math.max(1, Math.round(amount * mult))
      const reason = optStr(p, 'reason') ?? `narrative_${unit}`
      const activeNpcIds = npcs
        .list(save.world, 'play')
        .filter((n) => !n.archetype && Boolean(n.game))
        .map((n) => npcActorId(save.world, n.id))
      const saved = guard(() => advanceWorldTime(save.id, seconds, reason, [...Object.keys(save.characters), ...activeNpcIds]))
      return `Advanced world time by ${amount} ${unit}${optStr(p, 'reason') ? ` (${optStr(p, 'reason')})` : ''}. Clock is now ${formatAlmanacClock(saved.clock.time)}.`
    }
  },
  {
    name: 'world_upsert_npc',
    group: 'world',
    needsWorkspace: false,
    description:
      'Creates or updates a world-bound NPC or Archetype inside the world (`@world:<world>/npc/<id>`), keeping the user\'s global Characters library clean. Supports `@repo:...:roll` and `#random` tokens on Archetypes and `@repo:...:value` dynamic fields.',
    params: {
      type: 'object',
      properties: {
        world: { type: ['string', 'null'], description: 'World id; defaults to the bound or active scene world.' },
        id: { type: ['string', 'null'], description: 'Optional NPC id (slug) to update; omit/null to create.' },
        name: { type: 'string', description: 'NPC or Archetype name (may include @repo:...:roll on archetypes).' },
        archetype: { type: ['boolean', 'null'], description: 'True to store as a reusable Archetype template rather than a unique individual.' },
        place: { type: ['string', 'null'], description: 'Optional place key in this world where a unique NPC is stationed.' },
        faction: { type: ['string', 'null'], description: 'Optional faction id.' },
        disposition: { type: ['string', 'null'], enum: ['hostile', 'neutral', 'friendly', null] },
        values: { type: ['object', 'null'], additionalProperties: { type: 'string' }, description: 'Sheet card fields to set (e.g. Identity, Appearance, Speech, Demeanor).' },
        doing: { type: ['string', 'null'], description: 'What they are doing right now.' },
        goal: { type: ['string', 'null'], description: 'Immediate goal or motive.' },
        mood: { type: ['string', 'null'], description: 'Current mood or emotional state.' },
        howItThinks: { type: ['string', 'null'], description: 'Mindset and decision-making heuristics.' },
        voiceConstraints: { type: ['string', 'null'], description: 'Speech style and voice constraints.' }
      },
      required: ['name']
    },
    async execute(p, ctx) {
      const worldId =
        optStr(p, 'world') ??
        bindingOrNull(ctx.agentId)?.worldId ??
        sessionWorld(ctx.sessionId, ctx.agentId) ??
        null
      if (!worldId) throw new ToolError('Specify `world` or run inside a world-bound session.')
      const rawId = optStr(p, 'id')
      const existing = rawId ? npcs.find(rawId, worldId, 'template') : null
      const valuesPatch = object(p.values)
      const nextValues: Record<string, string> = { ...(existing?.values ?? {}) }
      const nextFields = [...(existing?.fields ?? [])]
      if (valuesPatch) {
        for (const [k, v] of Object.entries(valuesPatch)) {
          const key = k.trim()
          if (!key) continue
          nextValues[key] = String(v ?? '')
          if (!nextFields.includes(key)) nextFields.push(key)
        }
      }
      const placeKey = optStr(p, 'place')?.replace(/^@world:[^/]+\/place\//i, '').trim() || null
      const where =
        placeKey !== null
          ? `@world:${worldId}/place/${placeKey}`
          : (existing?.story.where ?? '')
      const saved = guard(() =>
        npcs.saveTemplate(
          worldId,
          {
            ...(existing ?? {}),
            ...(rawId ? { id: rawId } : {}),
            title: str(p, 'name'),
            ...(optBool(p, 'archetype') !== null ? { archetype: optBool(p, 'archetype')! } : {}),
            ...(p.faction !== undefined ? { faction: optStr(p, 'faction') } : {}),
            ...(optStr(p, 'disposition') ? { disposition: optStr(p, 'disposition') } : {}),
            ...(nextFields.length ? { fields: nextFields } : {}),
            values: nextValues,
            story: {
              ...(existing?.story ?? { where: '', threads: [], sessions: [] }),
              where,
              ...(optStr(p, 'doing') !== null ? { doing: optStr(p, 'doing')! } : {}),
              ...(optStr(p, 'goal') !== null ? { goal: optStr(p, 'goal')! } : {}),
              ...(optStr(p, 'mood') !== null ? { mood: optStr(p, 'mood')! } : {})
            },
            mind: {
              ...(existing?.mind ?? {}),
              ...(optStr(p, 'howItThinks') !== null ? { howItThinks: optStr(p, 'howItThinks')! } : {}),
              ...(optStr(p, 'voiceConstraints') !== null ? { voiceConstraints: optStr(p, 'voiceConstraints')! } : {})
            }
          },
          existing?.id ?? null
        )
      )
      return `Saved ${saved.archetype ? 'World Archetype' : 'World NPC'} "${saved.title}" (@world:${worldId}/npc/${saved.id}).`
    }
  },
  {
    name: 'world_stamp_npc',
    group: 'world',
    needsWorkspace: false,
    description:
      'Stamps 1..N individual NPC instances from a World Archetype (`@world:<world>/npc/<id>`) or Bestiary creature into the active Save, rolling `:roll` and `#random` fields once per individual.',
    params: {
      type: 'object',
      properties: {
        world: { type: ['string', 'null'], description: 'World id; defaults to the active scene world.' },
        target: { type: 'string', description: 'Archetype id/link (`@world:<w>/npc/<id>`) or Bestiary creature id.' },
        count: { type: ['integer', 'null'], description: 'Number of individuals to stamp (1..25, default 1).' },
        name: { type: ['string', 'null'], description: 'Optional name override (supports `@repo:...:roll`).' },
        place: { type: ['string', 'null'], description: 'Optional place key in this world to station them at.' },
        map: { type: ['string', 'null'], description: 'Optional map id.' },
        faction: { type: ['string', 'null'], description: 'Optional faction id override.' },
        disposition: { type: ['string', 'null'], enum: ['hostile', 'neutral', 'friendly', null] }
      },
      required: ['target']
    },
    async execute(p, ctx) {
      const worldId =
        optStr(p, 'world') ??
        bindingOrNull(ctx.agentId)?.worldId ??
        sessionWorld(ctx.sessionId, ctx.agentId) ??
        null
      if (!worldId) throw new ToolError('Specify `world` or run inside a world-bound session.')
      const placeKey = optStr(p, 'place')?.replace(/^@world:[^/]+\/place\//i, '').trim() || null
      const disp = optStr(p, 'disposition')
      const res = guard(() =>
        stampNpcs({
          world: worldId,
          target: str(p, 'target'),
          count: optInt(p, 'count') ?? 1,
          name: optStr(p, 'name'),
          place: placeKey,
          map: optStr(p, 'map'),
          faction: p.faction !== undefined ? optStr(p, 'faction') : undefined,
          disposition: disp === 'hostile' || disp === 'neutral' || disp === 'friendly' ? disp : undefined
        })
      )
      return `Stamped ${res.actorIds.length} NPC(s): ${res.actorIds.map((id) => `@world:${id}`).join(', ')}.`
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
