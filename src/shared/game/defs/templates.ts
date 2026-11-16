import '../components'
import { componentClass, ENTITY_HOST, type ComponentDef } from '../core'
import { registerDefType, type StarterDef } from './defs'

interface TemplateSpec {
  type: string
  label: string
  plural: string
  icon: string
  description: string
  starter: StarterDef[]
}

const NAMED = new Set(['id', 'label'])
const TEMPLATE_HIDDEN = new Set(['id', 'label', 'description', 'sourceClass', 'permanent'])

import {
  ABILITY_TEMPLATES,
  BUFF_TEMPLATES,
  CHARACTER_TEMPLATES,
  CLASS_TEMPLATES,
  CREATURE_TEMPLATES,
  ITEM_TEMPLATES,
  TRAIT_TEMPLATES
} from '../templateKinds'

export { ABILITY_TEMPLATES, BUFF_TEMPLATES, CHARACTER_TEMPLATES, CLASS_TEMPLATES, CREATURE_TEMPLATES, ITEM_TEMPLATES, TRAIT_TEMPLATES }

const pieces = (list: unknown): number => (Array.isArray(list) ? list.length : 0)

const roots = new Map<string, string>()

export function templateKindOf(rootType: string): string | null {
  return roots.get(rootType) ?? null
}

function componentTemplate(spec: TemplateSpec & { root: string; pieces: string }): void {
  const Class = componentClass(spec.root)
  if (!Class) throw new Error(`No component type ${spec.root} for ${spec.type}`)
  const own = Object.fromEntries(Object.entries(Class.PARAMS).filter(([key]) => !TEMPLATE_HIDDEN.has(key)))
  roots.set(spec.root, spec.type)
  registerDefType({
    ...spec,
    params: { ...own, comps: { label: 'Pieces', kind: 'components', host: spec.root, default: [], description: spec.pieces, section: 'Pieces' } },
    line: (def) => `${pieces(def.values.comps)} piece${pieces(def.values.comps) === 1 ? '' : 's'}`,
    addTo: (data, def) => {
      const { comps, ...values } = def.values
      const named = Object.fromEntries([...NAMED].filter((key) => key in Class.PARAMS).map((key) => [key, key === 'id' ? def.id : def.name]))
      const desc = 'description' in Class.PARAMS && def.notes ? { description: def.notes } : {}
      ;(data.templates[spec.type] ??= {})[def.id] = { type: spec.root, ...values, ...desc, ...named, comps: comps as ComponentDef[] }
    }
  })
}

function entityTemplate(spec: TemplateSpec & { components: string }): void {
  registerDefType({
    ...spec,
    params: { components: { label: 'Components', kind: 'components', host: ENTITY_HOST, default: [], description: spec.components, section: 'Components' } },
    line: (def) => `${pieces(def.values.components)} components`,
    addTo: (data, def) => {
      ;(data.entities[spec.type] ??= {})[def.id] = { ref: { kind: spec.type, id: def.id }, name: def.name, components: def.values.components as ComponentDef[] }
    }
  })
}

componentTemplate({
  type: BUFF_TEMPLATES,
  label: 'Buff',
  plural: 'Buffs',
  icon: 'sparkle',
  description: 'buffs and debuffs: how long they last, how they stack, and the pieces that do their work (damage over time, stat changes)',
  root: 'buff',
  pieces: 'What it does while it lasts: damage over time, stat changes.',
  starter: [
    { id: 'poisoned', name: 'Poisoned', notes: '1 poison damage every 10 minutes for an hour. Stacks up to 3 times.', values: { duration: 3600, potency: 1, maxStacks: 3, comps: [{ type: 'buff.damageOverTime', damageType: 'poison', perHit: 1, every: 600 }] } },
    { id: 'well_fed', name: 'Well fed', notes: '+2 most Health for 6 hours.', values: { duration: 21600, comps: [{ type: 'buff.statBonus', stat: 'health', amount: 2 }] } },
    { id: 'shielded', name: 'Shielded', notes: '+2 Armour for a minute.', values: { duration: 60, comps: [{ type: 'buff.statBonus', stat: 'armour', amount: 2 }] } },
    {
      id: 'static_charge',
      name: 'Static Charge',
      notes: 'Your next hit discharges 5 lightning damage.',
      values: {
        duration: 30,
        tags: ['lightning'],
        comps: [
          {
            type: 'reaction',
            id: 'discharge_lightning',
            signal: 'OnHit',
            target: 'triggerTarget',
            comps: [
              { type: 'action.removeBuff', on: 'OnUse', who: 'caster', buff: 'static_charge', count: 1 },
              { type: 'action.damage', on: 'OnUse', who: 'target', amount: '5', damageType: 'lightning' }
            ]
          }
        ]
      }
    }
  ]
})

