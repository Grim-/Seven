import { registerComponent } from '../../core'
import type { ActionEvent } from '../Action'
import { registerLegacyTriggerAction } from '../../triggerActions'
import { WorldPiece } from './WorldPiece'

export class OpenShop extends WorldPiece {
  static readonly type: string = 'world.openShop'
  static readonly DESCRIPTION: string = 'Opens a shop to buy from and sell to.'
  static readonly PARAMS = {
    ...WorldPiece.PARAMS_BASE,
    title: { kind: 'text' as const, default: 'Shop', description: 'What the shop is called.' },
    table: { kind: 'entry' as const, entryKind: 'loot_table', default: '', description: 'A loot table its stock is rolled from.' },
    buyRate: { kind: 'number' as const, default: 1, min: 0, description: 'Times the item\'s value paid to buy one.' },
    sellRate: { kind: 'number' as const, default: 0.5, min: 0, description: 'Times the item\'s value paid for one sold here. 0 buys nothing.' }
  }
  static readonly SENTENCE: string = 'Open the shop {title}[ stocked from {table}] for the {who}'
  static readonly ICON: string = 'Store'

  handle(event: ActionEvent): void {
    const p = this.params
    this.send(event, 'open_shop', { title: p.title, table: p.table, buyRate: p.buyRate, sellRate: p.sellRate })
    this.report(event, {}, `Opens the shop ${String(p.title)}.`)
    this.next(event)
  }
}

registerComponent(OpenShop)
registerLegacyTriggerAction('open_shop', (p) => [{ type: OpenShop.type, title: String(p.shopTitle ?? 'Shop'), table: String(p.lootTableId ?? '') }])
