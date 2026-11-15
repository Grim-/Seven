import { DND_POOL_STATS, type DndAttack } from '@shared/dnd'
import { monsterToSheetInput } from '@shared/game/creatures'
import { CREATURE_TEMPLATES, catalogFrom } from '@shared/game/defs'
import type { Catalog } from '@shared/game/core'
import type { ComponentDef } from '@shared/game/core/registry'
import { registerBlueprintProvider } from '../../engine/worlds/blueprints'
import { gameDefs } from '../game/store'
import { compendium } from './compendium'

const MONSTER = 'monster'
const FACTS: [string, string][] = [
  ['cr', 'CR'],
  ['hp', 'HP'],
  ['ac', 'AC'],
  ['type', 'Type']
]

const firstNumber = (text: string, after: RegExp, fallback: number): number => {
  const hit = after.exec(text)
  return hit ? Number(hit[1]) : fallback
}

function attackAbility(attack: DndAttack, index: number, catalog: Catalog): ComponentDef {
  const dice = /\(([^)]+)\)/.exec(attack.damage)?.[1] ?? /^\s*(\d+)/.exec(attack.damage)?.[1] ?? '1'
  const damageType = attack.damage.split(/\s+/).find((word) => catalog.damageType(word.toLowerCase()) !== null)?.toLowerCase() ?? ''
  const range = firstNumber(attack.notes, /range\s+(\d+)/i, firstNumber(attack.notes, /reach\s+(\d+)/i, 5))
  return { type: 'ability', id: `attack_${index}`, label: attack.name, range, comps: [{ type: 'action.damage', on: 'OnUse', amount: dice, damageType }] }
}

registerBlueprintProvider({
  id: 'dnd',
  module: 'dnd',
  label: 'D&D monsters',
  catalog: () => catalogFrom(gameDefs.catalog()),
  search: (query, limit) => {
    const q = query.trim().toLowerCase()
    return compendium
      .all(MONSTER)
      .filter((m) => !q || m.name.toLowerCase().includes(q) || String(m.facts.type ?? '').toLowerCase().includes(q))
      .slice(0, limit)
      .map((m) => ({ id: m.id, name: m.name, facts: FACTS.flatMap(([key, label]) => (m.facts[key] !== undefined && m.facts[key] !== '' ? [{ label, value: String(m.facts[key]).split(' (')[0] }] : [])) }))
  },
  template: (id, catalog) => {
    const monster = compendium.get(MONSTER, id)
    const dnd = monsterToSheetInput({ monster, factionId: null }).dnd
    const base: Record<string, number> = { ...dnd.stats, [DND_POOL_STATS.hp]: dnd.hp.max, [DND_POOL_STATS.ac]: dnd.ac, [DND_POOL_STATS.speed]: dnd.speed }
    return {
      ref: { kind: CREATURE_TEMPLATES, id: `dnd:${monster.id}` },
      name: monster.name,
      components: [
        { type: 'stats', base },
        { type: 'health', stat: DND_POOL_STATS.hp },
        { type: 'buffs' },
        { type: 'abilities', comps: dnd.attacks.map((a, i) => attackAbility(a, i, catalog)) }
      ]
    }
  }
})
