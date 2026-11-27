import { toId } from '../ids'

export type FactionStance = 'allied' | 'friendly' | 'neutral' | 'unfriendly' | 'hostile'

export const FACTION_STANCES: FactionStance[] = ['allied', 'friendly', 'neutral', 'unfriendly', 'hostile']

export const STANCE_BADGE: Record<FactionStance, { label: string; cls: string }> = {
  allied: { label: 'ALLIED', cls: 'text-ok border-ok/40 bg-ok/10' },
  friendly: { label: 'FRIENDLY', cls: 'text-cyan border-cyan/40 bg-cyan/10' },
  neutral: { label: 'NEUTRAL', cls: 'text-dim border-line bg-transparent' },
  unfriendly: { label: 'UNFRIENDLY', cls: 'text-accent border-accent/40 bg-accent/10' },
  hostile: { label: 'HOSTILE', cls: 'text-alert border-alert/40 bg-alert/10' }
}

export const FACTION_TEMPERAMENTS = [
  'orderly',
  'scheming',
  'belligerent',
  'cordial',
  'opportunistic',
  'mercantile',
  'fanatical',
  'secretive',
  'honorable',
  'ruthless'
] as const

export type FactionTemperament = (typeof FACTION_TEMPERAMENTS)[number]

export interface StoredFaction {
  id: string
  worldId?: string
  name: string
  description: string
  defaultStance: FactionStance
  relations: Record<string, FactionStance>
  relationNotes?: Record<string, string>
  /** Optional named standalone character sheet leading this faction. */
  leaderSheet?: string | null
  /** Optional world place key or link serving as headquarters. */
  headquartersPlace?: string | null
  /** Optional relative overall power rating (0-100) for meta-narrative & event scoring. */
  power?: number
  /** Optional stat values keyed by Stat kind ID (defined in Game -> Stats). */
  stats?: Record<string, number>
  /** Behavioral traits for agents (e.g. orderly, cordial, scheming, belligerent). */
  temperament?: string[]
  /** Short operating doctrine (how they act publicly vs. privately). */
  doctrine?: string
  /** Optional named standalone character sheets affiliated with this faction. */
  members?: string[]
  /** Optional generic NPC/creature/monster blueprint refs (e.g. `dnd:bandit`, `game:guard`, `game_character:adventurer`). */
  roster?: string[]
  tags: string[]
  updatedAt: number
}

/** Per-save runtime overrides for a world faction (leader changes, stance shifts, power, pillars, members). */
export type SaveFactionState = Partial<
  Pick<
    StoredFaction,
    | 'name'
    | 'description'
    | 'defaultStance'
    | 'relations'
    | 'relationNotes'
    | 'leaderSheet'
    | 'headquartersPlace'
    | 'members'
    | 'power'
    | 'stats'
    | 'temperament'
    | 'doctrine'
  >
>

export const factionRef = (world: string, id: string): string => `${world}/${id}`

export function splitFactionRef(ref: string): { world: string; id: string } | null {
  const clean = ref.trim().replace(/^@?faction:/i, '').replace(/^"|"$/g, '')
  const slash = clean.indexOf('/')
  if (slash <= 0) return null
  const world = clean.slice(0, slash).trim()
  const id = toId(clean.slice(slash + 1).trim())
  return world && id ? { world, id } : null
}

export const STARTER_FACTIONS: StoredFaction[] = [
  {
    id: 'player_party',
    name: 'Player & Companions',
    description: 'The active player character and their party members. Seeks allies, answers, and glory.',
    defaultStance: 'neutral',
    relations: {
      town_guard: 'friendly',
      bandits: 'hostile',
      undead: 'hostile',
      monsters: 'hostile'
    },
    tags: ['player', 'party'],
    updatedAt: 1700000000000
  },
  {
    id: 'town_guard',
    name: 'Town Guard & Law',
    description: 'Guards, militia, and magistrates. Enforces the local laws and protects peaceful citizens from raiders and beasts.',
    defaultStance: 'neutral',
    relations: {
      player_party: 'friendly',
      bandits: 'hostile',
      undead: 'hostile',
      monsters: 'hostile'
    },
    tags: ['law', 'settlement'],
    updatedAt: 1700000000000
  },
  {
    id: 'undead',
    name: 'Undead Legion',
    description: 'Skeletons, zombies, and revenants driven by necromantic hunger. Sworn to extinguish the living unless magically dominated or commanded.',
    defaultStance: 'hostile',
    relations: {
      player_party: 'hostile',
      town_guard: 'hostile',
      monsters: 'hostile'
    },
    tags: ['undead', 'monstrous'],
    updatedAt: 1700000000000
  },
  {
    id: 'bandits',
    name: 'Outlaws & Bandits',
    description: 'Highwaymen, brigands, and deserters. Motivated by greed, ransom, and survival; may parley for gold or retreat when outmatched.',
    defaultStance: 'unfriendly',
    relations: {
      player_party: 'hostile',
      town_guard: 'hostile'
    },
    tags: ['outlaws', 'humanoid'],
    updatedAt: 1700000000000
  },
  {
    id: 'monsters',
    name: 'Wild Monsters & Beasts',
    description: 'Ogres, wolves, trolls, and primal creatures. Fiercely territorial and hungry, but creatures like ogres can sometimes be bribed or swayed by charismatic heroes.',
    defaultStance: 'hostile',
    relations: {
      player_party: 'hostile',
      town_guard: 'hostile'
    },
    tags: ['monstrous', 'wild'],
    updatedAt: 1700000000000
  }
]

