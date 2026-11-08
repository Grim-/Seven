import type { Item } from '@shared/game/components'
import { Eyebrow } from '../../ui'
import { RowList } from '../../../game/ui'

export const itemName = (item: Item) => String(item.params.label || item.id)

export function itemRows(item: Item) {
  return [...item.comps.flatMap((c) => c.tooltipRows()), ...item.tooltipRows()]
}

export function ItemBody({ item, worn }: { item: Item; worn?: Item[] }) {
  return (
    <span className="flex min-w-56 flex-col gap-2">
      <RowList rows={itemRows(item)} />
      {item.count > 1 && <span className="font-mono text-[11px] text-dim">{item.count} in this stack</span>}
      {worn?.map((w) => (
        <span key={w.uid} className="flex flex-col gap-1 border-t border-line/40 pt-2">
          <Eyebrow className="text-faint">Worn now: {itemName(w)}</Eyebrow>
          <RowList rows={itemRows(w)} className="opacity-80" />
        </span>
      ))}
    </span>
  )
}

export function itemTip(item: Item, worn?: Item[]) {
  return { title: itemName(item), body: <ItemBody item={item} worn={worn} /> }
}
