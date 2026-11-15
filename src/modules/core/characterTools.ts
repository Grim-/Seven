import { DND_SKILLS, DND_STATS, blankDnd, cleanDnd, type Proficiency } from '@shared/dnd'
import { toId } from '@shared/ids'
import {
  STORY_MEMORY_CATEGORIES,
  STORY_PHASES,
  formatStorySnippet,
  newMemory,
  newSession,
  searchStoryItems,
  storyHitById,
  type StoryMemoryCategory,
  type StoryPhase
} from '@shared/story'
import { findSheet, getSheet, setDnd, setMind, setStory } from '../../engine/library/sheets'
import { ToolError, optBool, optInt, optStr, str, type ToolDef } from '../../engine/tools/types'

function sheetOf(raw: string) {
  const id = findSheet(raw)
  if (!id) throw new ToolError(`No sheet ${raw}. find with kind sheet lists characters.`)
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
      sheet: { type: 'string', description: 'The character, e.g. Valerius' },
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
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
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

const addStoryLog: ToolDef = {
  name: 'add_story_log',
  group: 'core',
  needsWorkspace: false,
  description: "Record structured historical story notes on a character sheet with phase ('session', 'recent', 'backstory'), location ('where'), people present ('who'), tags, and a short summary snippet.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character' },
      text: { type: 'string', description: 'Full event notes in markdown' },
      summary: TEXT('Concise 1-line snippet summarizing the event for recall (recommended)'),
      title: TEXT('Optional title for this story log entry'),
      phase: { type: ['string', 'null'], enum: [...STORY_PHASES, null], description: "When this belongs: 'session' (default), 'recent', or 'backstory'" },
      where: TEXT('Place link (@place:...) or freeform location where it happened'),
      who: { type: ['array', 'null'], items: { type: 'string' }, description: 'Characters or NPCs present' },
      tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Topic/keyword tags for recall' },
      new_session: { type: ['boolean', 'null'], description: 'True to create a separate log entry instead of appending to the latest entry' }
    }
  },
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
    const body = str(params, 'text').trim()
    if (!body) throw new ToolError('Give the text to add.')
    const summary = optStr(params, 'summary')?.trim()
    const title = optStr(params, 'title')?.trim()
    const rawPhase = optStr(params, 'phase')?.trim()
    const phase: StoryPhase = rawPhase && (STORY_PHASES as readonly string[]).includes(rawPhase) ? (rawPhase as StoryPhase) : 'session'
    const where = optStr(params, 'where')?.trim()
    const who = strList(params.who)
    const tags = strList(params.tags)
    const createNew = optBool(params, 'new_session') === true || !s.story.sessions.length || phase !== 'session' || Boolean(title && s.story.sessions[s.story.sessions.length - 1]?.title && s.story.sessions[s.story.sessions.length - 1].title !== title)

    if (createNew) {
      const entry = newSession(undefined, {
        title: title ?? '',
        notes: body,
        phase,
        ...(summary ? { summary } : {}),
        ...(where ? { where } : {}),
        ...(who.length ? { who } : {}),
        ...(tags.length ? { tags } : {})
      })
      const sessions = [...s.story.sessions, entry]
      setStory(s.id, { ...s.story, sessions })
      return `Recorded ${phase} log ${entry.id} (${sessions.length}) on ${s.title}'s story.`
    }

    const last = s.story.sessions[s.story.sessions.length - 1]
    const updated = {
      ...last,
      ...(title ? { title } : {}),
      ...(summary ? { summary } : {}),
      ...(where ? { where } : {}),
      who: mergeTags(last.who, who),
      tags: mergeTags(last.tags, tags),
      notes: last.notes.trim() ? `${last.notes.trim()}\n\n${body}` : body
    }
    setStory(s.id, { ...s.story, sessions: [...s.story.sessions.slice(0, -1), updated] })
    return `Added to story log ${updated.id} (${s.story.sessions.length}) of ${s.title}'s story.`
  }
}

