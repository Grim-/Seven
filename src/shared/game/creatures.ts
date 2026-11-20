import type { CompendiumEntry } from '../compendium'
import { entrySections } from '../compendium'
import { blankDnd, cleanDnd, type DndAttack, type DndFeature, type DndStats } from '../dnd'

function parseHp(raw: unknown): { cur: number; max: number; totalHd: string } {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { cur: raw, max: raw, totalHd: '' }
  }
  const s = String(raw ?? '').trim()
  const match = /^(\d+)(?:\s*\(([^)]+)\))?/.exec(s)
  if (match) {
    const val = parseInt(match[1], 10) || 0
    return { cur: val, max: val, totalHd: match[2]?.trim() ?? '' }
  }
  return { cur: 0, max: 0, totalHd: '' }
}

function parseSpeed(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const s = String(raw ?? '').trim()
  const match = /(\d+)/.exec(s)
  return match ? parseInt(match[1], 10) : 0
}

export function parseMonsterAttacksAndFeatures(text: string): { attacks: DndAttack[]; features: DndFeature[] } {
  const attacks: DndAttack[] = []
  const features: DndFeature[] = []
  const groups = entrySections(text)

  for (const group of groups) {
    const heading = (group.heading ?? '').toLowerCase()
    const isAction = heading.includes('action')
    for (const b of group.blocks) {
      if (!b.title) continue
      if (isAction) {
        const toHitMatch = /([+-]?\d+)\s+to\s+hit/i.exec(b.body)
        const hitDamageMatch = /Hit:\s*([^.\n]+)/i.exec(b.body)
        attacks.push({
          name: b.title,
          bonus: toHitMatch ? toHitMatch[1] : '',
          damage: hitDamageMatch ? hitDamageMatch[1].trim() : '',
          notes: b.body
        })
      } else {
        features.push({
          name: b.title,
          text: b.body
        })
      }
    }
  }
  return { attacks, features }
}

export interface CreatureSpawnInput {
  monster: CompendiumEntry
  customName?: string
  factionId?: string | null
}

export function monsterToSheetInput({
  monster,
  customName,
  factionId
}: CreatureSpawnInput): {
  id: null
  title: string
  fields: string[]
  values: Record<string, string>
  dnd: DndStats
  faction: string | null
} {
  const title = customName?.trim() || monster.name
  const assignedFaction = factionId ?? null
  const hpInfo = parseHp(monster.facts.hp)
  const speed = parseSpeed(monster.facts.speed)
  const { attacks, features } = parseMonsterAttacksAndFeatures(monster.text)

  const rawDnd = blankDnd()
  rawDnd.race = String(monster.facts.type ?? 'Monster')
  rawDnd.cls = monster.facts.cr !== undefined ? `CR ${monster.facts.cr}` : 'Monster'
  rawDnd.alignment = String(monster.facts.alignment ?? '')
  rawDnd.xp = Number(monster.facts.xp) || 0
  rawDnd.hp = { cur: hpInfo.cur, max: hpInfo.max, temp: 0 }
  rawDnd.hitDice = { total: hpInfo.totalHd, used: 0 }
  rawDnd.ac = Number(monster.facts.ac) || 10
  rawDnd.speed = speed
  rawDnd.stats = {
    str: Number(monster.facts.str) || 10,
    dex: Number(monster.facts.dex) || 10,
    con: Number(monster.facts.con) || 10,
    int: Number(monster.facts.int) || 10,
    wis: Number(monster.facts.wis) || 10,
    cha: Number(monster.facts.cha) || 10
  }
  rawDnd.attacks = attacks
  rawDnd.features = features
  rawDnd.proficiencies = {
    armor: '',
    weapons: '',
    tools: '',
    languages: String(monster.facts.languages ?? '')
  }

  const dnd = cleanDnd(rawDnd)

  const fields = ['Identity', 'Size & Type', 'Alignment', 'Challenge', 'Senses', 'Languages']
  const values: Record<string, string> = {
    Identity: `A ${monster.facts.size ?? ''} ${monster.facts.type ?? ''} (${monster.facts.alignment ?? 'unaligned'}).`.trim(),
    'Size & Type': `${monster.facts.size ?? ''} ${monster.facts.type ?? ''}`.trim(),
    Alignment: String(monster.facts.alignment ?? ''),
    Challenge: monster.facts.cr !== undefined ? `CR ${monster.facts.cr} (${monster.facts.xp ?? 0} XP)` : '',
    Senses: String(monster.facts.senses ?? ''),
    Languages: String(monster.facts.languages ?? '')
  }

  return {
    id: null,
    title,
    fields,
    values,
    dnd,
    faction: assignedFaction
  }
}
