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

export interface StoredFaction {
  id: string
  name: string
  description: string
  defaultStance: FactionStance
  relations: Record<string, FactionStance>
  tags: string[]
  updatedAt: number
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
    updatedAt: Date.now()
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
    updatedAt: Date.now()
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
    updatedAt: Date.now()
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
    updatedAt: Date.now()
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
    updatedAt: Date.now()
  }
]

export function blankStoredFaction(): StoredFaction {
  return {
    id: '',
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

export function cleanStoredFaction(raw: unknown): StoredFaction | null {
  const v = obj(raw)
  const name = str(v.name).trim()
  if (!name) return null
  const id = toId(str(v.id) || name)
  const defaultStance = FACTION_STANCES.includes(v.defaultStance as FactionStance) ? (v.defaultStance as FactionStance) : 'neutral'
  const relations: Record<string, FactionStance> = {}
  for (const [target, stance] of Object.entries(obj(v.relations))) {
    if (FACTION_STANCES.includes(stance as FactionStance)) {
      relations[toId(target)] = stance as FactionStance
    }
  }
  const tags = Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())).map((t) => t.trim().toLowerCase()) : []
  return {
    id,
    name,
    description: str(v.description),
    defaultStance,
    relations,
    tags,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now()
  }
}

export function storedFactionText(f: StoredFaction): string {
  const relationRows = Object.entries(f.relations).map(([target, stance]) => `- @faction:${target}: ${stance.toUpperCase()}`)
  return [
    `# ${f.name} (@faction:${f.id})`,
    f.description.trim(),
    `Default diplomatic stance towards others: **${f.defaultStance.toUpperCase()}**`,
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
  // Fallback to reciprocal relation if target defines one
  const to = map[toClean]
  if (to?.relations[fromClean]) return to.relations[fromClean]
  return from.defaultStance ?? 'neutral'
}
