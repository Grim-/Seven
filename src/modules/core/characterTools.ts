import { DND_COINS, DND_CONDITIONS, DND_SKILLS, DND_STATS, blankDnd, cleanDnd, type DndStat, type Proficiency } from '@shared/dnd'
import { toId } from '@shared/ids'
import {
  STORY_ENTRY_KINDS,
  STORY_THREAD_KINDS,
  STORY_THREAD_STATUSES,
  newMemory,
  newSession,
  newThread,
  searchStoryItems,
  storyHitById,
  type StoryEntryKind,
  type StoryRecallHit,
  type StoryThreadKind,
  type StoryThreadStatus
} from '@shared/story'
import { findSheet, getSheet, setDnd, setStory } from '../../engine/library/sheets'
import { campaignOf, editHold, holdIn, holdsOf, saveHold, sheetIn } from '../../engine/library/holds'
import { grantKnowledge, knowledge, knownBy, worldsOfSheet } from '../../engine/worlds/knowledge'
import { bindingOrNull } from '../../engine/worlds/ops'
import { sessionAccess } from '../../engine/sessions/access'
import { sessionWorld } from '../../engine/worlds/chatWorld'
import { knowledgeRef, splitKnowledgeRef } from '@shared/worldKnowledge'
import { ToolError, optBool, optInt, optStr, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { categoryMeta, searchRelationships, type RelationshipEntry } from '@shared/relationships'
import { applyRelationshipUpsert, extractRelationshipPatch, formatRelationshipChange, setRelationshipSchema } from '../../engine/relationships'

function activeWorldOf(ctx?: ToolContext): string | null {
  if (!ctx) return null
  return bindingOrNull(ctx.agentId)?.worldId ?? sessionWorld(ctx.sessionId, ctx.agentId)
}

function sheetOf(raw: string, ctx?: ToolContext) {
  const id = findSheet(raw, activeWorldOf(ctx))
  if (!id) throw new ToolError(`No character or world NPC "${raw}". find with kind sheet or world lists them.`)
  return getSheet(id)
}

const INT = (what: string) => ({ type: ['integer', 'null'], description: what }) as const
const TEXT = (what: string) => ({ type: ['string', 'null'], description: what }) as const

const updateStats: ToolDef = {
  name: 'update_stats',
  group: 'core',
  needsWorkspace: false,
  description: "Change a character's D&D stats. Give only what changes; null keeps the rest.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC, e.g. Valerius or @world:elysium/npc/marta' },
      race: TEXT('e.g. Air genasi'),
      class: TEXT('e.g. Rogue'),
      level: INT('1 to 20'),
      hp: INT('Hit points now'),
      max_hp: INT('Most hit points'),
      ac: INT('Armour class'),
      speed: INT('In feet, e.g. 30'),
      str: INT('Strength score'),
      dex: INT('Dexterity score'),
      con: INT('Constitution score'),
      int: INT('Intelligence score'),
      wis: INT('Wisdom score'),
      cha: INT('Charisma score'),
      background: TEXT('e.g. Urchin'),
      alignment: TEXT('e.g. Chaotic good')
    }
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const current = s.dnd ?? blankDnd()
    const given = (key: string) => params[key] !== undefined && params[key] !== null && params[key] !== ''
    const pick = <T,>(key: string, fallback: T): unknown => (given(key) ? params[key] : fallback)
    const next = cleanDnd({
      ...current,
      race: pick('race', current.race),
      cls: pick('class', current.cls),
      level: pick('level', current.level),
      background: pick('background', current.background),
      alignment: pick('alignment', current.alignment),
      hp: { ...current.hp, cur: pick('hp', current.hp.cur), max: pick('max_hp', current.hp.max) },
      ac: pick('ac', current.ac),
      speed: pick('speed', current.speed),
      stats: Object.fromEntries(Object.entries(current.stats).map(([k, v]) => [k, pick(k, v)]))
    })
    setDnd(s.id, next)
    return `Updated sheet ${s.title}: HP ${next.hp.cur}/${next.hp.max}, AC ${next.ac}, level ${next.level}.`
  }
}

function strList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const val = typeof item === 'string' ? item.trim() : ''
    if (!val) continue
    const key = val.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(val)
  }
  return out
}

function mergeTags(existing?: string[], added?: string[]): string[] | undefined {
  const merged = strList([...(existing ?? []), ...(added ?? [])])
  return merged.length ? merged : undefined
}