const setStoryWhere: ToolDef = {
  name: 'set_story_where',
  group: 'core',
  needsWorkspace: false,
  description: "Update a character's present state: where they are now and/or open story threads.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character' },
      where: TEXT('Where they are now, e.g. @place:lantern-market or Rooftops above the Lantern Market'),
      add_thread: TEXT('Optional new open thread/goal to track in Present state'),
      resolve_thread: TEXT('Optional text matching an open thread to mark done')
    }
  },
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
    const where = optStr(params, 'where')
    const addThread = optStr(params, 'add_thread')?.trim()
    const resolveThread = optStr(params, 'resolve_thread')?.trim().toLowerCase()
    if (where === null && !addThread && !resolveThread) {
      throw new ToolError('Provide where, add_thread, or resolve_thread.')
    }
    let threads = s.story.threads
    if (resolveThread) {
      threads = threads.map((t) => (t.text.toLowerCase().includes(resolveThread) ? { ...t, done: true } : t))
    }
    if (addThread && !threads.some((t) => t.text.toLowerCase() === addThread.toLowerCase() && !t.done)) {
      threads = [...threads, { text: addThread, done: false }]
    }
    const nextWhere = where !== null ? where.trim() : s.story.where
    setStory(s.id, { ...s.story, where: nextWhere, threads })
    return `${s.title} present state updated (where: ${nextWhere || 'not set'}, open threads: ${threads.filter((t) => !t.done).length}).`
  }
}

const addCharacterMemory: ToolDef = {
  name: 'add_character_memory',
  group: 'core',
  needsWorkspace: false,
  description: 'Save or update a structured memory on a character sheet. Keeps a short snippet (surfaced proactively when relevant) separate from full details (fetched on demand via story_recall).',
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character' },
      summary: { type: 'string', description: 'Concise 1-sentence snippet surfaced when relevant (e.g. "Nearly killed by a goblin horde in Blackwood Pass")' },
      detail: TEXT('Optional fuller recollection/details kept out of the default prompt until recalled by id'),
      category: { type: ['string', 'null'], enum: [...STORY_MEMORY_CATEGORIES, null], description: "One of: 'memory' (default), 'backstory', 'recent', 'relationship', 'secret'" },
      where: TEXT('Where it happened (@place:... or freeform location)'),
      who: { type: ['array', 'null'], items: { type: 'string' }, description: 'People/characters involved' },
      tags: { type: ['array', 'null'], items: { type: 'string' }, description: 'Topic/trigger keywords (e.g. ["goblin", "ambush", "tavern"])' },
      when: TEXT('Timeframe or date (e.g. "Last winter", "Session 3")'),
      pin: { type: ['boolean', 'null'], description: 'True to keep this snippet pinned in the default character prompt' },
      id: TEXT('Existing memory id to update instead of adding a new entry')
    }
  },
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
    const existingId = optStr(params, 'id')?.trim()
    const summaryInput = optStr(params, 'summary')?.trim()
    const rawCat = optStr(params, 'category')?.trim()
    const category: StoryMemoryCategory | undefined = rawCat && (STORY_MEMORY_CATEGORIES as readonly string[]).includes(rawCat) ? (rawCat as StoryMemoryCategory) : undefined
    const detail = optStr(params, 'detail')?.trim()
    const where = optStr(params, 'where')?.trim()
    const when = optStr(params, 'when')?.trim()
    const who = strList(params.who)
    const tags = strList(params.tags)
    const pin = optBool(params, 'pin')

    const existingMemories = s.mind?.memories ?? []

    if (existingId) {
      const idx = existingMemories.findIndex((m) => m.id === existingId)
      if (idx < 0) throw new ToolError(`No memory ${existingId} in ${s.title}'s mind. Use story_recall to find memory ids.`)
      const prev = existingMemories[idx]
      const updated = newMemory({
        ...prev,
        ...(summaryInput ? { summary: summaryInput } : {}),
        ...(category ? { category } : {}),
        ...(detail !== undefined ? { detail } : {}),
        ...(where !== undefined ? { where } : {}),
        ...(when !== undefined ? { when } : {}),
        who: who.length ? mergeTags(prev.who, who) : prev.who,
        tags: tags.length ? mergeTags(prev.tags, tags) : prev.tags,
        pinned: pin === null ? prev.pinned : pin,
        createdAt: prev.createdAt
      })
      const memories = [...existingMemories.slice(0, idx), updated, ...existingMemories.slice(idx + 1)]
      setMind(s.id, { ...(s.mind ?? {}), memories })
      return `Updated memory ${updated.id} in ${s.title}'s mind: "${updated.summary}".`
    }

    if (!summaryInput) throw new ToolError('Give summary for the character memory.')
    const entry = newMemory({
      category: category ?? 'memory',
      summary: summaryInput,
      detail,
      where,
      when,
      who,
      tags,
      pinned: pin === true
    })
    setMind(s.id, { ...(s.mind ?? {}), memories: [...existingMemories, entry] })
    return `Saved ${entry.category} memory ${entry.id} in ${s.title}'s mind: "${entry.summary}".`
  }
}