componentTemplate({
  type: TRAIT_TEMPLATES,
  label: 'Trait',
  plural: 'Traits',
  icon: 'sparkles',
  description: 'innate passive traits: static stat/filter/visibility pieces or signal-reactive effects that run on game events',
  root: 'trait',
  pieces: 'Passive pieces (Stat bonus, Damage filter, Invisible), abilities, or reactive action pieces triggered by a signal.',
  starter: [
    {
      id: 'static_stride',
      name: 'Static Stride',
      notes: '50% chance whenever you move to charge with Static Charge (+5 lightning damage on your next hit).',
      values: {
        signal: 'OnMove',
        target: 'self',
        chance: 50,
        tags: ['lightning'],
        comps: [{ type: 'action.applyBuff', on: 'OnUse', who: 'caster', buff: 'static_charge' }]
      }
    },
    {
      id: 'phoenix_rebirth',
      name: 'Phoenix Rebirth',
      notes: 'Upon fatal damage, revives once at 50% Health and consumes this trait.',
      values: {
        signal: 'OnBeforeDeath',
        target: 'self',
        maxUses: 1,
        consume: 'remove',
        tags: ['fire', 'rebirth'],
        comps: [{ type: 'action.revive', on: 'OnUse', who: 'caster', fraction: 0.5 }]
      }
    },
    {
      id: 'stone_hide',
      name: 'Stone Hide',
      notes: 'Ignores all incoming hit damage under 5.',
      values: {
        tags: ['resilient'],
        comps: [{ type: 'buff.damageFilter', mode: 'under', amount: 5 }]
      }
    },
    {
      id: 'unseen',
      name: 'Unseen',
      notes: 'Turns this entity or map object invisible while active.',
      values: {
        tags: ['stealth'],
        comps: [{ type: 'buff.invisible' }]
      }
    },
    {
      id: 'arcane_focus',
      name: 'Arcane Focus',
      notes: '+15 max Mana while active.',
      values: {
        tags: ['arcane'],
        comps: [{ type: 'buff.statBonus', stat: 'mana', amount: 15 }]
      }
    },
    {
      id: 'battle_grit',
      name: 'Battle Grit',
      notes: '+10 max Health while active.',
      values: {
        tags: ['martial'],
        comps: [{ type: 'buff.statBonus', stat: 'health', amount: 10 }]
      }
    }
  ]
})

componentTemplate({
  type: ABILITY_TEMPLATES,
  label: 'Ability',
  plural: 'Abilities',
  icon: 'wand-sparkles',
  description: 'abilities and spells: what they cost, cooldown, range, what they take in a battle turn, and the pieces that do their work in a chain',
  root: 'ability',
  pieces: 'What happens when it is used. Each piece runs on an event (OnUse first) and can send the next one.',
  starter: [
    { id: 'cure_wounds', name: 'Cure Wounds', notes: 'Heals someone you touch.', values: { cost: { mana: 4 }, range: 5, comps: [{ type: 'action.heal', on: 'OnUse', amount: '1d8 + 3' }] } },
    { id: 'fire_bolt', name: 'Fire Bolt', notes: 'A mote of fire at one creature. Costs nothing.', values: { range: 120, comps: [{ type: 'action.damage', on: 'OnUse', amount: '1d10', damageType: 'fire' }] } },
    { id: 'guiding_bolt', name: 'Guiding Bolt', notes: 'A flash of radiant light. Skeletons take double.', values: { cost: { mana: 4 }, range: 120, comps: [{ type: 'action.damage', on: 'OnUse', amount: '4d6', damageType: 'radiant' }] } },
    { id: 'unarmed_strike', name: 'Unarmed Strike', notes: 'Fallback melee strike when no weapon is equipped.', values: { range: 5, unarmedOnly: true, comps: [{ type: 'action.damage', on: 'OnUse', amount: 'max(1, 1 + floor((user.str - 10) / 2))', damageType: 'bludgeoning' }] } },
    { id: 'claws', name: 'Claws', notes: 'Two slashing claw strikes (multi-attack).', values: { range: 5, comps: [{ type: 'action.damage', on: 'OnUse', amount: '1d6 + floor((user.str - 10) / 2)', times: 2, damageType: 'slashing' }] } },
    { id: 'bite', name: 'Bite', notes: 'Heavy piercing bite.', values: { range: 5, comps: [{ type: 'action.damage', on: 'OnUse', amount: '1d10 + floor((user.str - 10) / 2)', damageType: 'piercing' }] } }
  ]
})

const ATTACK = { type: 'ability', id: 'attack', label: 'Attack', weaponRange: true, comps: [{ type: 'action.weaponHit' }] }