export function blankStoredFaction(worldId?: string): StoredFaction {
  return {
    id: '',
    ...(worldId ? { worldId } : {}),
    name: '',
    description: '',
    defaultStance: 'neutral',
    relations: {},
    tags: [],
    updatedAt: Date.now()
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function cleanRelations(raw: unknown): Record<string, FactionStance> {
  const relations: Record<string, FactionStance> = {}
  for (const [target, stance] of Object.entries(obj(raw))) {
    if (FACTION_STANCES.includes(stance as FactionStance)) {
      relations[toId(target)] = stance as FactionStance
    }
  }
  return relations
}

function cleanRelationNotes(raw: unknown): Record<string, string> {
  const relationNotes: Record<string, string> = {}
  for (const [target, note] of Object.entries(obj(raw))) {
    if (typeof note === 'string' && note.trim()) relationNotes[toId(target)] = note
  }
  return relationNotes
}

function cleanMembers(raw: unknown): string[] {
  return Array.isArray(raw)
    ? [...new Set(raw.filter((m): m is string => typeof m === 'string' && Boolean(m.trim())).map((m) => m.trim().replace(/^@?sheet:/i, '')))]
    : []
}

const clampPower = (n: number): number => Math.max(0, Math.min(100, Math.round(n)))

function cleanFactionStats(raw: unknown): Record<string, number> | undefined {
  const v = obj(raw)
  const out: Record<string, number> = {}
  for (const [key, val] of Object.entries(v)) {
    const id = toId(key)
    if (id && typeof val === 'number' && Number.isFinite(val)) out[id] = val
  }
  return Object.keys(out).length ? out : undefined
}

function cleanTemperament(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const list = [...new Set(raw.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())).map((t) => t.trim().toLowerCase()))]
  return list.length ? list : undefined
}

export function cleanStoredFaction(raw: unknown): StoredFaction | null {
  const v = obj(raw)
  const name = str(v.name).trim()
  if (!name) return null
  const id = toId(str(v.id) || name)
  const worldId = str(v.worldId).trim()
  const defaultStance = FACTION_STANCES.includes(v.defaultStance as FactionStance) ? (v.defaultStance as FactionStance) : 'neutral'
  const relations = cleanRelations(v.relations)
  const relationNotes = cleanRelationNotes(v.relationNotes)
  const members = cleanMembers(v.members)
  const roster = Array.isArray(v.roster)
    ? [...new Set(v.roster.filter((r): r is string => typeof r === 'string' && Boolean(r.trim())).map((r) => r.trim()))]
    : []
  const tags = Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())).map((t) => t.trim().toLowerCase()) : []
  const leaderSheet = str(v.leaderSheet).trim().replace(/^@?sheet:/i, '')
  const headquartersPlace = str(v.headquartersPlace).trim()
  const power = typeof v.power === 'number' && Number.isFinite(v.power) ? clampPower(v.power) : undefined
  const stats = cleanFactionStats(v.stats ?? v.pillars)
  const temperament = cleanTemperament(v.temperament)
  const doctrine = str(v.doctrine).trim()
  return {
    id,
    ...(worldId ? { worldId } : {}),
    name,
    description: str(v.description),
    defaultStance,
    relations,
    ...(Object.keys(relationNotes).length ? { relationNotes } : {}),
    ...(leaderSheet ? { leaderSheet } : {}),
    ...(headquartersPlace ? { headquartersPlace } : {}),
    ...(power !== undefined ? { power } : {}),
    ...(stats ? { stats } : {}),
    ...(temperament ? { temperament } : {}),
    ...(doctrine ? { doctrine } : {}),
    ...(members.length ? { members } : {}),
    ...(roster.length ? { roster } : {}),
    tags,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now()
  }
}

