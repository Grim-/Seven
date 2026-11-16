import { useState, type MouseEvent } from 'react'
import { Coins, Minus, Play, Plus, Shirt, Trash2 } from 'lucide-react'
import { Equipment, Inventory, Item, Stats } from '@shared/game/components'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import { Button, Segmented, openMenu } from '../../../ui'
import { BrowsePick, type BrowseOption } from '../../../ui/BrowsePick'
import { toast } from '../../../../store/toasts'
import { GameBar, GamePanel, ItemSlot, type ItemDrag } from '../../../../game/ui'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { itemName, itemTip } from '../../../play/screens/itemTip'
import { registerComponentPanel, type PanelProps } from './registry'
import { useGameDefs } from '../../useGameDefs'

function InventoryPanel({ comp, entity, catalog, changed }: PanelProps<Inventory>) {
  const defs = useGameDefs(ITEM_TEMPLATES).list ?? []
  const equipment = entity.comp(Equipment)
  const stats = entity.comp(Stats)
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [category, setCategory] = useState<'all' | 'gear' | 'usable'>('all')

  const weight = comp.items.reduce((sum, i) => sum + Number(i.params.weight) * i.count, 0)
  const maxCarry = stats?.value('carry weight') ?? stats?.value('carryweight') ?? 90
  const maxSlots = Number(comp.params.slots) || 20
  const filtered = comp.items.filter((i) => {
    if (category === 'usable') return i.usable()
    if (category === 'gear') return (equipment?.fitting(i).length ?? 0) > 0
    return true
  })

  const picked = comp.items.find((i) => i.uid === selectedUid) ?? null
  const pickedFits = picked && equipment ? equipment.fitting(picked) : []

  const giveOptions: BrowseOption[] = defs.map((d) => ({
    value: d.id,
    label: d.name,
    group: 'Items',
    note: d.notes || undefined
  }))

  const handleDropToBag = (drag: ItemDrag) => {
    if (!drag.from.startsWith('slot:') || !equipment) return
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
          <div className="flex items-center gap-1 border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
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
      bodyClassName="gap-2.5 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={category}
          options={[
            { value: 'all', label: `All (${comp.items.length})` },
            { value: 'gear', label: 'Gear' },
            { value: 'usable', label: 'Consumables' }
          ]}
          onChange={setCategory}
        />
        <GameBar
          value={weight}
          max={maxCarry}
          colour={weight > maxCarry ? 'alert' : 'teal'}
          size="sm"
          className="min-w-[6rem] flex-1"
        />
      </div>

      {filtered.length === 0 ? (
        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/x-seven-item')) e.preventDefault()
          }}
          onDrop={(e) => {
            const raw = e.dataTransfer.getData('application/x-seven-item')
            if (!raw) return
            e.preventDefault()
            handleDropToBag(JSON.parse(raw) as ItemDrag)
          }}
          className="border border-dashed border-line/40 px-3 py-4 text-center font-mono text-[11.5px] text-faint"
        >
          {comp.items.length === 0 ? 'Bag is empty — use + Give item above or drag equipped gear here.' : 'No items match this filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {filtered.map((item) => (
            <ItemSlot
              key={item.uid}
              from="bag"
              item={{ uid: item.uid, label: itemName(item), count: item.count }}
              selected={picked?.uid === item.uid}
              tip={itemTip(item)}
              onDropItem={handleDropToBag}
              onClick={() => setSelectedUid((cur) => (cur === item.uid ? null : item.uid))}
              onDoubleClick={() => {
                if (item.usable()) useItem(item)
                else if (equipment && equipment.fitting(item).length > 0) equipItem(item, equipment.fitting(item)[0])
              }}
              onMenu={menu(item)}
            />
          ))}
        </div>
      )}

      {picked && (
        <div className="flex flex-wrap items-center gap-1.5 border border-line/45 bg-black/55 px-2.5 py-2">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-white">
            {itemName(picked)} <span className="font-mono text-[11px] font-normal text-dim">×{picked.count}</span>
          </span>
          {picked.usable() && (
            <Button size="sm" variant="primary" icon={<Play />} onClick={() => useItem(picked)}>
              Use
            </Button>
          )}
          {pickedFits.map((slot) => (
            <Button key={slot} size="sm" variant="secondary" icon={<Shirt />} onClick={() => equipItem(picked, slot)}>
              Equip ({equipment?.label(slot) ?? slot})
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus />}
            title="Add 1"
            onClick={() => {
              const def = catalog.template(ITEM_TEMPLATES, picked.id)
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
              comp.take(picked, 1)
              changed()
            }}
          />
        </div>
      )}
    </GamePanel>
  )
}

registerComponentPanel(Inventory.type, { Panel: InventoryPanel })
