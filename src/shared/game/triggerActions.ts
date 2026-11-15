import { toId } from '../ids'
import { cleanComponents } from './core/params'
import type { ComponentDef } from './core/registry'

export interface StoredTriggerAction {
  id: string
  name: string
  description: string
  effects: ComponentDef[]
  tags: string[]
  updatedAt: number
  actionType?: string
  params?: Record<string, unknown>
}

type LegacyReader = (params: Record<string, unknown>) => ComponentDef[]

const legacy = new Map<string, LegacyReader>()

export function registerLegacyTriggerAction(type: string, read: LegacyReader): void {
  legacy.set(type, read)
}

export function triggerActionEffects(a: StoredTriggerAction): ComponentDef[] {
  if (a.effects.length || !a.actionType) return a.effects
  return legacy.get(a.actionType)?.(a.params ?? {}) ?? []
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function cleanStoredTriggerAction(raw: unknown): StoredTriggerAction | null {
  const v = obj(raw)
  const name = str(v.name).trim()
  if (!name) return null
  const id = (str(v.id) && toId(str(v.id))) || toId(name)
  const tags = Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())).map((t) => toId(t)) : []
  const effects = cleanComponents(v.effects)
  const old = !effects.length && str(v.actionType).trim() ? { actionType: str(v.actionType).trim(), params: obj(v.params) } : {}
  return { id, name, description: str(v.description), effects, tags, updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(), ...old }
}

export function blankStoredTriggerAction(): StoredTriggerAction {
  return { id: '', name: '', description: '', effects: [], tags: [], updatedAt: Date.now() }
}

const starter = (id: string, name: string, description: string, tags: string[], effects: ComponentDef[]): StoredTriggerAction => ({ id, name, description, effects, tags, updatedAt: 1700000000000 })

export const STARTER_TRIGGER_ACTIONS: StoredTriggerAction[] = [
  starter('award_50_gold', 'Award 50 Gold', 'Gives the target 50 gold.', ['loot', 'currency'], [{ type: 'action.giveItem', item: '', count: '1', gold: '50' }]),
  starter('heal_25', 'Heal 25', 'Restores 25 health to the target.', ['heal'], [{ type: 'action.heal', amount: '25' }]),
  starter('trap_damage_10', 'Trap Damage 10', 'A sprung trap deals 10 piercing damage to the target.', ['trap', 'damage'], [{ type: 'action.damage', amount: '10', damageType: 'piercing' }]),
  starter('roll_dungeon_loot', 'Roll Dungeon Loot', 'Rolls the dungeon loot table and gives the target what comes up.', ['loot', 'table'], [{ type: 'world.rollLoot', table: 'dungeon_loot' }]),
  starter('set_objective_flag', 'Set Flag: quest_objective_met', 'Sets the save flag quest_objective_met.', ['flag', 'quest'], [{ type: 'world.setFlag', flag: 'quest_objective_met', value: 'true' }]),
  starter('initiate_combat', 'Start a Fight', 'Starts turn-based combat.', ['combat', 'encounter'], [{ type: 'world.startCombat', creature: '' }])
]

export function storedTriggerActionText(a: StoredTriggerAction): string {
  const effects = triggerActionEffects(a)
  return [
    `# Trigger Action: ${a.name}`,
    a.description,
    effects.length ? `Effects:\n\`\`\`json\n${JSON.stringify(effects, null, 2)}\n\`\`\`` : '',
    a.tags.length ? `Tags: ${a.tags.map((tg) => `#${tg}`).join(' ')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')
}
