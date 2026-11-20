import { Component, registerComponent, type GameEntity, type TooltipRow } from '../core'
import { Resource } from './Resource'
import { Action, ActionPiece, chainScore, type EffectLane, type UseContext } from './Action'
import { Equipment, Inventory, Item, Wearable } from './Inventory'
import { ItemResource } from './item/ItemResource'
import { Weapon } from './item/Weapon'

export { ActionPiece as AbilityPiece, type ActionEvent as AbilityEvent } from './Action'

interface ClassActiveLookup {
  isClassActive(id: string): boolean
}

function isClassActiveOnEntity(entity: GameEntity | null, classId: string): boolean {
  if (!entity || !classId) return false
  const classes = entity.comps.find((c) => c.type === 'classes') as (Component & Partial<ClassActiveLookup>) | undefined
  return Boolean(classes && typeof classes.isClassActive === 'function' && classes.isClassActive(classId))
}

function parentActiveHost(comp: Component): { isActive: () => boolean } | null {
  const p = comp.parent
  if (p instanceof Component && 'isActive' in p && typeof (p as { isActive?: unknown }).isActive === 'function') {
    return p as Component & { isActive: () => boolean }
  }
  return null
}

export function hasWieldedWeapon(entity: GameEntity | null | undefined): boolean {
  const equip = entity?.comp(Equipment)
  if (!equip) return false
  return equip.comps.some((c) => c instanceof Item && c.comps.some((p) => p instanceof Weapon))
}

export class Ability extends Action {
  static readonly type: string = 'ability'
  static readonly LABEL: string = 'Ability'
  static readonly ICON: string = 'Wand2'
  static readonly DESCRIPTION: string = 'An ability or spell. Using it pays its cost and sends OnUse to its pieces, which chain by sending further events.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: '', description: 'Which ability this is.' },
    label: { kind: 'text' as const, default: '', description: 'Its name.' },
    cost: { kind: 'values' as const, templateKind: 'stat', default: {}, description: 'Resource stat id to amount spent on use.', section: 'Costs' },
    range: { kind: 'number' as const, default: 5, min: 0, description: 'Reach in feet. 0 is self only.', section: 'Timing and reach' },
    weaponRange: { kind: 'flag' as const, default: false, description: 'Use the reach of the weapon it is inside instead of Range.', section: 'Timing and reach' },
    unarmedOnly: { kind: 'flag' as const, default: false, description: 'Only available when no weapon is equipped (e.g. fists). Natural weapons like claws leave this off.', section: 'Timing and reach' },
    itemCost: { kind: 'values' as const, default: {}, description: 'Item resource id (charges, a magazine) to amount spent, from the item it is inside.', section: 'Costs' },
    uses: { kind: 'values' as const, templateKind: 'game_item', default: {}, description: 'Items used up from the inventory on each use, e.g. an arrow.', section: 'Costs' },
    action: { kind: 'choice' as const, default: 'action', choices: ['action', 'bonus', 'free'], description: 'What it takes in a battle turn.', section: 'Timing and reach' },
    sourceClass: { kind: 'template' as const, templateKind: 'game_class', default: '', description: 'Class id that granted this ability, if any.' },
    permanent: { kind: 'flag' as const, default: false, description: 'Keep this ability even if its granting class is lost.' }
  }
  static readonly LANES: EffectLane[] = [{ event: 'OnUse', label: 'When used' }]

  canApply(host: Component | GameEntity): true | string {
    if (host instanceof Abilities || host instanceof Item) return true
    if (host instanceof Component && 'isActive' in host) return true
    return 'an ability belongs in abilities, inside an item, or inside a trait'
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
    if (item) return item.grantsAbilities()
    const host = parentActiveHost(this)
    if (host) {
      if (!host.isActive()) return false
      if (this.params.unarmedOnly && hasWieldedWeapon(this.entity)) return false
      return true
    }
    if (!(this.parent instanceof Abilities)) return false
    const sourceClass = String(this.params.sourceClass || '')
    if (sourceClass && !this.params.permanent && !isClassActiveOnEntity(this.entity, sourceClass)) return false
    if (this.params.unarmedOnly && hasWieldedWeapon(this.entity)) return false
    return true
  }

  reach(): number {
    const weapon = this.params.weaponRange ? this.item?.comps.find((c): c is Wearable => c instanceof Wearable && c.reach() !== null) : undefined
    return weapon ? (weapon.reach() ?? 0) : Number(this.params.range)
  }

  private carried(user: GameEntity, id: string): number {
    return user.comp(Inventory)?.items.reduce((sum, i) => sum + (i.id === id ? i.count : 0), 0) ?? 0
  }

  canUse(ctx: UseContext): true | string {
    if (!this.available()) {
      if (this.item) return `${String(this.item.params.label || this.item.id)} has to be worn`
      return this.params.unarmedOnly && hasWieldedWeapon(this.entity) ? 'unavailable while wielding a weapon' : 'it is not known'
    }
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
    ctx.user.emit('OnCast', { ability: this.id, target: ctx.target?.uid ?? null })
    this.fire('OnUse', ctx)
    return true
  }

  score(ctx: UseContext): number {
    if (this.canUse(ctx) !== true) return 0
    return chainScore(this, 'OnUse', ctx)
  }

}

export class Abilities extends Component {
  static readonly type: string = 'abilities'
  static readonly LABEL: string = 'Abilities'
  static readonly ICON: string = 'BookOpen'
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

  stripClassAbilities(classId: string): number {
    let removed = 0
    for (const ability of [...this.known]) {
      if (String(ability.params.sourceClass || '') === classId && !ability.params.permanent) {
        if (this.remove(ability)) removed += 1
      }
    }
    return removed
  }

  tooltipRows(): TooltipRow[] {
    return this.known.map((a) => ({ label: String(a.params.label || a.id), value: Object.entries(a.cost).map(([s, n]) => `${n} ${this.entity?.catalog.stat(s)?.label ?? s}`).join(', ') || 'free' }))
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
