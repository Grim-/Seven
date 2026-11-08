import { registerComponent, type TooltipRow } from '../../core'
import { ActionPiece, type ActionEvent, type UseContext } from '../Action'
import { Inventory, Item } from '../Inventory'
import { ItemResource } from '../item/ItemResource'

export class Refill extends ActionPiece {
  static readonly type: string = 'action.refill'
  static readonly DESCRIPTION: string = 'Fills a resource on the item this ability is inside with items from the user\'s inventory, such as reloading a magazine with bullets.'
  static readonly PARAMS = {
    ...ActionPiece.PARAMS_BASE,
    resource: { kind: 'text' as const, default: 'charges', description: 'The item resource id to fill.' },
    item: { kind: 'template' as const, templateKind: 'game_item', default: '', description: 'The item taken from the inventory.' },
    perItem: { kind: 'number' as const, default: 1, min: 0.001, description: 'How much each item taken adds.' }
  }

  private pool(): ItemResource | null {
    const item = this.action?.parent
    return item instanceof Item ? ItemResource.of(item, String(this.params.resource)) : null
  }

  private stacks(ctx: { user: UseContext['user'] }): Item[] {
    return ctx.user.comp(Inventory)?.items.filter((i) => i.id === String(this.params.item)) ?? []
  }

  canUse(ctx: UseContext): true | string {
    const pool = this.pool()
    if (!pool) return `there is no ${String(this.params.resource)} to fill`
    if (pool.get() >= pool.max()) return `${String(pool.params.label || pool.id)} is full`
    if (!this.stacks(ctx).length) return `no ${String(ctx.user.catalog.template(Refill.PARAMS.item.templateKind, String(this.params.item))?.label || this.params.item)} left`
    return true
  }

  handle(event: ActionEvent): void {
    const pool = this.pool()
    const bag = event.user.comp(Inventory)
    if (!pool || !bag) return
    const per = Number(this.params.perItem)
    let wanted = Math.ceil((pool.max() - pool.get()) / per - 1e-9)
    for (const stack of this.stacks(event)) {
      if (wanted <= 0) break
      const taken = bag.take(stack, wanted)
      pool.change(taken * per)
      wanted -= taken
    }
    this.next(event)
  }

  tooltipRows(): TooltipRow[] {
    const id = String(this.params.item)
    const label = String(this.entity?.catalog.template(Refill.PARAMS.item.templateKind, id)?.label || id)
    return [{ label: 'Refills', value: `${String(this.params.resource)} from ${label}` }]
  }
}

registerComponent(Refill)
