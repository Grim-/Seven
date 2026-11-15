import { entryLink } from '@shared/game/core'
import { Inventory } from '@shared/game/components'
import { ITEM_TEMPLATES } from '@shared/game/templateKinds'
import { lootTablesStore } from '../../lootTables/store'
import { registerWorldAct } from '../acts'

registerWorldAct('roll_loot', (data, { target, catalog }) => {
  const table = String(data.table ?? '')
  const bag = target.comp(Inventory)
  if (!table || !bag) return null
  const drop = lootTablesStore.roll(table)
  const got: string[] = []
  for (const item of drop.items) {
    const def = catalog.template(ITEM_TEMPLATES, item.itemId)
    const given = def ? bag.give(def, item.quantity) : 0
    if (given) got.push(`${given}× ${entryLink(ITEM_TEMPLATES, item.itemId)}`)
  }
  if (drop.gold > 0) {
    bag.changeGold(drop.gold)
    got.push(`${drop.gold} gold`)
  }
  return got.length ? `${target.named} received ${got.join(' and ')}.` : null
})
