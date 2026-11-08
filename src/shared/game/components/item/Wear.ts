import { registerComponent, type TooltipRow } from '../../core'
import { Wearable, sameSlot, slotName } from '../Inventory'

export class Wear extends Wearable {
  static readonly type: string = 'item.wear'
  static readonly DESCRIPTION: string = 'Makes the item wearable in the given slots, changing stats and resists while worn.'
  static readonly PARAMS = {
    slots: { kind: 'list' as const, default: [], of: { kind: 'template' as const, templateKind: 'slot', default: '', description: 'A slot.' }, description: 'Slots it can go in.' },
    bonuses: { kind: 'values' as const, templateKind: 'stat', default: {}, description: 'Stat or resist id to change while worn.' }
  }

  fits(slot: string): boolean {
    return (this.params.slots as string[]).some((s) => sameSlot(s, slot))
  }

  tooltipRows(): TooltipRow[] {
    const catalog = this.entity?.catalog
    const bonuses = Object.entries(this.params.bonuses as Record<string, number>)
      .filter(([, n]) => n)
      .map(([stat, n]) => ({ label: catalog?.stat(stat)?.label ?? stat, value: `${n > 0 ? '+' : ''}${n}` }))
    return [...bonuses, { label: 'Worn in', value: (this.params.slots as string[]).map((s) => slotName(catalog, s)).join(', ') }]
  }

  modifyStat(_domain: string, key: string, value: number): number {
    if (!this.worn) return value
    return value + ((this.params.bonuses as Record<string, number>)[key] ?? 0)
  }
}

registerComponent(Wear)