function formatTags(tags: string[], comma = false): string {
  const clean = tags.map((t) => `#${t.replace(/^#/, '').trim()}`).filter((t) => t.length > 1)
  return clean.join(comma ? ', ' : ' ')
}

const KNOWLEDGE_FORMATTERS = new Map<StoryRecallHit['kind'], (hit: StoryRecallHit) => string>([
  [
    'knowledge',
    (hit) => {
      const lines = ['[World Knowledge]', `Context: ${hit.detail || hit.summary}`]
      if (hit.tags.length) lines.push(formatTags(hit.tags))
      return lines.join('\n')
    }
  ],
  [
    'log',
    (hit) => {
      const lines = [hit.label.includes('backstory') ? '[Backstory]' : '[Event]']
      const title = hit.label.split(' · ')[1]
      if (title && !title.startsWith('Entry ')) lines.push(title)
      lines.push(`Context: ${hit.detail || hit.summary}`)
      if (hit.outcome) lines.push(`Outcome: ${hit.outcome}`)
      if (hit.tags.length) lines.push(formatTags(hit.tags))
      return lines.join('\n')
    }
  ]
])

function formatKnowledgeHit(hit: StoryRecallHit): string {
  const custom = KNOWLEDGE_FORMATTERS.get(hit.kind)
  if (custom) return custom(hit)
  const tagPrefix = hit.tags.length ? `${formatTags(hit.tags, true)} - ` : ''
  const header = hit.label === 'backstory' ? '[Backstory]' : '[Memory]'
  const body = `${tagPrefix}${hit.summary}`
  return hit.detail ? `${header}\n${body}\n${hit.detail}` : `${header}\n${body}`
}

function formatRelationHit(sheetTitle: string, r: RelationshipEntry): string {
  const lines = [
    `[Relation: ${categoryMeta(r.category).label}]`,
    `${sheetTitle} -> ${r.target} (relation type : ${r.role || r.stance})`
  ]
  if (r.ref) lines.push(`relevant link ${r.ref}`)
  if (r.notes) lines.push(`notes: ${r.notes}`)
  return lines.join('\n')
}

const characterSearchKnowledge: ToolDef = {
  name: 'character_search_knowledge',
  group: 'core',
  needsWorkspace: false,
  lookup: true,
  description: "Search a character sheet's own knowledge: memories, world knowledge, events, and backstory (NOT Agent Mind, and NOT relations — use character_recall_relation for relations). Pass keywords as an array or string, or pass id to read one entry in full.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC name or link' },
      keywords: {
        oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }, { type: 'null' }],
        description: "Trigger words/topics to search for, e.g. ['magic', 'world']"
      },
      id: TEXT('Optional entry id (mem_…, s…, or world/entry) to read in full')
    },
    required: ['sheet']
  },
  async execute(params, ctx) {
    const s = sheetIn(sheetOf(str(params, 'sheet'), ctx).id, campaignOf(ctx.sessionId))
    const memories = s.mind?.memories ?? []
    const known = knownBy(s, worldsOfSheet(s.id))
    const id = optStr(params, 'id')?.trim()
    if (id) {
      const hit = storyHitById(s.story, id, memories, [], known)
      if (!hit) return `No memory, event, backstory, or world knowledge with id "${id}" found on ${s.title}.`
      return `${s.title} recalls\n\n${formatKnowledgeHit(hit)}`
    }

    const rawKw = params.keywords
    const query = Array.isArray(rawKw) ? strList(rawKw).join(' ') : typeof rawKw === 'string' ? rawKw.trim() : ''
    const hits = searchStoryItems(s.story, query, { includePinned: true, memories, known })
      .filter((h) => h.kind !== 'relationship')
      .slice(0, 12)
    if (!hits.length) {
      return `${s.title} recalls nothing matching${query ? ` "${query}"` : ''}.`
    }
    return `${s.title} recalls\n\n${hits.map(formatKnowledgeHit).join('\n\n')}`
  }
}

