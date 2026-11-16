export type SignalHandler = (payload: Record<string, unknown>) => void

export class SignalBus {
  private handlers = new Map<string, Set<SignalHandler>>()

  on(signal: string, fn: SignalHandler): () => void {
    let set = this.handlers.get(signal)
    if (!set) {
      set = new Set()
      this.handlers.set(signal, set)
    }
    set.add(fn)
    return () => set.delete(fn)
  }

  emit(signal: string, payload: Record<string, unknown> = {}): void {
    for (const fn of [...(this.handlers.get(signal) ?? [])]) fn(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}

export interface GameSignalDef {
  id: string
  label: string
  group: string
  note: string
}

export const GAME_SIGNALS: GameSignalDef[] = [
  { id: '', label: 'Always active (no signal)', group: 'Passive', note: 'Runs continuously while active conditions hold.' },
  { id: 'OnSpawn', label: 'On Spawn', group: 'Lifecycle', note: 'Entity or creature spawns into play.' },
  { id: 'OnDestroy', label: 'On Destroy', group: 'Lifecycle', note: 'Entity or map object is destroyed or leaves play.' },
  { id: 'OnMove', label: 'On Move', group: 'Movement & Actions', note: 'Moves on a map or in tactical combat (payload: distance).' },
  { id: 'OnUse', label: 'On Use', group: 'Movement & Actions', note: 'Ability, reaction, or piece activates.' },
  { id: 'OnHit', label: 'On Hit', group: 'Combat & Health', note: 'Attacker deals hit damage (payload: target, damage, damageType).' },
  { id: 'OnHurt', label: 'On Hurt', group: 'Combat & Health', note: 'Entity takes damage (payload: source, amount, type).' },
  { id: 'OnDamageDealt', label: 'On Damage Dealt', group: 'Combat & Health', note: 'Attacker deals any damage to a target.' },
  { id: 'OnHealthLost', label: 'On Health Lost', group: 'Combat & Health', note: 'Health decreases (payload: amount, type, cause).' },
  { id: 'OnHealed', label: 'On Healed', group: 'Combat & Health', note: 'Health is restored (payload: amount, cause).' },
  { id: 'OnBeforeDeath', label: 'On Before Death', group: 'Combat & Health', note: 'Before lethal death resolves; healing revives (payload: cause).' },
  { id: 'OnDeath', label: 'On Death', group: 'Combat & Health', note: 'Entity dies at zero health (payload: cause).' },
  { id: 'OnRevived', label: 'On Revived', group: 'Combat & Health', note: 'Revived from death or zero health (payload: fraction).' },
  { id: 'OnBuffApplied', label: 'On Buff Applied', group: 'Buffs & Items', note: 'Receives a buff (payload: buff, source).' },
  { id: 'OnBuffStacked', label: 'On Buff Stacked', group: 'Buffs & Items', note: 'Existing buff gains stacks (payload: buff, stacks).' },
  { id: 'OnBuffRemoved', label: 'On Buff Removed', group: 'Buffs & Items', note: 'Buff expires or is removed (payload: buff).' },
  { id: 'OnItemUsed', label: 'On Item Used', group: 'Buffs & Items', note: 'Uses a consumable or item (payload: item).' },
  { id: 'OnItemGained', label: 'On Item Gained', group: 'Buffs & Items', note: 'Receives items into inventory (payload: item, count).' },
  { id: 'OnItemLost', label: 'On Item Lost', group: 'Buffs & Items', note: 'Loses or spends items (payload: item, count).' },
  { id: 'OnGoldChanged', label: 'On Gold Changed', group: 'Buffs & Items', note: 'Gold count changes (payload: gold, change).' },
  { id: 'OnEquipped', label: 'On Equipped', group: 'Buffs & Items', note: 'Equips an item to a slot (payload: item, slot).' },
  { id: 'OnUnequipped', label: 'On Unequipped', group: 'Buffs & Items', note: 'Unequips an item from a slot (payload: item, slot).' },
  { id: 'OnXpGained', label: 'On XP Gained', group: 'Progression & Story', note: 'Earns XP (payload: amount, level, reason).' },
  { id: 'OnLevelUp', label: 'On Level Up', group: 'Progression & Story', note: 'Character or class levels up (payload: level, previous, classId).' },
  { id: 'OnClassGained', label: 'On Class Gained', group: 'Progression & Story', note: 'Acquires a class (payload: classId, label, level).' },
  { id: 'OnClassLost', label: 'On Class Lost', group: 'Progression & Story', note: 'Permanently loses a class (payload: classId, label, reason).' },
  { id: 'OnClassRestricted', label: 'On Class Restricted', group: 'Progression & Story', note: 'Class restriction toggles (payload: classId, restricted).' },
  { id: 'OnClassOffer', label: 'On Class Offer', group: 'Progression & Story', note: 'Clutch class unlock becomes available (payload: classId, signal).' },
  { id: 'OnTraitGained', label: 'On Trait Gained', group: 'Progression & Story', note: 'Gains an innate trait (payload: trait, label, sourceClass).' },
  { id: 'OnTraitLost', label: 'On Trait Lost', group: 'Progression & Story', note: 'Loses a trait (payload: trait, label, reason).' },
  { id: 'OnStoryMoment', label: 'On Story Moment', group: 'Progression & Story', note: 'Story event triggers on character (payload: tag, summary, flags).' }
]

export const SIGNAL_PAYLOAD_FIELDS: { id: string; label: string; group: string; note: string }[] = [
  { id: 'type', label: 'type (Damage type)', group: 'Combat', note: 'Damage type id on OnHurt / OnHealthLost (e.g. fire, radiant).' },
  { id: 'damageType', label: 'damageType', group: 'Combat', note: 'Damage type id on OnHit.' },
  { id: 'cause', label: 'cause', group: 'Combat', note: 'Ability, buff, or item id causing damage/death/healing.' },
  { id: 'amount', label: 'amount', group: 'Combat', note: 'Numeric amount (damage, healing, XP).' },
  { id: 'distance', label: 'distance', group: 'Movement', note: 'Feet moved on OnMove.' },
  { id: 'buff', label: 'buff', group: 'Buffs & Items', note: 'Buff template id on buff events.' },
  { id: 'item', label: 'item', group: 'Buffs & Items', note: 'Item template id on item/equipment events.' },
  { id: 'slot', label: 'slot', group: 'Buffs & Items', note: 'Equipment slot id on equip/unequip events.' },
  { id: 'classId', label: 'classId', group: 'Progression', note: 'Class template id on class/level-up events.' },
  { id: 'trait', label: 'trait', group: 'Progression', note: 'Trait template id on trait gained/lost.' },
  { id: 'level', label: 'level', group: 'Progression', note: 'New level reached on OnLevelUp.' },
  { id: 'tag', label: 'tag', group: 'Story', note: 'Tag passed to OnStoryMoment.' },
  { id: 'restricted', label: 'restricted', group: 'Progression', note: 'Boolean restriction flag on OnClassRestricted.' },
  { id: 'reason', label: 'reason', group: 'General', note: 'Reason text attached to progression or removal events.' }
]

export function signalLabel(id: string): string {
  const found = GAME_SIGNALS.find((s) => s.id === id)
  return found ? (found.id ? found.label : 'always') : id
}
