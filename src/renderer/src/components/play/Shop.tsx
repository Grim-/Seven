import { Coins } from 'lucide-react'
import { Inventory, Item } from '@shared/game/components'
import { GameEntity, createComponent, type Catalog, type ComponentDef } from '@shared/game/core'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import { buy, buyPrice, sell, sellPrice } from '@shared/game/rules'
import type { PlaceVisitor } from '@shared/maps'
import { Button, EmptyState } from '../ui'
import { Markdown } from '../chat/Markdown'
import { hideTip, showTip } from '../ui/TooltipHost'
import { GamePanel } from '../../game/ui'
import { itemName, itemTip } from './screens/itemTip'
import { useGameAct } from './screens/useGameAct'

export interface ShopProps {
  visitor: PlaceVisitor | null
  catalog: Catalog | null
  stock: string[]
  buyRate: number
  sellRate: number
  text: string
}

function asItem(def: ComponentDef): Item | null {
  const made = createComponent({ ...def, type: 'item' })
  return made instanceof Item ? made : null
}

function Row({ item, price, label, disabled, title, onClick }: { item: Item; price: number; label: string; disabled: boolean; title?: string; onClick: () => void }) {
  const tip = itemTip(item)
  return (
    <div className="flex items-center gap-2 text-[13px]" onMouseEnter={(e) => showTip(e.currentTarget, tip.title, tip.body, 'top')} onMouseLeave={() => hideTip('component')}>
      <span className="min-w-0 flex-1 truncate text-white/90">
        {itemName(item)}
        {item.count > 1 && <span className="ml-1.5 font-mono text-[11.5px] text-dim">×{item.count}</span>}
      </span>
      <span className="w-16 text-right font-mono text-[12px] font-bold text-accent">{price} g</span>
      <Button size="sm" variant="secondary" disabled={disabled} title={title} onClick={onClick} className="w-16 justify-center">
        {label}
      </Button>
    </div>
  )
}

function Counter({ visitor, catalog, stock: ids, buyRate, sellRate }: { visitor: PlaceVisitor; catalog: Catalog; stock: string[]; buyRate: number; sellRate: number }) {
  const { shown, act } = useGameAct(visitor.sheet, visitor.game!, catalog)
  const entity = GameEntity.fromRecord(shown, catalog)
  const bag = entity.comp(Inventory)
  const stock = ids.flatMap((id) => {
    const def = catalog.template(ITEM_TEMPLATES, id)
    const item = def ? asItem(def) : null
    return def && item ? [{ id, def, item }] : []
  })
  if (!bag) return <EmptyState title="No inventory">{visitor.name} has nowhere to carry things.</EmptyState>
  return (
    <div className="grid grid-cols-2 items-start gap-4">
      <GamePanel title="For sale" aside={`${stock.length} item${stock.length === 1 ? '' : 's'}`}>
        {stock.length ? (
          stock.map(({ id, def, item }) => {
            const price = buyPrice(def, buyRate)
            return <Row key={id} item={item} price={price} label="Buy" disabled={bag.gold < price} title={bag.gold < price ? `It costs ${price} gold` : undefined} onClick={() => act((e) => buy(e, def, buyRate))} />
          })
        ) : (
          <span className="text-[12.5px] text-faint">Nothing for sale.</span>
        )}
      </GamePanel>
      <GamePanel title="Your bag" action={<span className="flex items-center gap-1.5 font-mono text-[12.5px] font-bold text-accent"><Coins className="h-3.5 w-3.5" />{bag.gold} gold</span>}>
        {bag.items.length ? (
          bag.items.map((item) => {
            const uid = item.uid
            return (
              <Row
                key={uid}
                item={item}
                price={sellPrice(item, sellRate)}
                label="Sell"
                disabled={sellRate <= 0}
                onClick={() =>
                  act((e) => {
                    const found = e.comp(Inventory)?.items.find((i) => i.uid === uid)
                    return found ? sell(e, found, sellRate) : 'it is gone'
                  })
                }
              />
            )
          })
        ) : (
          <span className="text-[12.5px] text-faint">The bag is empty.</span>
        )}
      </GamePanel>
    </div>
  )
}

export function Shop({ visitor, catalog, stock, buyRate, sellRate, text }: ShopProps) {
  return (
    <div className="flex flex-col gap-3">
      {text && <Markdown text={text} />}
      {visitor?.game && catalog ? <Counter visitor={visitor} catalog={catalog} stock={stock} buyRate={buyRate} sellRate={sellRate} /> : <EmptyState title="Not in the game">Only a character in the game can shop.</EmptyState>}
    </div>
  )
}