const characterRecallRelation: ToolDef = {
  name: 'character_recall_relation',
  group: 'core',
  needsWorkspace: false,
  lookup: true,
  description: "Recall a character's relationships across ALL categories (person, place, thing, faction, concept, event) by keywords, names, @ links, or relation ids.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC name or link' },
      keywords_or_ids: {
        oneOf: [{ type: 'array', items: { type: 'string' } }, { type: 'string' }, { type: 'null' }],
        description: "Keywords, names, @sheet:/@world:/@place:/@faction: links, or relation ids (rel_…)"
      }
    },
    required: ['sheet']
  },
  async execute(params, ctx) {
    const s = sheetIn(sheetOf(str(params, 'sheet'), ctx).id, campaignOf(ctx.sessionId))
    const relationships = s.relationships ?? []
    if (!relationships.length) return `${s.title} has no recorded relationships.`
    const raw = params.keywords_or_ids
    const terms = Array.isArray(raw) ? strList(raw) : typeof raw === 'string' && raw.trim() ? [raw.trim()] : []
    let matched: RelationshipEntry[]
    if (!terms.length) {
      matched = [...relationships].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt).slice(0, 12)
    } else {
      const byId = new Map<string, RelationshipEntry>()
      for (const term of terms) {
        const direct = relationships.find((r) => r.id === term || r.ref?.toLowerCase() === term.toLowerCase())
        if (direct) byId.set(direct.id, direct)
      }
      const query = terms.join(' ')
      for (const { entry } of searchRelationships(relationships, query, { includePinned: true })) {
        if (!byId.has(entry.id)) byId.set(entry.id, entry)
      }
      matched = [...byId.values()].slice(0, 12)
    }
    if (!matched.length) return `${s.title} knows of no matching relations.`
    return `${s.title} knows of..\n\n${matched.map((r) => formatRelationHit(s.title, r)).join('\n\n')}`
  }
}

const characterLearnMemory: ToolDef = {
  name: 'character_learn_memory',
  group: 'core',
  needsWorkspace: false,
  description: 'Save a new personal memory for a character sheet (memories are additive; agents never forget or delete).',
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC' },
      summary: { type: 'string', description: 'Concise 1-sentence memory' },
      tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Topic/trigger keywords' },
      where: TEXT('Where it happened (@place:... or location)'),
      who: { type: ['array', 'null'], items: { type: 'string' }, description: 'People/characters involved' },
      detail: TEXT('Optional fuller recollection')
    },
    required: ['sheet', 'summary']
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const summary = str(params, 'summary').trim()
    if (!summary) throw new ToolError('Give summary for the character memory.')
    const campaign = campaignOf(ctx.sessionId)
    const entry = newMemory({
      category: 'memory',
      summary,
      detail: optStr(params, 'detail')?.trim(),
      where: optStr(params, 'where')?.trim(),
      who: strList(params.who),
      tags: strList(params.tags),
      pinned: false
    })
    editHold(s.id, campaign, (h) => ({ ...h, memories: [...h.memories, entry] }))
    return `${s.title} learned memory (${entry.id}): "${entry.summary}".`
  }
}

const characterLearnEvent: ToolDef = {
  name: 'character_learn_event',
  group: 'core',
  needsWorkspace: false,
  description: 'Record a witnessed or experienced event on a character sheet (events are additive; agents never delete).',
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC' },
      title: { type: 'string', description: 'Short event title' },
      context: { type: 'string', description: 'What happened' },
      outcome: TEXT('Consequence or outcome of the event'),
      where: TEXT('Where it happened (@place:... or location)'),
      who: { type: ['array', 'null'], items: { type: 'string' }, description: 'People/characters involved' },
      tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Topic/trigger keywords' },
      kind: { type: ['string', 'null'], enum: [...STORY_ENTRY_KINDS, null], description: "Entry kind: 'scene' (default), 'interaction', 'milestone', or 'downtime'" }
    },
    required: ['sheet', 'title', 'context']
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const title = str(params, 'title').trim()
    const context = str(params, 'context').trim()
    if (!context) throw new ToolError('Give context for the event.')
    const campaign = campaignOf(ctx.sessionId)
    const rawKind = optStr(params, 'kind')?.trim()
    const kind: StoryEntryKind = rawKind && (STORY_ENTRY_KINDS as readonly string[]).includes(rawKind) ? (rawKind as StoryEntryKind) : 'scene'
    const outcome = optStr(params, 'outcome')?.trim()
    const where = optStr(params, 'where')?.trim()
    const who = strList(params.who)
    const tags = strList(params.tags)
    const entry = newSession(undefined, {
      title,
      summary: context,
      notes: context,
      phase: 'session',
      kind,
      ...(outcome ? { outcome } : {}),
      ...(where ? { where } : {}),
      ...(who.length ? { who } : {}),
      ...(tags.length ? { tags } : {})
    })
    editHold(s.id, campaign, (h) => ({ ...h, sessions: [...h.sessions, entry] }))
    return `${s.title} recorded event ${entry.id}: "${title}".`
  }
}