export function cleanSaveFactionState(raw: unknown): SaveFactionState | null {
  const v = obj(raw)
  const out: SaveFactionState = {}
  if (typeof v.name === 'string' && v.name.trim()) out.name = v.name.trim()
  if (typeof v.description === 'string') out.description = v.description
  if (FACTION_STANCES.includes(v.defaultStance as FactionStance)) out.defaultStance = v.defaultStance as FactionStance
  if (v.relations && typeof v.relations === 'object') out.relations = cleanRelations(v.relations)
  if (v.relationNotes && typeof v.relationNotes === 'object') out.relationNotes = cleanRelationNotes(v.relationNotes)
  if (v.leaderSheet !== undefined) out.leaderSheet = typeof v.leaderSheet === 'string' ? v.leaderSheet.trim() || null : null
  if (v.headquartersPlace !== undefined) out.headquartersPlace = typeof v.headquartersPlace === 'string' ? v.headquartersPlace.trim() || null : null
  if (Array.isArray(v.members)) out.members = cleanMembers(v.members)
  if (typeof v.power === 'number' && Number.isFinite(v.power)) out.power = clampPower(v.power)
  const stats = cleanFactionStats(v.stats ?? v.pillars)
  if (stats) out.stats = stats
  const temperament = cleanTemperament(v.temperament)
  if (temperament) out.temperament = temperament
  if (typeof v.doctrine === 'string') out.doctrine = v.doctrine
  return Object.keys(out).length ? out : null
}

export function mergeFactionState(base: StoredFaction, override: SaveFactionState | null | undefined): StoredFaction {
  if (!override) return base
  return {
    ...base,
    ...(override.name ? { name: override.name } : {}),
    ...(override.description !== undefined ? { description: override.description } : {}),
    ...(override.defaultStance ? { defaultStance: override.defaultStance } : {}),
    relations: override.relations ? { ...base.relations, ...override.relations } : base.relations,
    ...(override.relationNotes || base.relationNotes
      ? { relationNotes: { ...(base.relationNotes ?? {}), ...(override.relationNotes ?? {}) } }
      : {}),
    ...(override.leaderSheet !== undefined ? { leaderSheet: override.leaderSheet } : {}),
    ...(override.headquartersPlace !== undefined ? { headquartersPlace: override.headquartersPlace } : {}),
    ...(override.members !== undefined ? { members: override.members } : {}),
    ...(override.power !== undefined ? { power: override.power } : {}),
    ...(override.stats || base.stats ? { stats: { ...(base.stats ?? {}), ...(override.stats ?? {}) } } : {}),
    ...(override.temperament !== undefined ? { temperament: override.temperament } : {}),
    ...(override.doctrine !== undefined ? { doctrine: override.doctrine } : {})
  }
}

export function storedFactionText(f: StoredFaction): string {
  const notes = f.relationNotes ?? {}
  const linkOf = (targetId: string) => (f.worldId ? `@world:${f.worldId}/faction/${targetId}` : `@faction:${targetId}`)
  const relationRows = [...new Set([...Object.keys(f.relations), ...Object.keys(notes)])].map((target) => {
    const stance = (f.relations[target] ?? f.defaultStance).toUpperCase()
    return notes[target] ? `- ${linkOf(target)}: ${stance} — ${notes[target].trim()}` : `- ${linkOf(target)}: ${stance}`
  })
  const statLine = f.stats
    ? Object.entries(f.stats)
        .map(([k, v]) => `${k} ${v}`)
        .join(' · ')
    : ''
  const memberRows = (f.members ?? []).map((m) => `- @sheet:${m}`)
  const rosterRows = (f.roster ?? []).map((r) => `- ${r}`)
  return [
    `# ${f.name} (${linkOf(f.id)})`,
    f.description.trim(),
    `Default diplomatic stance towards others: **${f.defaultStance.toUpperCase()}**`,
    f.temperament?.length ? `Temperament: ${f.temperament.join(', ')}` : '',
    f.doctrine?.trim() ? `Doctrine / Methods: ${f.doctrine.trim()}` : '',
    statLine ? `Stats: ${statLine}` : '',
    f.leaderSheet ? `Leader: @sheet:${f.leaderSheet}` : '',
    f.headquartersPlace ? `Headquarters: ${f.headquartersPlace}` : '',
    f.power !== undefined ? `Power: ${f.power}/100` : '',
    memberRows.length ? `### Named Character Sheets:\n${memberRows.join('\n')}` : '',
    rosterRows.length ? `### Typical NPC / Creature Roster:\n${rosterRows.join('\n')}` : '',
    relationRows.length ? `### Known Relations:\n${relationRows.join('\n')}` : '### Known Relations:\nNo specific faction overrides recorded; uses default stance.',
    f.tags.length ? `Tags: #${f.tags.join(' #')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function getFactionStance(
  factions: Record<string, StoredFaction> | StoredFaction[],
  fromId: string,
  targetId: string
): FactionStance {
  const fromClean = toId(fromId)
  const toClean = toId(targetId)
  if (fromClean === toClean) return 'allied'
  const map: Record<string, StoredFaction> = Array.isArray(factions)
    ? Object.fromEntries(factions.map((f) => [f.id, f]))
    : factions
  const from = map[fromClean]
  if (!from) return 'neutral'
  if (from.relations[toClean]) return from.relations[toClean]
  const to = map[toClean]
  if (to?.relations[fromClean]) return to.relations[fromClean]
  return from.defaultStance ?? 'neutral'
}
