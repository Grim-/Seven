import type { ConditionDef } from '../core'
import { registerDefType, type GameDef, type StarterDef } from './defs'
import { CLASS_TEMPLATES } from '../templateKinds'

export interface ClassReward {
  level: number
  stats?: Record<string, number>
  skills?: Record<string, number>
  traits?: string[]
  abilities?: string[]
  tags?: string[]
  permanent?: boolean
  summary?: string
}

export interface ClutchTrigger {
  signal: string
  when?: ConditionDef[]
  chance?: number
  oncePerCharacter?: boolean
  prompt?: string
}

export interface ClassTemplateDef {
  id: string
  label: string
  description: string
  parentClass: string
  curve: string
  tags: string[]
  unlockWhen: ConditionDef[]
  activeWhen: ConditionDef[]
  rewards: ClassReward[]
  clutchTriggers: ClutchTrigger[]
}

const STARTER_CLASSES: StarterDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    notes: 'Frontline martial class focused on durability, athletics, and heavy blows.',
    values: {
      parentClass: '',
      curve: 'standard',
      tags: ['martial'],
      unlockWhen: [],
      activeWhen: [],
      rewards: [
        {
          level: 1,
          stats: { health: 10, str: 1 },
          skills: { athletics: 2 },
          traits: ['battle_grit'],
          tags: ['martial'],
          summary: '+10 Health, +1 Strength, +2 Athletics, Battle Grit'
        },
        {
          level: 2,
          stats: { armour: 1 },
          traits: ['stone_hide'],
          summary: '+1 Armour, Stone Hide'
        },
        {
          level: 3,
          stats: { str: 1, health: 10 },
          skills: { athletics: 1 },
          permanent: true,
          summary: 'Permanent +1 Strength, +10 Health, +1 Athletics'
        }
      ],
      clutchTriggers: []
    }
  },
  {
    id: 'mage',
    name: 'Mage',
    notes: 'Arcane spellcaster with expanded mana reserves and elemental magic.',
    values: {
      parentClass: '',
      curve: 'standard',
      tags: ['arcane', 'caster'],
      unlockWhen: [],
      activeWhen: [],
      rewards: [
        {
          level: 1,
          stats: { mana: 20, int: 1 },
          skills: { arcana: 2 },
          traits: ['arcane_focus'],
          abilities: ['fire_bolt'],
          tags: ['arcane'],
          summary: '+20 Mana, +1 Intelligence, +2 Arcana, Arcane Focus, Fire Bolt'
        },
        {
          level: 2,
          stats: { mana: 15 },
          skills: { arcana: 1 },
          traits: ['static_stride'],
          summary: '+15 Mana, +1 Arcana, Static Stride'
        },
        {
          level: 3,
          stats: { int: 1 },
          permanent: true,
          summary: 'Permanent +1 Intelligence'
        }
      ],
      clutchTriggers: []
    }
  },
  {
    id: 'rogue',
    name: 'Rogue',
    notes: 'Agile skirmisher excelling at speed, stealth, and evasion.',
    values: {
      parentClass: '',
      curve: 'fast',
      tags: ['stealth', 'agile'],
      unlockWhen: [],
      activeWhen: [],
      rewards: [
        {
          level: 1,
          stats: { speed: 5, dex: 1 },
          skills: { stealth: 2, acrobatics: 2 },
          tags: ['agile'],
          summary: '+5 ft Speed, +1 Dexterity, +2 Stealth, +2 Acrobatics'
        },
        {
          level: 2,
          traits: ['unseen'],
          summary: 'Unseen trait'
        },
        {
          level: 3,
          stats: { dex: 1 },
          permanent: true,
          summary: 'Permanent +1 Dexterity'
        }
      ],
      clutchTriggers: []
    }
  },
  {
    id: 'pyromancer',
    name: 'Pyromancer',
    notes: 'Mage specialization channeling scorching flame and rebirth from ash.',
    values: {
      parentClass: 'mage',
      curve: 'standard',
      tags: ['arcane', 'fire'],
      unlockWhen: [{ type: 'class', id: 'mage', minLevel: 2, activeOnly: true }],
      activeWhen: [{ type: 'class', id: 'mage', activeOnly: true }],
      rewards: [
        {
          level: 1,
          stats: { fire_resist: 25, mana: 15 },
          abilities: ['fire_bolt'],
          tags: ['fire'],
          summary: '+25% Fire Resist, +15 Mana, Fire Bolt'
        },
        {
          level: 2,
          traits: ['phoenix_rebirth'],
          summary: 'Phoenix Rebirth trait'
        }
      ],
      clutchTriggers: []
    }
  },
  {
    id: 'berserker',
    name: 'Berserker',
    notes: 'Clutch awakening forged at the brink of defeat: raw fury, resilience, and strength.',
    values: {
      parentClass: '',
      curve: 'fast',
      tags: ['rage', 'martial'],
      unlockWhen: [{ type: 'level', min: 1 }],
      activeWhen: [],
      rewards: [
        {
          level: 1,
          stats: { str: 2, health: 15 },
          traits: ['battle_grit'],
          tags: ['rage'],
          summary: '+2 Strength, +15 Health, Battle Grit'
        },
        {
          level: 2,
          traits: ['stone_hide'],
          summary: 'Stone Hide trait'
        }
      ],
      clutchTriggers: [
        {
          signal: 'OnHurt',
          when: [{ type: 'healthPct', max: 35 }],
          chance: 60,
          oncePerCharacter: true,
          prompt: 'Cornered and bleeding, an untamed fury surges inside you. Embrace the Berserker class?'
        }
      ]
    }
  }
]