const characterLearnBackstory: ToolDef = {
  name: 'character_learn_backstory',
  group: 'core',
  needsWorkspace: false,
  description: 'Add a piece of backstory knowledge to a character sheet (additive; agents never delete).',
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC' },
      text: { type: 'string', description: 'The backstory fact or recollection' },
      tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Topic/trigger keywords' }
    },
    required: ['sheet', 'text']
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const text = str(params, 'text').trim()
    if (!text) throw new ToolError('Give text for the backstory entry.')
    const entry = newMemory({
      category: 'backstory',
      summary: text,
      tags: strList(params.tags),
      pinned: false
    })
    editHold(s.id, campaignOf(ctx.sessionId), (h) => ({ ...h, memories: [...h.memories, entry] }))
    return `${s.title} added backstory (${entry.id}).`
  }
}

const characterLearnWorldKnowledge: ToolDef = {
  name: 'character_learn_world_knowledge',
  group: 'core',
  needsWorkspace: false,
  description: 'Mark an existing piece of local world knowledge (@knowledge:world/entry or name in active world) as learned by a character.',
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC' },
      knowledge: { type: 'string', description: 'The knowledge: @knowledge:world/entry or its name in this world' },
      source: TEXT('Who or what they learned it from, if any')
    },
    required: ['sheet', 'knowledge']
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const raw = str(params, 'knowledge')
    const parts = splitKnowledgeRef(raw)
    const world = parts?.world ?? activeWorldOf(ctx)
    if (!world) throw new ToolError('Pass knowledge as @knowledge:world/entry; this chat is not in a world.')
    const entry = knowledge.find(world, parts?.id ?? raw)
    if (!entry) throw new ToolError(`No knowledge ${raw} in ${world}.`)
    if (entry.scope === 'global') return `${entry.name} is global: everyone in ${world} already knows it.`
    const ref = knowledgeRef(world, entry.id)
    const campaign = campaignOf(ctx.sessionId)
    if (!grantKnowledge(s.id, campaign, ref, { source: optStr(params, 'source'), where: sessionAccess.get(ctx.sessionId)?.scene?.where ?? '' })) {
      return `${s.title} already knows ${entry.name}.`
    }
    return `${s.title} learned @world:${world}/knowledge/${entry.id}${campaign ? ' in this campaign' : ''}.`
  }
}

