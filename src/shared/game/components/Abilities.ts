import { Component, registerComponent, type GameEntity, type TooltipRow } from '../core'
import { Resource } from './Resource'
import { Action, ActionPiece, type UseContext } from './Action'
import { Inventory, Item, Wearable } from './Inventory'
import { ItemResource } from './item/ItemResource'

export { ActionPiece as AbilityPiece, type ActionEvent as AbilityEvent } from './Action'

export class Ability extends Action {
  static readonly type: string = 'ability'
  static readonly DESCRIPTION: string = 'An ability or spell. Using it pays its cost, starts its cooldown and sends OnUse to its pieces, which chain by sending further events.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: '', description: 'Which ability this is.' },
    label: { kind: 'text' as const, default: '', description: 'Its name.' },
    cost: { kind: 'values' as const, templateKind: 'stat', default: {}, description: 'Resource stat id to amount spent on use.' },
    cooldown: { kind: 'number' as const, default: 0, min: 0, description: 'Seconds before it can be used again.' },
    range: { kind: 'number' as const, default: 5, min: 0, description: 'Reach in feet. 0 is self only.' },
    weaponRange: { kind: 'flag' as const, default: false, description: 'Use the reach of the weapon it is inside instead of Range.' },
    itemCost: { kind: 'values' as const, default: {}, description: 'Item resource id (charges, a magazine) to amount spent, from the item it is inside.' },
    uses: { kind: 'values' as const, templateKind: 'game_item', default: {}, description: 'Items used up from the inventory on each use, e.g. an arrow.' },
    action: { kind: 'choice' as const, default: 'action', choices: ['action', 'bonus', 'free'], description: 'What it takes in a battle turn.' }
  }
  cooling = 0

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Abilities || host instanceof Item ? true : 'an ability belongs in abilities or inside an item'
  }

  get cost(): Record<string, number> {
    return this.params.cost as Record<string, number>
  }

  get itemCost(): Record<string, number> {
    return this.params.itemCost as Record<string, number>
  }

  get usesItems(): Record<string, number> {
    return this.params.uses as Record<string, number>
  }

  get item(): Item | null {
    return this.parent instanceof Item ? this.parent : null
  }

  available(): boolean {
    const item = this.item
    return item ? item.grantsAbilities() : this.parent instanceof Abilities
  }

  reach(): number {
    const weapon = this.params.weaponRange ? this.item?.comps.find((c): c is Wearable => c instanceof Wearable && c.reach() !== null) : undefined
    return weapon ? (weapon.reach() ?? 0) : Number(this.params.range)
  }

  private carried(user: GameEntity, id: string): number {
    return user.comp(Inventory)?.items.reduce((sum, i) => sum + (i.id === id ? i.count : 0), 0) ?? 0
  }

  canUse(ctx: UseContext): true | string {
    if (!this.available()) return this.item ? `${String(this.item.params.label || this.item.id)} has to be worn` : 'it is not known'
    if (this.cooling > 0) return `ready in ${Math.ceil(this.cooling)} s`
    if (ctx.distance > this.reach() && ctx.target !== ctx.user) return 'out of range'
    for (const [stat, amount] of Object.entries(this.cost)) if ((Resource.of(ctx.user, stat)?.get() ?? 0) < amount) return `not enough ${ctx.user.catalog.stat(stat)?.label ?? stat}`
    for (const [id, amount] of Object.entries(this.itemCost)) {
      const pool = this.item ? ItemResource.of(this.item, id) : null
      if ((pool?.get() ?? 0) < amount) return `not enough ${pool ? String(pool.params.label || id) : id}`
    }
    for (const [id, count] of Object.entries(this.usesItems)) if (this.carried(ctx.user, id) < count) return `needs ${count} ${String(ctx.user.catalog.template(Ability.PARAMS.uses.templateKind, id)?.label || id)}`
    for (const c of this.comps) {
      const check = c instanceof ActionPiece ? c.canUse(ctx) : true
      if (check !== true) return check
    }
    return true
  }

  use(ctx: UseContext): true | string {
    const check = this.canUse(ctx)
    if (check !== true) return check
    for (const [stat, amount] of Object.entries(this.cost)) Resource.of(ctx.user, stat)?.spend(amount)
    for (const [id, amount] of Object.entries(this.itemCost)) if (this.item) ItemResource.of(this.item, id)?.spend(amount)
    const bag = ctx.user.comp(Inventory)
    for (const [id, count] of Object.entries(this.usesItems)) {
      let left = count
      for (const stack of [...(bag?.items ?? [])]) if (left > 0 && stack.id === id) left -= bag!.take(stack, left)
    }
    this.cooling = Number(this.params.cooldown)
    ctx.user.emit('OnCast', { ability: this.id, target: ctx.target?.uid ?? null })
    this.fire('OnUse', ctx)
    return true
  }

  score(ctx: UseContext): number {
    if (this.canUse(ctx) !== true) return 0
    return this.comps.reduce((sum, c) => sum + (c instanceof ActionPiece ? c.score(ctx) : 0), 0)
  }

  tickSim(seconds: number): void {
    super.tickSim(seconds)
    this.cooling = Math.max(0, this.cooling - seconds)
  }

  protected saveState(): Record<string, unknown> {
    return { ...super.saveState(), cooling: this.cooling }
  }

  protected loadState(state: Record<string, unknown>): void {
    super.loadState(state)
    this.cooling = Number(state.cooling) || 0
  }
}

export class Abilities extends Component {
  static readonly type: string = 'abilities'
  static readonly DESCRIPTION: string = 'The abilities and spells an entity knows: its spell book.'
  static readonly PARAMS = {}

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'abilities belong on an entity'
  }

  get known(): Ability[] {
    return this.comps.filter((c): c is Ability => c instanceof Ability)
  }

  find(id: string): Ability | null {
    return this.known.find((a) => a.id === id) ?? null
  }

  tooltipRows(): TooltipRow[] {
    return this.known.map((a) => ({ label: String(a.params.label || a.id), value: a.cooling > 0 ? `${Math.ceil(a.cooling)} s` : 'ready' }))
  }
}

export function usableAbilities(entity: GameEntity): Ability[] {
  const out: Ability[] = []
  const walk = (c: Component) => {
    if (c instanceof Ability) {
      if (c.available()) out.push(c)
      return
    }
    for (const child of c.comps) walk(child)
  }
  for (const c of entity.comps) walk(c)
  return out
}

registerComponent(Ability)
registerComponent(Abilities)
