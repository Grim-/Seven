import { ITEMS, type EffectGroup } from '../../effectGroups'
import { entryLink, registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Inventory } from '../Inventory'
import { registerLegacyTriggerAction } from '../../triggerActions'

export class TakeItem extends ActionPiece {
  static readonly type: string = 'action.takeItem'
  static readonly DESCRIPTION: string = 'Takes items from the target. With no target, they are taken from the user.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    item: { kind: 'template' as const, templateKind: 'game_item', default: '', description: 'Which item.' },
    count: { kind: 'formula' as const, default: '1', description: 'How many.' }
  }
  static readonly SENTENCE: string = 'Take {count} × {item} from the {who}'
  static readonly GROUP: EffectGroup | null = ITEMS
  static readonly ICON: string = 'PackageMinus'

  tooltipRows(): TooltipRow[] {
    const id = String(this.params.item)
    const label = id ? String(this.entity?.catalog.template(TakeItem.PARAMS.item.templateKind, id)?.label || id) : 'nothing'
    return [{ label: 'Takes', value: `${String(this.params.count)}× ${label}` }]
  }

  handle(event: ActionEvent): void {
    const who = event.target ?? event.user
    const bag = who.comp(Inventory)
    if (!bag) return this.report(event, {}, `${who.named} has no inventory.`)
    const id = String(this.params.item)
    const count = Math.max(1, Math.round(this.value(String(this.params.count), event)))
    let left = count
    for (const stack of [...bag.items]) if (left > 0 && stack.id === id) left -= bag.take(stack, left)
    const taken = count - left
    const label = entryLink(TakeItem.PARAMS.item.templateKind, id)
    this.report(event, { item: id, taken }, taken ? `${taken}× ${label} taken from ${who.named}.` : `${who.named} has no ${label} to take.`)
    this.next(event)
  }
}

registerComponent(TakeItem)
const n = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
registerLegacyTriggerAction('remove_item', (p) => [{ type: TakeItem.type, item: String(p.itemId ?? ''), count: String(n(p.count, 1)) }])