const characterSetState: ToolDef = {
  name: 'character_set_state',
  group: 'core',
  needsWorkspace: false,
  description: "Update a character's present state ('Where am I right now and who I am': where, doing, goal, mood) and open threads.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC' },
      where: TEXT('Where they are now, e.g. @place:lantern-market or Rooftops above the Lantern Market'),
      doing: TEXT('What they are doing right this moment / immediate active scene'),
      goal: TEXT('Their current immediate focus or objective'),
      mood: TEXT('Current situational posture, condition, or stakes'),
      add_thread: TEXT('Optional new open thread/arc title to track or update'),
      thread_kind: { type: ['string', 'null'], enum: [...STORY_THREAD_KINDS, null], description: "Thread type: 'arc', 'goal', 'mystery', 'bond', or 'threat'" },
      thread_status: { type: ['string', 'null'], enum: [...STORY_THREAD_STATUSES, null], description: "Thread status: 'active', 'waiting', 'resolved', or 'dropped'" },
      thread_detail: TEXT('Optional context notes or next beat for add_thread'),
      thread_who: { type: ['array', 'null'], items: { type: 'string' }, description: 'People/factions involved in the thread' },
      thread_where: TEXT('Where the thread takes place'),
      resolve_thread: TEXT('Optional text matching an existing thread to mark resolved')
    },
    required: ['sheet']
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const where = optStr(params, 'where')
    const doing = optStr(params, 'doing')
    const goal = optStr(params, 'goal')
    const mood = optStr(params, 'mood')
    const addThread = optStr(params, 'add_thread')?.trim()
    const resolveThread = optStr(params, 'resolve_thread')?.trim().toLowerCase()
    if (where === null && doing === null && goal === null && mood === null && !addThread && !resolveThread) {
      throw new ToolError('Provide a present field (where, doing, goal, mood), add_thread, or resolve_thread.')
    }
    const campaign = campaignOf(ctx.sessionId)
    const target = holdIn(s.id, campaign)
    let threads = target.threads
    if (resolveThread) {
      threads = threads.map((t) => (t.text.toLowerCase().includes(resolveThread) ? { ...t, done: true, status: 'resolved' as StoryThreadStatus } : t))
    }
    if (addThread) {
      const rawKind = optStr(params, 'thread_kind')?.trim()
      const kind: StoryThreadKind | undefined = rawKind && (STORY_THREAD_KINDS as readonly string[]).includes(rawKind) ? (rawKind as StoryThreadKind) : undefined
      const rawStatus = optStr(params, 'thread_status')?.trim()
      const status: StoryThreadStatus | undefined = rawStatus && (STORY_THREAD_STATUSES as readonly string[]).includes(rawStatus) ? (rawStatus as StoryThreadStatus) : undefined
      const detail = optStr(params, 'thread_detail')?.trim()
      const threadWho = strList(params.thread_who)
      const threadWhere = optStr(params, 'thread_where')?.trim()
      const existing = threads.findIndex((t) => t.text.toLowerCase() === addThread.toLowerCase())
      if (existing >= 0) {
        const cur = threads[existing]
        const nextStatus = status ?? cur.status ?? (cur.done ? 'resolved' : 'active')
        threads = threads.map((t, i) =>
          i === existing
            ? {
                ...cur,
                ...(kind ? { kind } : {}),
                status: nextStatus,
                done: nextStatus === 'resolved' || nextStatus === 'dropped',
                ...(detail ? { detail } : {}),
                ...(threadWho.length ? { who: mergeTags(cur.who, threadWho) } : {}),
                ...(threadWhere ? { where: threadWhere } : {})
              }
            : t
        )
      } else {
        threads = [
          ...threads,
          newThread({
            text: addThread,
            ...(kind ? { kind } : {}),
            ...(status ? { status } : {}),
            ...(detail ? { detail } : {}),
            ...(threadWho.length ? { who: threadWho } : {}),
            ...(threadWhere ? { where: threadWhere } : {})
          })
        ]
      }
    }
    const nextStory = {
      ...getSheet(s.id).story,
      where: where !== null ? where.trim() : s.story.where,
      ...(doing !== null ? { doing: doing.trim() || undefined } : {}),
      ...(goal !== null ? { goal: goal.trim() || undefined } : {}),
      ...(mood !== null ? { mood: mood.trim() || undefined } : {})
    }
    setStory(s.id, nextStory)
    if (threads !== target.threads) saveHold(s.id, campaign, { ...target, threads })
    return `${s.title} present state updated (where: ${nextStory.where || 'not set'}${nextStory.doing ? `, doing: ${nextStory.doing}` : ''}, open threads: ${threads.filter((t) => !t.done).length}).`
  }
}

const characterSetRelation: ToolDef = {
  name: 'character_set_relation',
  group: 'core',
  needsWorkspace: false,
  activity: (params) => `updating character relationship${typeof params.target === 'string' && params.target.trim() ? `: ${params.target.trim()}` : ''}`,
  description: 'Add or update a structured relationship on a character sheet (person, place, thing, faction, concept, or event). Updates an existing match for target or id in place; null keeps existing fields.',
  params: setRelationshipSchema({ sheet: { type: 'string', description: 'The character or world NPC, e.g. Valerius or @world:elysium/npc/marta' } }),
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const campaign = campaignOf(ctx.sessionId)
    const patch = extractRelationshipPatch(params, { agentId: ctx.agentId })
    const held = holdsOf(s.id, campaign)
    for (const at of held) {
      const tried = applyRelationshipUpsert(at.hold.relationships, patch)
      if (tried.created) continue
      saveHold(s.id, at.campaign, { ...at.hold, relationships: tried.list })
      return formatRelationshipChange('Updated', `${s.title}'s`, tried.entry)
    }
    const { list, entry } = applyRelationshipUpsert(held[0].hold.relationships, patch)
    saveHold(s.id, held[0].campaign, { ...held[0].hold, relationships: list })
    return formatRelationshipChange('Added', `${s.title}'s`, entry)
  }
}

