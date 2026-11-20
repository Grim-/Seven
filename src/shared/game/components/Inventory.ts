import { Component, createComponent, registerComponent, type Catalog, type ComponentDef, type GameEntity, type SlotDef, type TooltipRow } from '../core'
import { defId } from '../defs/defs'
import { Action, type UseContext } from './Action'
import { Stats } from './Stats'

export function slotLabel(slot: string): string {
  return slot.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase()
}

export function sameSlot(a: string, b: string): boolean {
  return defId(a) === defId(b)
}

export function slotDef(catalog: Catalog | null | undefined, kind: string): SlotDef | null {
  return catalog?.slot(defId(kind)) ?? null
}

export function slotName(catalog: Catalog | null | undefined, kind: string): string {
  return slotDef(catalog, kind)?.label ?? slotLabel(kind)
}

export interface EquipSlot {
  id: string
  kind: string
  label: string
  icon: string
}

export class Item extends Action {
  static readonly type: string = 'item'
  static readonly LABEL: string = 'Item'
  static readonly ICON: string = 'Package'
  static readonly DESCRIPTION: string = 'An item. Its pieces decide what it does: used, worn or wielded.'
  static readonly PARAMS = {
    id: { kind: 'text' as const, default: '', description: 'Which item this is; same ids stack.' },
    label: { kind: 'text' as const, default: '', description: 'Its name.' },
    value: { kind: 'number' as const, default: 0, min: 0, description: 'Price in gold.', section: 'Trade and carrying' },
    weight: { kind: 'number' as const, default: 0, min: 0, description: 'Weight.', section: 'Trade and carrying' },
    maxStack: { kind: 'number' as const, default: 1, min: 1, description: 'How many fit in one stack.', section: 'Trade and carrying' },
    usedUp: { kind: 'flag' as const, default: false, description: 'One is used up each time it is used.', section: 'Use' },
    action: { kind: 'choice' as const, default: 'action', choices: ['action', 'bonus', 'free'], description: 'What using this item takes in a battle turn.', section: 'Use' },
    grantsWhen: { kind: 'choice' as const, default: 'worn', choices: ['worn', 'carried'], description: 'When the abilities inside it can be used: while it is worn or wielded, or while it is carried.', section: 'Use' }
  }
  count = 1

  canApply(host: Component | GameEntity): true | string {
    return host instanceof Inventory || host instanceof Equipment ? true : 'an item belongs in an inventory or equipment'
  }

  grantsAbilities(): boolean {
    if (this.parent instanceof Equipment) return true
    return this.params.grantsWhen === 'carried' && this.parent instanceof Inventory
  }

  usable(): boolean {
    return this.pieces().some((p) => String(p.params.on) === 'OnUse')
  }

  use(ctx: UseContext): true | string {
    if (!this.usable()) return 'it can\'t be used'
    for (const p of this.pieces()) {
      const check = p.canUse(ctx)
      if (check !== true) return check
    }
    this.fire('OnUse', ctx)
    ctx.user.emit('OnItemUsed', { item: this.id })
    if (this.params.usedUp) {
      if (this.parent instanceof Inventory) {
        this.parent.take(this, 1)
      } else if (this.parent instanceof Equipment) {
        this.count -= 1
        if (this.count <= 0) {
          const slot = this.parent.slotOf(this)
          if (slot) delete this.parent.worn[slot]
          this.parent.remove(this)
        }
      }
    }
    return true
  }

  tooltipRows(): TooltipRow[] {
    const rows: TooltipRow[] = []
    if (Number(this.params.value)) rows.push({ label: 'Value', value: `${Number(this.params.value)} gold` })
    if (Number(this.params.weight)) rows.push({ label: 'Weight', value: String(Number(this.params.weight)) })
    if (this.params.usedUp) rows.push({ label: 'Used up', value: 'on use' })
    return rows
  }

  protected saveState(): Record<string, unknown> {
    return { ...super.saveState(), count: this.count }
  }

  protected loadState(state: Record<string, unknown>): void {
    super.loadState(state)
    this.count = Number(state.count) || 1
  }
}

export class Inventory extends Component {
  static readonly type: string = 'inventory'
  static readonly LABEL: string = 'Inventory'
  static readonly ICON: string = 'Backpack'
  static readonly DESCRIPTION: string = 'Items and gold carried.'
  static readonly PARAMS = { slots: { kind: 'number' as const, default: 20, min: 0, description: 'Stacks it can hold.' } }
  gold = 0

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'an inventory belongs on an entity'
  }

  get items(): Item[] {
    return this.comps.filter((c): c is Item => c instanceof Item)
  }

  give(def: ComponentDef, count = 1): number {
    let left = count
    for (const stack of this.items) {
      if (left <= 0) break
      if (stack.id !== def.id) continue
      const room = Number(stack.params.maxStack) - stack.count
      const put = Math.min(room, left)
      stack.count += put
      left -= put
    }
    while (left > 0 && this.items.length < Number(this.params.slots)) {
      const made = createComponent({ ...def, type: 'item' })
      if (!(made instanceof Item)) break
      made.count = Math.min(Number(made.params.maxStack), left)
      if (!this.add(made)) break
      left -= made.count
    }
    if (count - left > 0) this.entity?.emit('OnItemGained', { item: def.id, count: count - left })
    return count - left
  }

  take(item: Item, count: number): number {
    const taken = Math.min(count, item.count)
    item.count -= taken
    if (item.count <= 0) this.remove(item)
    if (taken > 0) this.entity?.emit('OnItemLost', { item: item.id, count: taken })
    return taken
  }

  changeGold(amount: number): boolean {
    if (this.gold + amount < 0) return false
    this.gold += amount
    this.entity?.emit('OnGoldChanged', { gold: this.gold, change: amount })
    return true
  }

  protected saveState(): Record<string, unknown> {
    return { gold: this.gold }
  }

  protected loadState(state: Record<string, unknown>): void {
    this.gold = Number(state.gold) || 0
  }

  tooltipRows(): TooltipRow[] {
    return [{ label: 'Gold', value: String(this.gold) }, ...this.items.map((i) => ({ label: String(i.params.label || i.id), value: `×${i.count}` }))]
  }
}

