import { toId } from '../ids'

export type TriggerActionType =
  | 'change_map'
  | 'change_world'
  | 'give_item'
  | 'remove_item'
  | 'set_flag'
  | 'modify_health'
  | 'spawn_creature'
  | 'start_combat'
  | 'play_cue'
  | 'script_call'
  | string

export interface StoredTriggerAction {
  id: string
  name: string
  actionType: TriggerActionType
  description: string
  params: Record<string, unknown>
  tags: string[]
  updatedAt: number
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function cleanStoredTriggerAction(raw: unknown): StoredTriggerAction | null {
  const v = obj(raw)
  const name = str(v.name).trim()
  if (!name) return null
  const id = (str(v.id) && toId(str(v.id))) || toId(name)
  const actionType = str(v.actionType).trim() || 'change_map'
  const tags = Array.isArray(v.tags)
    ? v.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())).map((t) => toId(t))
    : []

  return {
    id,
    name,
    actionType,
    description: str(v.description),
    params: obj(v.params),
    tags,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now()
  }
}

export function blankStoredTriggerAction(): StoredTriggerAction {
  return {
    id: '',
    name: '',
    actionType: 'give_item',
    description: '',
    params: {},
    tags: [],
    updatedAt: Date.now()
  }
}

export const STARTER_TRIGGER_ACTIONS: StoredTriggerAction[] = [
  {
    id: 'award_50_gold',
    name: 'Award 50 Gold',
    actionType: 'give_item',
    description: 'Awards 50 gold currency directly into the party wallet.',
    params: { gold: 50 },
    tags: ['loot', 'currency'],
    updatedAt: 1700000000000
  },
  {
    id: 'award_health_potion',
    name: 'Award Health Potion',
    actionType: 'give_item',
    description: 'Awards a Health Potion consumable to party inventory.',
    params: { itemId: 'item_potion_healing', count: 1 },
    tags: ['loot', 'potion'],
    updatedAt: 1700000000000
  },
  {
    id: 'heal_party_25',
    name: 'Heal Party (+25 HP)',
    actionType: 'modify_health',
    description: 'Restores 25 hit points across all party members.',
    params: { amount: 25, target: 'party', damageType: 'radiant' },
    tags: ['heal', 'party'],
    updatedAt: 1700000000000
  },
  {
    id: 'trap_damage_10',
    name: 'Trap Damage (-10 HP)',
    actionType: 'modify_health',
    description: 'Sprung trap inflicts 10 damage across all party members.',
    params: { amount: -10, target: 'party', damageType: 'piercing' },
    tags: ['trap', 'damage'],
    updatedAt: 1700000000000
  },
  {
    id: 'rest_party_camp',
    name: 'Rest Party at Campfire (+50 HP)',
    actionType: 'rest_party',
    description: 'Rests the party and restores up to 50 HP per member.',
    params: { healAmount: 50, restMessage: 'The party rests by the warm embers and tends their wounds.' },
    tags: ['rest', 'recovery'],
    updatedAt: 1700000000000
  },
  {
    id: 'open_general_store',
    name: 'Open Merchant Shop',
    actionType: 'open_shop',
    description: 'Opens trade storefront with goods and supplies.',
    params: { shopTitle: 'Adventurer Supplies & Wares', stockMode: 'loot_table' },
    tags: ['shop', 'trade'],
    updatedAt: 1700000000000
  },
  {
    id: 'roll_dungeon_loot',
    name: 'Roll Dungeon Loot Table',
    actionType: 'roll_loot_table',
    description: 'Rolls on the active dungeon loot table for random rewards.',
    params: { tableId: 'dungeon_loot' },
    tags: ['loot', 'table'],
    updatedAt: 1700000000000
  },
  {
    id: 'unlock_target_object',
    name: 'Unlock / Open Target Object',
    actionType: 'alter_map_object',
    description: 'Changes target map prop or door to passable/unlocked state.',
    params: { collision: 'passable' },
    tags: ['map', 'object'],
    updatedAt: 1700000000000
  },
  {
    id: 'set_objective_flag',
    name: 'Set Flag: quest_objective_met',
    actionType: 'set_flag',
    description: 'Sets the world flag "quest_objective_met" to true.',
    params: { flag: 'quest_objective_met', operation: 'set', value: 'true' },
    tags: ['flag', 'quest'],
    updatedAt: 1700000000000
  },
  {
    id: 'clear_objective_flag',
    name: 'Clear Flag: quest_objective_met',
    actionType: 'set_flag',
    description: 'Clears the world flag "quest_objective_met" (sets false).',
    params: { flag: 'quest_objective_met', operation: 'clear' },
    tags: ['flag', 'quest'],
    updatedAt: 1700000000000
  },
  {
    id: 'initiate_combat',
    name: 'Initiate Combat Encounter',
    actionType: 'start_combat',
    description: 'Transitions to tactical turn-based combat with present hostiles.',
    params: {},
    tags: ['combat', 'encounter'],
    updatedAt: 1700000000000
  },
  {
    id: 'play_victory_cue',
    name: 'Play Victory Fanfare Cue',
    actionType: 'play_cue',
    description: 'Triggers victory fanfare audio cue.',
    params: { cue: 'victory_fanfare' },
    tags: ['audio', 'cue'],
    updatedAt: 1700000000000
  }
]

export function storedTriggerActionText(a: StoredTriggerAction): string {
  const lines: string[] = [
    `# Trigger Action: ${a.name}`,
    `Type: ${a.actionType}`
  ]
  if (a.description) lines.push(a.description)
  if (Object.keys(a.params).length > 0) {
    lines.push(`Parameters:\n\`\`\`json\n${JSON.stringify(a.params, null, 2)}\n\`\`\``)
  }
  if (a.tags.length) lines.push(`Tags: ${a.tags.map((tg) => `#${tg}`).join(' ')}`)
  return lines.join('\n\n')
}
