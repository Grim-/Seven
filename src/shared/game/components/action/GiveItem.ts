import { ITEMS, type EffectGroup } from '../../effectGroups'
import { entryLink, registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent } from '../Action'
import { Inventory } from '../Inventory'
import { registerLegacyTriggerAction } from '../../triggerActions'

export class GiveItem extends ActionPiece {
  static readonly type: string = 'action.giveItem'
  static readonly DESCRIPTION: string = 'Gives the target items, gold or both. With no target, the user receives them.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    item: { kind: 'template' as const, templateKind: 'game_item', default: '', description: 'Which item. Empty gives only gold.' },
    count: { kind: 'formula' as const, default: '1', description: 'How many, e.g. 1d3.' },
    gold: { kind: 'formula' as const, default: '0', description: 'Gold given too.' }
  }
  static readonly SENTENCE: string = 'Give the {who} {count} × {item}[ and {gold} gold]'
  static readonly GROUP: EffectGroup | null = ITEMS
  static readonly ICON: string = 'PackagePlus'

  tooltipRows(): TooltipRow[] {
    const id = String(this.params.item)
    const label = id ? String(this.entity?.catalog.template(GiveItem.PARAMS.item.templateKind, id)?.label || id) : ''
    const parts = [label ? `${String(this.params.count)}× ${label}` : '', String(this.params.gold).trim() !== '0' ? `${String(this.params.gold)} gold` : '']
    return [{ label: 'Gives', value: parts.filter(Boolean).join(' and ') || 'nothing' }]
  }

  handle(event: ActionEvent): void {
    const who = event.target ?? event.user
    const bag = who.comp(Inventory)
    if (!bag) return this.report(event, {}, `${who.named} has no inventory.`)
    const id = String(this.params.item)
    const def = id ? who.catalog.template(GiveItem.PARAMS.item.templateKind, id) : null
    if (id && !def) return this.report(event, { item: id }, `There is no item "${id}".`)
    const count = Math.max(1, Math.round(this.value(String(this.params.count), event)))
    const gold = Math.max(0, Math.round(this.value(String(this.params.gold), event)))
    const given = def ? bag.give(def, count) : 0
    if (gold > 0) bag.changeGold(gold)
    const parts = [given ? `${given}× ${entryLink(GiveItem.PARAMS.item.templateKind, id)}` : '', gold ? `${gold} gold` : ''].filter(Boolean).join(' and ')
    this.report(event, { item: id, given, gold }, parts ? `${who.named} received ${parts}.` : `${who.named} received nothing.`)
    this.next(event)
  }
}

registerComponent(GiveItem)
const n = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
registerLegacyTriggerAction('give_item', (p) => [{ type: GiveItem.type, item: String(p.itemId ?? ''), count: String(n(p.count, 1)), gold: String(n(p.gold, 0)) }])