const LEVELS: Record<string, Proficiency> = { none: 0, proficient: 1, expert: 2 }
const NAMES = (what: string) => ({ oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: what }) as const

const updateProficiencies: ToolDef = {
  name: 'update_proficiencies',
  group: 'core',
  needsWorkspace: false,
  activity: () => 'updating proficiencies',
  description: "Change a character's D&D skill and save proficiencies, and what armour, weapons, tools and languages they know. Give only what changes; null keeps the rest.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC, e.g. Valerius' },
      proficient: NAMES(`Skills they become proficient in, e.g. ["Stealth", "Acrobatics"]. Skills: ${DND_SKILLS.map((s) => s.name).join(', ')}`),
      expert: NAMES('Skills they get expertise in (double proficiency)'),
      untrained: NAMES('Skills they lose proficiency in'),
      saves: NAMES('Every saving throw they are proficient in, e.g. ["dex", "int"]; replaces the list'),
      armor: { type: ['string', 'null'], description: 'e.g. Light armour' },
      weapons: { type: ['string', 'null'], description: 'e.g. Simple weapons, rapiers' },
      tools: { type: ['string', 'null'], description: "e.g. Thieves' tools" },
      languages: { type: ['string', 'null'], description: 'e.g. Common, Primordial' }
    }
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const current = s.dnd ?? blankDnd()
    const list = (key: string) => (Array.isArray(params[key]) ? (params[key] as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])
    const skillId = (name: string) => {
      const found = DND_SKILLS.find((k) => k.id === toId(name) || toId(k.name) === toId(name))
      if (!found) throw new ToolError(`No skill "${name}". Skills: ${DND_SKILLS.map((k) => k.name).join(', ')}.`)
      return found.id
    }
    const skills = { ...current.skills }
    for (const [key, level] of [['untrained', 'none'], ['proficient', 'proficient'], ['expert', 'expert']] as const) for (const name of list(key)) skills[skillId(name)] = LEVELS[level]
    const saveList = list('saves').map((x) => x.toLowerCase().slice(0, 3))
    const bad = saveList.filter((x) => !(DND_STATS as readonly string[]).includes(x))
    if (bad.length) throw new ToolError(`saves are stat names: ${DND_STATS.join(', ')}. Not: ${bad.join(', ')}.`)
    const saves = Array.isArray(params.saves) ? (Object.fromEntries(DND_STATS.map((k) => [k, saveList.includes(k)])) as typeof current.saves) : current.saves
    const text = (key: keyof typeof current.proficiencies) => (typeof params[key] === 'string' ? (params[key] as string).trim() : current.proficiencies[key])
    const next = cleanDnd({ ...current, skills, saves, proficiencies: { armor: text('armor'), weapons: text('weapons'), tools: text('tools'), languages: text('languages') } })
    setDnd(s.id, next)
    const named = DND_SKILLS.filter((k) => next.skills[k.id]).map((k) => `${k.name}${next.skills[k.id] === 2 ? ' (expert)' : ''}`)
    return `Updated ${s.title}: skills ${named.join(', ') || 'none'}; saves ${DND_STATS.filter((k) => next.saves[k]).join(', ') || 'none'}.`
  }
}

function upsertNamed<T extends { name: string }>(
  current: T[],
  incoming: unknown,
  build: (raw: Record<string, unknown>, prev?: T) => T | null,
  removeRaw: unknown
): T[] {
  const drops = new Set(strList(removeRaw).map((n) => n.toLowerCase()))
  let next = current.filter((item) => !drops.has(item.name.toLowerCase()))
  if (!Array.isArray(incoming)) return next
  for (const item of incoming) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    const idx = typeof rec.name === 'string' ? next.findIndex((x) => x.name.toLowerCase() === rec.name!.toString().trim().toLowerCase()) : -1
    const built = build(rec, idx >= 0 ? next[idx] : undefined)
    if (!built) continue
    next = idx >= 0 ? [...next.slice(0, idx), built, ...next.slice(idx + 1)] : [...next, built]
  }
  return next
}

