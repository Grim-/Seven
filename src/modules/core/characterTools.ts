import { DND_SKILLS, DND_STATS, blankDnd, cleanDnd, type Proficiency } from '@shared/dnd'
import { toId } from '@shared/ids'
import { newSession } from '@shared/story'
import { findSheet, getSheet, setDnd, setStory } from '../../engine/library/sheets'
import { ToolError, str, type ToolDef } from '../../engine/tools/types'

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

const addStoryLog: ToolDef = {
  name: 'add_story_log',
  group: 'core',
  needsWorkspace: false,
  description: "Add notes to a character's latest story session.",
  params: { type: 'object', properties: { sheet: { type: 'string', description: 'The character' }, text: { type: 'string', description: 'What happened, in markdown' } } },
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
    const text = str(params, 'text').trim()
    if (!text) throw new ToolError('Give the text to add.')
    const sessions = s.story.sessions.length ? s.story.sessions : [newSession()]
    const last = sessions[sessions.length - 1]
    setStory(s.id, { ...s.story, sessions: [...sessions.slice(0, -1), { ...last, notes: last.notes.trim() ? `${last.notes.trim()}\n\n${text}` : text }] })
    return `Added to session ${sessions.length} of ${s.title}'s story.`
  }
}

const setStoryWhere: ToolDef = {
  name: 'set_story_where',
  group: 'core',
  needsWorkspace: false,
  description: "Set where a character is in a specific story world.",
  params: { type: 'object', properties: { sheet: { type: 'string', description: 'The character' }, where: { type: 'string', description: 'Where they are now, e.g. Rooftops above the Lantern Market' } } },
  async execute(params) {
    const s = sheetOf(str(params, 'sheet'))
    setStory(s.id, { ...s.story, where: str(params, 'where').trim() })
    return `${s.title} is now: ${str(params, 'where').trim() || 'not set'}.`
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

export const CHARACTER_TOOLS: ToolDef[] = [updateStats, updateProficiencies, addStoryLog, setStoryWhere]
