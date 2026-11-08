import type { ComponentDef, GameEntity } from '../core'
import { Inventory, type Item } from '../components/Inventory'

export function buyPrice(def: ComponentDef, rate: number): number {
  return Math.ceil(Math.max(0, Number(def.value) || 0) * rate)
}

export function sellPrice(item: Item, rate: number): number {
  return Math.floor(Math.max(0, Number(item.params.value) || 0) * rate)
}

export function buy(entity: GameEntity, def: ComponentDef, rate: number): true | string {
  const bag = entity.comp(Inventory)
  if (!bag) return 'no inventory'
  const price = buyPrice(def, rate)
  if (bag.gold < price) return `it costs ${price} gold`
  if (bag.give(def, 1) < 1) return 'no room in the bag'
  bag.changeGold(-price)
  return true
}

export function sell(entity: GameEntity, item: Item, rate: number): true | string {
  const bag = entity.comp(Inventory)
  if (!bag || item.parent !== bag) return 'it is not in the bag'
  if (rate <= 0) return 'they buy nothing here'
  const price = sellPrice(item, rate)
  if (bag.take(item, 1) < 1) return 'nothing sold'
  bag.changeGold(price)
  return true
}