registerDefType({
  type: CLASS_TEMPLATES,
  label: 'Class',
  plural: 'Classes',
  icon: 'Award',
  description: 'Optional character classes and specializations with independent XP, milestone rewards, conditions, and clutch unlock triggers.',
  params: {
    parentClass: {
      label: 'Specialization Of',
      kind: 'template',
      templateKind: CLASS_TEMPLATES,
      default: '',
      description: 'Optional parent class if this is a specialization.'
    },
    curve: {
      label: 'XP Curve',
      kind: 'choice',
      choices: ['standard', 'fast', 'slow'],
      default: 'standard',
      description: 'How quickly this class levels up independently.'
    },
    tags: {
      label: 'Tags',
      kind: 'list',
      default: [],
      description: 'Keyword tags granted while this class is active.'
    },
    unlockWhen: {
      label: 'Unlock Conditions',
      kind: 'conditions',
      default: [],
      description: 'All conditions required to learn or unlock this class.',
      section: 'Unlock Conditions'
    },
    activeWhen: {
      label: 'Active Conditions',
      kind: 'conditions',
      default: [],
      description: 'Conditions that must hold for this class and its rewards to remain active (restricted otherwise).',
      section: 'Active Conditions'
    },
    rewards: {
      label: 'Level Milestones',
      kind: 'classRewards',
      default: [],
      description: 'Stats, skills, traits, abilities, and tags granted when this class reaches each level.',
      section: 'Level Milestones'
    },
    clutchTriggers: {
      label: 'Clutch Unlock Triggers',
      kind: 'clutchTriggers',
      default: [],
      description: 'Event triggers that offer this class to the user in dire or story moments.',
      section: 'Clutch Unlock Triggers'
    }
  },
  starter: STARTER_CLASSES,
  line: (def: GameDef) => {
    const parent = String(def.values.parentClass || '')
    const rewards = Array.isArray(def.values.rewards) ? def.values.rewards.length : 0
    return parent ? `Specialization of ${parent} · ${rewards} milestones` : `Class · ${rewards} milestones`
  },
  addTo: (data, def) => {
    ;(data.templates[CLASS_TEMPLATES] ??= {})[def.id] = {
      type: 'character_class',
      id: def.id,
      label: def.name,
      description: def.notes,
      ...def.values
    }
  }
})

export function parseClassTemplateDef(raw: { id: string; [key: string]: unknown }): ClassTemplateDef {
  return {
    id: raw.id,
    label: String(raw.label || raw.name || raw.id),
    description: String(raw.description || ''),
    parentClass: String(raw.parentClass || ''),
    curve: String(raw.curve || 'standard'),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).filter(Boolean) : [],
    unlockWhen: Array.isArray(raw.unlockWhen) ? (raw.unlockWhen as ConditionDef[]) : [],
    activeWhen: Array.isArray(raw.activeWhen) ? (raw.activeWhen as ConditionDef[]) : [],
    rewards: Array.isArray(raw.rewards) ? (raw.rewards as ClassReward[]) : [],
    clutchTriggers: Array.isArray(raw.clutchTriggers) ? (raw.clutchTriggers as ClutchTrigger[]) : []
  }
}