const updateDnd: ToolDef = {
  name: 'update_dnd',
  group: 'core',
  needsWorkspace: false,
  activity: () => 'updating D&D sheet details',
  description: "Update a character's D&D spells, spell slots, features, attacks, equipment, coins, conditions, exhaustion, inspiration, temp HP, hit dice, or death saves. Pass only fields that change; null keeps existing values.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character or world NPC, e.g. Valerius' },
      temp_hp: INT('Temporary hit points'),
      inspiration: { type: ['boolean', 'null'], description: 'Heroic inspiration' },
      exhaustion: INT('Exhaustion level 0 to 6'),
      add_conditions: NAMES(`Conditions to add, e.g. ["Poisoned"]. Common: ${DND_CONDITIONS.join(', ')}`),
      remove_conditions: NAMES('Conditions to remove'),
      hit_dice: { oneOf: [{ type: 'null' }, { type: 'object', properties: { total: TEXT('e.g. 5d8'), used: INT('Hit dice spent') } }] },
      death_saves: { oneOf: [{ type: 'null' }, { type: 'object', properties: { ok: INT('Successes 0-3'), fail: INT('Failures 0-3') } }] },
      coins: { oneOf: [{ type: 'null' }, { type: 'object', properties: { cp: INT('Copper'), sp: INT('Silver'), ep: INT('Electrum'), gp: INT('Gold'), pp: INT('Platinum') } }] },
      spell_ability: { type: ['string', 'null'], enum: [...DND_STATS, null], description: 'Spellcasting ability stat' },
      slots: {
        oneOf: [
          { type: 'null' },
          {
            type: 'array',
            items: {
              type: 'object',
              properties: { level: { type: 'integer', description: 'Spell level 1 to 9' }, max: INT('Max slots'), used: INT('Used slots') },
              required: ['level']
            }
          }
        ],
        description: 'Patch spell slot counts by spell level (1-9)'
      },
      add_attacks: {
        oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, bonus: TEXT('Attack bonus, e.g. +5'), damage: TEXT('e.g. 1d8+3 slashing'), notes: TEXT('Notes') }, required: ['name'] } }]
      },
      remove_attacks: NAMES('Attack names to remove'),
      add_equipment: {
        oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: INT('Quantity'), equipped: { type: ['boolean', 'null'] }, note: TEXT('Notes') }, required: ['name'] } }]
      },
      remove_equipment: NAMES('Equipment item names to remove'),
      add_features: {
        oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, text: TEXT('Feature description') }, required: ['name'] } }]
      },
      remove_features: NAMES('Feature names to remove'),
      add_spells: {
        oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, level: INT('0 for cantrip, 1-9 for leveled'), prepared: { type: ['boolean', 'null'] }, note: TEXT('Notes') }, required: ['name'] } }]
      },
      remove_spells: NAMES('Spell names to remove')
    }
  },
  async execute(params, ctx) {
    const s = sheetOf(str(params, 'sheet'), ctx)
    const cur = s.dnd ?? blankDnd()
    const tempHp = optInt(params, 'temp_hp')
    const inspiration = optBool(params, 'inspiration')
    const exhaustion = optInt(params, 'exhaustion')

    const addCond = strList(params.add_conditions)
    const remCond = new Set(strList(params.remove_conditions).map((c) => c.toLowerCase()))
    const conditions = strList([...cur.conditions, ...addCond]).filter((c) => !remCond.has(c.toLowerCase()))

    const hd = params.hit_dice && typeof params.hit_dice === 'object' ? (params.hit_dice as Record<string, unknown>) : null
    const ds = params.death_saves && typeof params.death_saves === 'object' ? (params.death_saves as Record<string, unknown>) : null
    const coinPatch = params.coins && typeof params.coins === 'object' ? (params.coins as Record<string, unknown>) : null
    const coins = { ...cur.coins }
    if (coinPatch) {
      for (const c of DND_COINS) {
        if (typeof coinPatch[c] === 'number' && Number.isFinite(coinPatch[c])) coins[c] = Math.max(0, Math.round(coinPatch[c] as number))
      }
    }

    const slots = cur.slots.map((sl) => ({ ...sl }))
    if (Array.isArray(params.slots)) {
      for (const item of params.slots) {
        if (!item || typeof item !== 'object') continue
        const sl = item as Record<string, unknown>
        const lvl = typeof sl.level === 'number' ? Math.round(sl.level) : 0
        if (lvl < 1 || lvl > 9) continue
        const target = slots[lvl - 1]
        if (typeof sl.max === 'number' && Number.isFinite(sl.max)) target.max = Math.max(0, Math.round(sl.max))
        if (typeof sl.used === 'number' && Number.isFinite(sl.used)) target.used = Math.max(0, Math.round(sl.used))
      }
    }

    const rawSpellAbility = optStr(params, 'spell_ability')
    const spellAbilityPatch =
      rawSpellAbility === null
        ? cur.spellAbility
        : rawSpellAbility === ''
          ? null
          : (DND_STATS as readonly string[]).includes(rawSpellAbility)
            ? (rawSpellAbility as DndStat)
            : (() => {
                throw new ToolError(`spell_ability must be one of ${DND_STATS.join(', ')}.`)
              })()

    const attacks = upsertNamed(
      cur.attacks,
      params.add_attacks,
      (raw, prev) => {
        const name = typeof raw.name === 'string' ? raw.name.trim() : ''
        if (!name) return null
        return {
          name,
          bonus: typeof raw.bonus === 'string' ? raw.bonus.trim() : (prev?.bonus ?? ''),
          damage: typeof raw.damage === 'string' ? raw.damage.trim() : (prev?.damage ?? ''),
          notes: typeof raw.notes === 'string' ? raw.notes.trim() : (prev?.notes ?? '')
        }
      },
      params.remove_attacks
    )

    const equipment = upsertNamed(
      cur.equipment,
      params.add_equipment,
      (raw, prev) => {
        const name = typeof raw.name === 'string' ? raw.name.trim() : ''
        if (!name) return null
        return {
          name,
          qty: typeof raw.qty === 'number' && Number.isFinite(raw.qty) ? Math.max(0, Math.round(raw.qty)) : (prev?.qty ?? 1),
          equipped: typeof raw.equipped === 'boolean' ? raw.equipped : (prev?.equipped ?? false),
          note: typeof raw.note === 'string' ? raw.note.trim() : (prev?.note ?? '')
        }
      },
      params.remove_equipment
    )

    const features = upsertNamed(
      cur.features,
      params.add_features,
      (raw, prev) => {
        const name = typeof raw.name === 'string' ? raw.name.trim() : ''
        if (!name) return null
        return {
          name,
          text: typeof raw.text === 'string' ? raw.text.trim() : (prev?.text ?? '')
        }
      },
      params.remove_features
    )

    const spells = upsertNamed(
      cur.spells,
      params.add_spells,
      (raw, prev) => {
        const name = typeof raw.name === 'string' ? raw.name.trim() : ''
        if (!name) return null
        return {
          name,
          level: typeof raw.level === 'number' && Number.isFinite(raw.level) ? Math.max(0, Math.min(9, Math.round(raw.level))) : (prev?.level ?? 0),
          prepared: typeof raw.prepared === 'boolean' ? raw.prepared : (prev?.prepared ?? false),
          note: typeof raw.note === 'string' ? raw.note.trim() : (prev?.note ?? '')
        }
      },
      params.remove_spells
    )

    const next = cleanDnd({
      ...cur,
      ...(inspiration !== null ? { inspiration } : {}),
      ...(exhaustion !== null ? { exhaustion } : {}),
      conditions,
      hp: { ...cur.hp, ...(tempHp !== null ? { temp: tempHp } : {}) },
      hitDice: {
        total: hd && typeof hd.total === 'string' ? hd.total.trim() : cur.hitDice.total,
        used: hd && typeof hd.used === 'number' && Number.isFinite(hd.used) ? hd.used : cur.hitDice.used
      },
      deathSaves: {
        ok: ds && typeof ds.ok === 'number' && Number.isFinite(ds.ok) ? ds.ok : cur.deathSaves.ok,
        fail: ds && typeof ds.fail === 'number' && Number.isFinite(ds.fail) ? ds.fail : cur.deathSaves.fail
      },
      coins,
      spellAbility: spellAbilityPatch,
      slots,
      attacks,
      equipment,
      features,
      spells
    })
    setDnd(s.id, next)
    return `Updated D&D sheet for ${s.title}: ${next.attacks.length} attacks, ${next.features.length} features, ${next.spells.length} spells, ${next.equipment.length} items, ${next.coins.gp} gp.`
  }
}

export const CHARACTER_TOOLS: ToolDef[] = [
  updateStats,
  updateProficiencies,
  updateDnd,
  characterSearchKnowledge,
  characterRecallRelation,
  characterLearnMemory,
  characterLearnEvent,
  characterLearnBackstory,
  characterLearnWorldKnowledge,
  characterSetState,
  characterSetRelation
].map((t) => ({ ...t, needsCharacter: true }))