const storyRecall: ToolDef = {
  name: 'story_recall',
  group: 'core',
  needsWorkspace: false,
  description: "Search a character's mind memories and historical story logs as short snippets, or pass an entry id to expand its full detail/notes.",
  params: {
    type: 'object',
    properties: {
      sheet: { type: 'string', description: 'The character' },
      id: TEXT('Memory id (mem_...) or story log id (s...) to read in full'),
      query: TEXT('Keywords, person, or place to search snippets for (e.g. "goblin", "tavern", "Kestrel")'),
      category: TEXT("Optional filter: 'memory', 'backstory', 'recent', 'relationship', 'secret', 'session', or 'all'"),
      where: TEXT('Optional place/location filter'),
      limit: { type: ['integer', 'null'], description: 'Max snippets to return (default 8, max 20)' }
    }
  },
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
    const memories = s.mind?.memories ?? []
    const id = optStr(params, 'id')?.trim()
    if (id) {
      const hit = storyHitById(s.story, id, memories)
      if (!hit) return `No mind memory or story log with id "${id}" found on ${s.title}.`
      const lines = [
        `[${s.title} · ${hit.kind} · ${hit.label}] ${hit.id}`,
        `Summary: ${hit.summary}`,
        hit.when ? `When: ${hit.when}` : '',
        hit.where ? `Where: ${hit.where}` : '',
        hit.who.length ? `Who: ${hit.who.join(', ')}` : '',
        hit.tags.length ? `Tags: ${hit.tags.join(', ')}` : '',
        hit.detail ? `\n${hit.detail}` : ''
      ].filter(Boolean)
      return lines.join('\n')
    }

    const query = optStr(params, 'query') ?? ''
    const category = optStr(params, 'category') ?? undefined
    const where = optStr(params, 'where') ?? undefined
    const limit = Math.max(1, Math.min(20, optInt(params, 'limit') ?? 8))
    const hits = searchStoryItems(s.story, query, { category, where, includePinned: true, memories }).slice(0, limit)
    if (!hits.length) {
      return `No matching mind memories or story logs found on ${s.title}${query ? ` for "${query}"` : ''}.`
    }
    const lines = hits.map((h) => formatStorySnippet(h))
    return `${s.title} — ${hits.length} matching snippet(s) (pass id to story_recall for full detail):\n${lines.join('\n')}`
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
      sheet: { type: 'string', description: 'The character, e.g. Valerius' },
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
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
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

export const CHARACTER_TOOLS: ToolDef[] = [updateStats, updateProficiencies, addStoryLog, setStoryWhere, addCharacterMemory, storyRecall]
