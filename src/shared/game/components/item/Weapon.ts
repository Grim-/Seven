import { registerComponent, type TooltipRow } from '../../core'
import { Wearable, sameSlot, slotName } from '../Inventory'

export class Weapon extends Wearable {
  static readonly type: string = 'item.weapon'
  static readonly DESCRIPTION: string = 'Makes the item a weapon: wielded in hand slots, with a reach, damage and damage type. Its attacks are abilities inside the item that use these (Weapon hit).'
  static readonly PARAMS = {
    slots: { kind: 'list' as const, default: ['mainHand'], of: { kind: 'template' as const, templateKind: 'slot', default: '', description: 'A slot.' }, description: 'Slots it can be wielded in.' },
    range: { kind: 'number' as const, default: 5, min: 0, description: 'Reach in feet: 5 is melee.' },
    damage: { kind: 'formula' as const, default: '1d6', description: 'Damage on hit, e.g. 1d8 + user.str.' },
    damageType: { kind: 'template' as const, templateKind: 'damage_type', default: '', description: 'What the damage counts as.' }
  }

  fits(slot: string): boolean {
    return (this.params.slots as string[]).some((s) => sameSlot(s, slot))
  }

  reach(): number {
    return Number(this.params.range)
  }

  tooltipRows(): TooltipRow[] {
    const type = String(this.params.damageType)
    const label = type ? (this.entity?.catalog.damageType(type)?.label ?? type) : ''
    const range = this.reach()
    return [
      { label: 'Damage', value: `${String(this.params.damage)}${label ? ` ${label}` : ''}` },
      { label: 'Range', value: range <= 5 ? `${range} ft, melee` : `${range} ft` },
      { label: 'Wielded in', value: (this.params.slots as string[]).map((s) => slotName(this.entity?.catalog, s)).join(', ') }
    ]
  }
}

registerComponent(Weapon)
