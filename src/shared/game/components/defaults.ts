import { createComponent, type ComponentDef, type GameEntity } from '../core'
import { Abilities, Ability } from './Abilities'
import { Resource } from './Resource'

export const DEFAULT_CHARACTER_COMPONENTS: readonly ComponentDef[] = [
  { type: 'stats', base: {} },
  { type: 'progression', level: 1, xp: 0, curve: 'standard' },
  { type: 'classes' },
  { type: 'traits' },
  { type: 'skills', ranks: {} },
  { type: 'tags', values: [] },
  { type: 'health', stat: 'health' },
  { type: 'resource', stat: 'stamina' },
  { type: 'buffs' },
  {
    type: 'abilities',
    comps: [
      {
        type: 'ability',
        id: 'unarmed_strike',
        label: 'Unarmed Strike',
        range: 5,
        unarmedOnly: true,
        comps: [
          {
            type: 'action.attackRoll',
            on: 'OnUse',
            emit: 'OnStrikeHit',
            bonus: 'floor((user.str - 10) / 2)',
            defenseStat: 'armour'
          },
          {
            type: 'action.damage',
            on: 'OnStrikeHit',
            amount: 'max(1, 1 + floor((user.str - 10) / 2))',
            damageType: 'bludgeoning'
          }
        ]
      },
      {
        type: 'ability',
        id: 'dash',
        label: 'Dash',
        range: 0,
        action: 'action',
        comps: [{ type: 'action.addMovement', on: 'OnUse', who: 'caster', amount: 'user.speed' }]
      },
      {
        type: 'ability',
        id: 'dodge',
        label: 'Dodge',
        range: 0,
        action: 'action',
        comps: [{ type: 'action.applyBuff', on: 'OnUse', who: 'caster', buff: 'dodging' }]
      }
    ]
  },
  { type: 'inventory', slots: 20 },
  { type: 'equipment' }
]

/**
 * Ensures every core character component is present on a character entity,
 * even when spawned from an older template definition.
 */
export function ensureCharacterDefaults(entity: GameEntity): boolean {
  let added = false
  for (const def of DEFAULT_CHARACTER_COMPONENTS) {
    const stat = typeof def.stat === 'string' ? def.stat : null
    const exists = stat
      ? entity.comps.some((c) => c instanceof Resource && c.stat === stat)
      : entity.comps.some((c) => c.type === def.type)
    if (!exists) {
      const made = createComponent(def)
      if (made && entity.add(made)) added = true
    } else if (def.type === 'abilities' && Array.isArray(def.comps)) {
      const holder = entity.comp(Abilities)
      if (holder) {
        for (const subDef of def.comps) {
          const abId = typeof subDef.id === 'string' ? subDef.id : null
          if (abId && !holder.comps.some((c) => c instanceof Ability && c.id === abId)) {
            const made = createComponent(subDef)
            if (made && holder.add(made)) added = true
          }
        }
      }
    }
  }
  return added
}