componentTemplate({
  type: ITEM_TEMPLATES,
  label: 'Item',
  plural: 'Items',
  icon: 'package',
  description: 'items: price, weight, stacking, whether using one uses it up, and the pieces that make it a weapon, armour or something to use',
  root: 'item',
  pieces: 'What it does: worn (stat changes), wielded (a weapon), used (pieces that run on OnUse), resources kept on the item (charges, a magazine), and abilities it gives while worn or carried (a weapon\'s attacks are abilities with Weapon hit).',
  starter: [
    { id: 'healing_draught', name: 'Healing draught', values: { value: 50, weight: 0.5, maxStack: 10, usedUp: true, comps: [{ type: 'action.heal', on: 'OnUse', amount: '2d4 + 2' }] } },
    { id: 'shortsword', name: 'Shortsword', values: { value: 10, weight: 2, comps: [{ type: 'item.weapon', slots: ['mainHand'], range: 5, damage: '1d6', damageType: 'slashing' }, ATTACK] } },
    { id: 'shortbow', name: 'Shortbow', values: { value: 25, weight: 2, comps: [{ type: 'item.weapon', slots: ['mainHand'], range: 80, damage: '1d6', damageType: 'piercing' }, ATTACK] } },
    { id: 'leather_armour', name: 'Leather armour', values: { value: 10, weight: 10, comps: [{ type: 'item.wear', slots: ['chest'], bonuses: { armour: 1 } }] } }
  ]
})

entityTemplate({
  type: CHARACTER_TEMPLATES,
  label: 'Character template',
  plural: 'Character templates',
  icon: 'person-standing',
  description: 'what every character in the game is made of: stats, Health and the other resources, buffs, a spell book, inventory and equipment. A character sheet joining the game is built from one',
  components: 'The components each character starts with. Stats with no base value use the stat default.',
  starter: [
    {
      id: 'adventurer',
      name: 'Adventurer',
      notes: 'Stats, Health, Stamina, Mana, buffs, an unarmed strike + spell book, a 20-stack inventory, and equipment with the starter slots (belt slots come from the Belt slots stat).',
      values: {
        components: [
          { type: 'stats', base: {} },
          { type: 'progression', level: 1, xp: 0, curve: 'standard' },
          { type: 'tags', values: [] },
          { type: 'skills', ranks: {} },
          { type: 'traits' },
          { type: 'classes' },
          { type: 'health', stat: 'health' },
          { type: 'resource', stat: 'stamina' },
          { type: 'resource', stat: 'mana' },
          { type: 'buffs' },
          { type: 'abilities', comps: [{ type: 'ability', id: 'unarmed_strike', label: 'Unarmed Strike', range: 5, unarmedOnly: true, comps: [{ type: 'action.damage', on: 'OnUse', amount: 'max(1, 1 + floor((user.str - 10) / 2))', damageType: 'bludgeoning' }] }] },
          { type: 'inventory', slots: 20 },
          { type: 'equipment' }
        ]
      }
    }
  ]
})

entityTemplate({
  type: CREATURE_TEMPLATES,
  label: 'Creature',
  plural: 'Creatures',
  icon: 'skull',
  description: 'creature templates: what each is made of. Every one placed in a world is a new creature made from its template',
  components: 'The components each creature of this kind is made of.',
  starter: [
    {
      id: 'skeleton',
      name: 'Skeleton',
      notes: 'Takes double radiant and bludgeoning, half piercing, no poison.',
      values: {
        components: [
          { type: 'stats', base: { health: 13, armour: 13, dex: 14, con: 15, int: 6, wis: 8, cha: 5, radiant_resist: -1, bludgeoning_resist: -1, piercing_resist: 0.5, poison_resist: 1 } },
          { type: 'health', stat: 'health' },
          { type: 'buffs' },
          { type: 'abilities', comps: [{ type: 'ability', id: 'bone_shot', label: 'Bone shot', range: 80, comps: [{ type: 'action.damage', on: 'OnUse', amount: '1d6 + 2', damageType: 'piercing' }] }] }
        ]
      }
    },
    {
      id: 'wolf',
      name: 'Wolf',
      values: {
        components: [
          { type: 'stats', base: { health: 11, armour: 13, str: 12, dex: 15, speed: 40 } },
          { type: 'health', stat: 'health' },
          { type: 'buffs' },
          { type: 'abilities', comps: [{ type: 'ability', id: 'bite', label: 'Bite', range: 5, comps: [{ type: 'action.damage', on: 'OnUse', amount: '2d4 + 2', damageType: 'piercing' }] }] }
        ]
      }
    },
    {
      id: 'tiger',
      name: 'Tiger',
      notes: 'Has two innate attacks: a single Bite and a 2× Claws multi-attack.',
      values: {
        components: [
          { type: 'stats', base: { health: 37, armour: 12, str: 17, dex: 15, con: 14, speed: 40 } },
          { type: 'health', stat: 'health' },
          { type: 'buffs' },
          {
            type: 'abilities',
            comps: [
              { type: 'ability', id: 'bite', label: 'Bite', range: 5, comps: [{ type: 'action.damage', on: 'OnUse', amount: '1d10 + 3', damageType: 'piercing' }] },
              { type: 'ability', id: 'claws', label: 'Claws', range: 5, comps: [{ type: 'action.damage', on: 'OnUse', amount: '1d8 + 3', times: 2, damageType: 'slashing' }] }
            ]
          }
        ]
      }
    }
  ]
})
