import { useState, type DragEvent, type MouseEvent } from 'react'
import { Coins, Minus, Play, Plus, Shirt, Trash2 } from 'lucide-react'
import { Equipment, Inventory, Item } from '@shared/game/components'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import { Button, Segmented, openMenu } from '../../../ui'
import { BrowsePick, type BrowseOption } from '../../../ui/BrowsePick'
import { hideTip, showTip } from '../../../ui/TooltipHost'
import { ACTION_DRAG_MIME, setCompactDragGhost, type ActionDragPayload } from '../../../play/hud/actionSlots'
import { toast } from '../../../../store/toasts'
import { GameBar, GamePanel, getGameVisual, statNumber, type ItemDrag } from '../../../../game/ui'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { itemName, itemRows, itemTip } from '../../../play/screens/itemTip'
import { cn } from '../../../../lib/cn'
import { registerComponentPanel, type PanelProps } from './registry'
import { useGameDefs } from '../../useGameDefs'

const ITEM_MIME = 'application/x-seven-item'

function InventoryPanel({ comp, entity, catalog, changed }: PanelProps<Inventory>) {
  const defs = useGameDefs(ITEM_TEMPLATES).list ?? []
  const equipment = entity.comp(Equipment)
  const [category, setCategory] = useState<'all' | 'gear' | 'usable'>('all')
  const [dragOver, setDragOver] = useState(false)

  const weight = comp.items.reduce((sum, i) => sum + Number(i.params.weight || 0) * i.count, 0)
  const maxCarry = statNumber(entity, catalog, 'carry weight', statNumber(entity, catalog, 'carryweight', 90))
  const maxSlots = Number(comp.params.slots) || 20
  const filtered = comp.items.filter((i) => {
    if (category === 'usable') return i.usable()
    if (category === 'gear') return (equipment?.fitting(i).length ?? 0) > 0
    return true
  })

  const giveOptions: BrowseOption[] = defs.map((d) => ({
    value: d.id,
    label: d.name,
    group: 'Items',
    note: d.notes || undefined
  }))

  const handleDropToBag = (e: DragEvent) => {
    setDragOver(false)
    const raw = e.dataTransfer.getData(ITEM_MIME)
    if (!raw || !equipment) return
    e.preventDefault()
    const drag = JSON.parse(raw) as ItemDrag
    if (!drag.from.startsWith('slot:')) return
    const res = equipment.unequip(drag.from.slice(5))
    if (res !== true) toast.error('Could not unequip', res)
    changed()
  }

  const useItem = (item: Item) => {
    const done = item.use({ user: entity, target: entity, distance: 0 } as never)
    if (done !== true) toast.error('Could not use it', done)
    changed()
  }

  const equipItem = (item: Item, slot: string) => {
    if (!equipment) return
    const res = equipment.equip(item, slot)
    if (res !== true) toast.error('Could not equip', res)
    changed()
  }

  const menu = (item: Item) => (e: MouseEvent) => {
    const fits = equipment?.fitting(item) ?? []
    openMenu(e, itemName(item), [
      ...(item.usable() ? [{ label: 'Use', icon: <Play />, onSelect: () => useItem(item) }] : []),
      ...fits.map((s) => ({
        label: `Equip (${equipment?.label(s) ?? s})`,
        icon: <Shirt />,
        onSelect: () => equipItem(item, s)
      })),
      {
        label: 'Drop one',
        icon: <Minus />,
        onSelect: () => {
          comp.take(item, 1)
          changed()
        }
      },
      ...(item.count > 1
        ? [
            {
              label: 'Drop all',
              icon: <Trash2 />,
              danger: true,
              onSelect: () => {
                comp.take(item, item.count)
                changed()
              }
            }
          ]
        : [])
    ])
  }

  return (
    <GamePanel
      title="Inventory"
      aside={`${comp.items.length}/${maxSlots} stacks · ${Math.round(weight * 10) / 10}/${Math.round(maxCarry)} lb`}
      action={
        <div className="flex items-center gap-2 [--tone:var(--color-accent)]">
          <div className="flex items-center gap-1 border border-tint-amber/40 bg-tint-amber/10 px-1.5 py-0.5">
            <Coins className="h-3.5 w-3.5 text-tint-amber-ink" />
            <EffectTokenButton
              name="gold"
              spec={{ kind: 'number', default: 0, min: 0, description: 'Gold coins carried.' }}
              value={comp.gold}
              onChange={(v) => {
                comp.changeGold((typeof v === 'number' ? v : comp.gold) - comp.gold)
                changed()
              }}
            />
          </div>
          {giveOptions.length > 0 && (
            <BrowsePick
              value={null}
              options={giveOptions}
              placeholder="+ Give item"
              onChange={(id) => {
                const def = id ? catalog.template(ITEM_TEMPLATES, id) : null
                if (!def) return
                if (comp.give(def, 1) < 1) toast.error('No room', 'The inventory is full.')
                changed()
              }}
              className="min-w-[9rem]"
            />
          )}
        </div>
      }
      bodyClassName="gap-2 p-2.5"
    >
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 whitespace-nowrap">
          <Segmented
            value={category}
            options={[
              { value: 'all', label: `All (${comp.items.length})` },
              { value: 'gear', label: 'Gear' },
              { value: 'usable', label: 'Usable' }
            ]}
            onChange={setCategory}
          />
        </div>
        <GameBar
          value={weight}
          max={maxCarry}
          colour={weight > maxCarry ? 'alert' : 'teal'}
          size="xs"
          className="min-w-[4rem] flex-1"
        />
      </div>

      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(ITEM_MIME)) return
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDropToBag}
        className={cn(
          'flex flex-col divide-y divide-line/25 border-t border-line/35 transition-colors',
          dragOver && 'bg-tint-cyan/10'
        )}
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-center font-ui text-[11.5px] text-faint">
            {comp.items.length === 0 ? 'Bag is empty — use + Give item above or drag equipped gear here.' : 'No items match this filter.'}
          </div>
        ) : (
          filtered.map((item) => {
            const label = itemName(item)
            const visual = getGameVisual(label, '', 'item')
            const ItemIcon = visual.Icon
            const fits = equipment?.fitting(item) ?? []
            const itemWeight = Math.round(Number(item.params.weight || 0) * item.count * 10) / 10
            const summary = itemRows(item)
              .map((r) => r.value)
              .filter(Boolean)
              .slice(0, 2)
              .join(' · ')
            const tip = itemTip(item)

            return (
              <div
                key={item.uid}
                draggable
                onDragStart={(e) => {
                  hideTip('component')
                  e.dataTransfer.setData(ITEM_MIME, JSON.stringify({ uid: item.uid, from: 'bag' } satisfies ItemDrag))
                  e.dataTransfer.setData(
                    ACTION_DRAG_MIME,
                    JSON.stringify({ kind: 'item', uid: item.uid, id: item.uid, label } satisfies ActionDragPayload)
                  )
                  e.dataTransfer.effectAllowed = 'move'
                  setCompactDragGhost(e, label, '#38bdf8')
                }}
                onMouseEnter={(e) => showTip(e.currentTarget, tip.title, tip.body, 'top')}
                onMouseLeave={() => hideTip('component')}
                onDoubleClick={() => {
                  if (item.usable()) useItem(item)
                  else if (fits.length > 0) equipItem(item, fits[0])
                }}
                onContextMenu={menu(item)}
                className="group flex cursor-grab items-center gap-2 px-1.5 py-1 hover:bg-ink/[0.03] active:cursor-grabbing"
              >
                <ItemIcon className={cn('h-3.5 w-3.5 shrink-0', visual.color)} />
                <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">{label}</span>
                {item.count > 1 && (
                  <span className="shrink-0 font-data text-[11px] font-semibold tabular-nums text-accent">
                    ×{item.count}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-ui text-[11px] text-dim">
                  {summary}
                </span>
                {itemWeight > 0 && (
                  <span className="shrink-0 font-data text-[10.5px] tabular-nums text-faint">
                    {itemWeight} lb
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-0.5">
                  {item.usable() && (
                    <Button size="sm" variant="ghost" icon={<Play />} title="Use item" onClick={() => useItem(item)}>
                      Use
                    </Button>
                  )}
                  {fits.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Shirt />}
                      title={`Equip (${equipment?.label(fits[0]) ?? fits[0]})`}
                      onClick={() => equipItem(item, fits[0])}
                    >
                      Equip
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus />}
                    title="Add 1"
                    onClick={() => {
                      const def = catalog.template(ITEM_TEMPLATES, item.id)
                      if (def) comp.give(def, 1)
                      changed()
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Minus />}
                    title="Remove 1"
                    onClick={() => {
                      comp.take(item, 1)
                      changed()
                    }}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>
    </GamePanel>
  )
}

registerComponentPanel(Inventory.type, { Panel: InventoryPanel })