export class Equipment extends Component {
  static readonly type: string = 'equipment'
  static readonly LABEL: string = 'Equipment'
  static readonly ICON: string = 'Shield'
  static readonly DESCRIPTION: string = 'What is worn and wielded, by slot. Worn items change stats.'
  static readonly PARAMS = {
    slots: { kind: 'list' as const, default: ['head', 'chest', 'legs', 'mainHand', 'offHand', 'bag', 'belt'], of: { kind: 'template' as const, templateKind: 'slot', default: '', description: 'A slot.' }, description: 'Slots it has, in order. A slot whose definition takes its number from a stat gives that many.' }
  }
  worn: Record<string, string> = {}

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'equipment belongs on an entity'
  }

  pruneOrphanedSlots(): void {
    const valid = new Set(this.slots())
    const inventory = this.entity?.comp(Inventory)
    for (const [slot, uid] of Object.entries({ ...this.worn })) {
      if (!valid.has(slot)) {
        const item = this.comps.find((c) => c.uid === uid)
        if (item instanceof Item) {
          this.remove(item)
          delete this.worn[slot]
          if (inventory) {
            inventory.add(item)
            this.entity?.emit('OnUnequipped', { item: item.id, slot })
          }
        } else {
          delete this.worn[slot]
        }
      }
    }
  }

  slotList(): EquipSlot[] {
    const catalog = this.entity?.catalog
    const base = (this.params.slots as string[]).flatMap((kind) => {
      const def = slotDef(catalog, kind)
      const label = def?.label ?? slotLabel(kind)
      const icon = def?.icon ?? ''
      if (!def?.countStat) return [{ id: kind, kind, label, icon }]
      const count = Math.max(0, Math.floor(this.entity?.comp(Stats)?.value(def.countStat) ?? 0))
      return Array.from({ length: count }, (_, i) => ({ id: `${kind}${i + 1}`, kind, label: `${label} ${i + 1}`, icon }))
    })

    // If an item is still held in an overflow slot (e.g. inventory was full during stat reduction), keep it visible so it isn't lost
    const knownIds = new Set(base.map((s) => s.id))
    for (const [slot, uid] of Object.entries(this.worn)) {
      if (!knownIds.has(slot) && this.comps.some((c) => c.uid === uid)) {
        base.push({ id: slot, kind: 'belt', label: `${slotLabel(slot)} (Overflow)`, icon: 'package' })
      }
    }

    return base
  }

  slots(): string[] {
    return this.slotList().map((s) => s.id)
  }

  label(slot: string): string {
    return this.slotList().find((s) => s.id === slot)?.label ?? slotLabel(slot)
  }

  fitting(item: Item): string[] {
    return this.slotList()
      .filter((slot) => {
        if (slot.kind === 'belt' && item.usable()) return true
        return item.comps.some((c) => c instanceof Wearable && c.fits(slot.kind))
      })
      .map((slot) => slot.id)
  }

  inSlot(slot: string): Item | null {
    const uid = this.worn[slot]
    return (this.comps.find((c) => c.uid === uid) as Item | undefined) ?? null
  }

  slotOf(item: Item): string | null {
    return Object.entries(this.worn).find(([, uid]) => uid === item.uid)?.[0] ?? null
  }

  equip(item: Item, slot: string): true | string {
    const inventory = this.entity?.comp(Inventory)
    if (!inventory || item.parent !== inventory) return 'it is not in the inventory'
    if (!this.slots().includes(slot)) return `there is no ${slot} slot`
    if (!this.fitting(item).includes(slot)) return `it doesn't go in ${slot}`
    const current = this.inSlot(slot)
    if (current) {
      const back = this.unequip(slot)
      if (back !== true) return back
    }
    inventory.remove(item)
    this.add(item)
    this.worn[slot] = item.uid
    this.entity?.emit('OnEquipped', { item: item.id, slot })
    return true
  }

  unequip(slot: string): true | string {
    const item = this.inSlot(slot)
    const inventory = this.entity?.comp(Inventory)
    if (!item) return 'nothing is there'
    if (!inventory || inventory.items.length >= Number(inventory.params.slots)) return 'no room in the inventory'
    this.remove(item)
    delete this.worn[slot]
    inventory.add(item)
    this.entity?.emit('OnUnequipped', { item: item.id, slot })
    return true
  }

  protected saveState(): Record<string, unknown> {
    return { worn: { ...this.worn } }
  }

  protected loadState(state: Record<string, unknown>): void {
    this.worn = state.worn && typeof state.worn === 'object' ? { ...(state.worn as Record<string, string>) } : {}
  }
}

export abstract class Wearable extends Component {
  canApply(host: Component | GameEntity): true | string {
    return host instanceof Item ? true : 'this piece belongs inside an item'
  }

  get item(): Item | null {
    return this.parent instanceof Item ? this.parent : null
  }

  get worn(): boolean {
    return this.item?.parent instanceof Equipment
  }

  abstract fits(slot: string): boolean

  reach(): number | null {
    return null
  }
}

registerComponent(Item)
registerComponent(Inventory)
registerComponent(Equipment)
