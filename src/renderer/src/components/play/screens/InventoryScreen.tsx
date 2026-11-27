import { useState, type MouseEvent } from 'react'
import {
  Backpack,
  Hand,
  Minus,
  Play,
  Shirt,
  Trash2,
  Sparkles,
  Coins,
  Shield,
  Weight,
  Sparkle,
  Package,
  FlaskConical
} from 'lucide-react'
import { Equipment, Inventory, Item, Stats } from '@shared/game/components'
import type { GameEntity } from '@shared/game/core'
import { ActionBar, EmptyState, openMenu, type MenuItem } from '../../ui'
import { KindIcon } from '../../../lib/library'
import { GamePanel, ItemSlot, type ItemDrag } from '../../../game/ui'
import { ItemBody, itemName, itemTip } from './itemTip'
import { registerGameScreen, type GameAct, type ScreenProps } from './registry'
import { setActionSlot } from '../hud/actionSlots'
import { toast } from '../../../store/toasts'
import { cn } from '../../../lib/cn'

const BAG = 'bag'
const slotFrom = (slot: string) => `slot:${slot}`
const slotOfDrag = (from: string) => (from.startsWith('slot:') ? from.slice(5) : null)

function findItem(entity: GameEntity, uid: string): Item | null {
  const bag = entity.comp(Inventory)?.items ?? []
  const worn = entity.comp(Equipment)?.comps ?? []
  return [...bag, ...worn].find((c): c is Item => c instanceof Item && c.uid === uid) ?? null
}

function itemActions(item: Item, entity: GameEntity, act: GameAct, sheet: string): MenuItem[] {
  const equipment = entity.comp(Equipment)
  const worn = equipment?.slotOf(item) ?? null
  const fitting = equipment?.fitting(item) ?? []
  const uid = item.uid
  const withItem = (run: (found: Item, e: GameEntity) => true | string) =>
    act((e) => {
      const found = findItem(e, uid)
      return found ? run(found, e) : 'it is gone'
    })
  const items: MenuItem[] = []

  if (item.usable()) {
    items.push({
      label: 'Use',
      icon: <Play />,
      onSelect: () => withItem((found, e) => found.use({ user: e, target: e, at: null, distance: 0 }))
    })
  }
  if (worn) {
    items.push({
      label: 'Take off',
      icon: <Hand />,
      onSelect: () => act((e) => e.comp(Equipment)?.unequip(worn) ?? 'no equipment')
    })
  } else if (fitting.length === 1 && equipment) {
    items.push({
      label: `Equip (${equipment.label(fitting[0])})`,
      icon: <Shirt />,
      onSelect: () => withItem((found, e) => e.comp(Equipment)?.equip(found, fitting[0]) ?? 'no equipment')
    })
  } else if (fitting.length > 1 && equipment) {
    items.push({
      label: 'Equip in',
      icon: <Shirt />,
      children: fitting.map((slot) => ({
        label: equipment.label(slot),
        onSelect: () => withItem((found, e) => e.comp(Equipment)?.equip(found, slot) ?? 'no equipment')
      }))
    })
  }

  // Put on Action Bar submenu
  items.push({
    label: 'Put on Action Bar',
    icon: <Sparkles />,
    children: Array.from({ length: 9 }, (_, i) => ({
      label: `Slot ${i + 1}`,
      onSelect: () => {
        setActionSlot(sheet, i, {
          kind: 'item',
          uid: item.uid,
          id: item.id,
          label: itemName(item)
        })
        toast.info('Action Bar', `Assigned ${itemName(item)} to Slot ${i + 1}`)
      }
    }))
  })

  if (!worn) {
    items.push({
      label: 'Drop one',
      icon: <Minus />,
      onSelect: () => withItem((found, e) => (e.comp(Inventory)?.take(found, 1) ? true : 'nothing dropped'))
    })
    if (item.count > 1) {
      items.push({
        label: 'Drop all',
        icon: <Trash2 />,
        danger: true,
        onSelect: () => withItem((found, e) => (e.comp(Inventory)?.take(found, found.count) ? true : 'nothing dropped'))
      })
    }
  }
  return items
}

function quick(item: Item, entity: GameEntity, act: GameAct, sheet: string): void {
  const first = itemActions(item, entity, act, sheet).find((i) => i.onSelect)
  first?.onSelect?.()
}

function InventoryScreen({ entity, act, visitor }: ScreenProps) {
  const bag = entity.comp(Inventory)
  const equipment = entity.comp(Equipment)
  const stats = entity.comp(Stats)
  const [picked, setPicked] = useState<string | null>(null)
  const [category, setCategory] = useState<'all' | 'gear' | 'consumable'>('all')

  if (!bag) return <EmptyState title="No inventory">This character's template has no inventory.</EmptyState>

  const selected = picked ? findItem(entity, picked) : null
  const wornIn = (item: Item) =>
    equipment && !equipment.slotOf(item) ? equipment.fitting(item).flatMap((s) => equipment.inSlot(s) ?? []) : []
  const menu = (item: Item) => (e: MouseEvent) =>
    openMenu(e, itemName(item), itemActions(item, entity, act, visitor.sheet))

  const weight = bag.items.reduce((sum, i) => sum + Number(i.params.weight) * i.count, 0)
  const maxCarry = stats?.value('carry weight') || stats?.value('carryweight') || 90
  const size = Math.max(25, Number(bag.params.slots) || 20)
  const gold = bag.gold

  // Filter items
  const filteredItems = bag.items.filter((item) => {
    if (category === 'all') return true
    if (category === 'consumable') return item.usable()
    if (category === 'gear') return equipment?.fitting(item).length ?? 0 > 0
    return true
  })

  const toBag = (drag: ItemDrag) => {
    const slot = slotOfDrag(drag.from)
    if (slot) act((e) => e.comp(Equipment)?.unequip(slot) ?? 'no equipment')
  }

  const toSlot = (slot: string) => (drag: ItemDrag) =>
    act((e) => {
      const eq = e.comp(Equipment)
      if (!eq) return 'no equipment'
      const from = slotOfDrag(drag.from)
      if (from) {
        const off = eq.unequip(from)
        if (off !== true) return off
      }
      const found = findItem(e, drag.uid)
      return found ? eq.equip(found, slot) : 'it is gone'
    })

  // Summary stats for inspector idle view
  const armour = stats?.value('armour') || stats?.value('armor') || 10
  const speed = stats?.value('speed') || 30
  const allEquipSlots = equipment?.slotList() ?? []
  const gearSlots = allEquipSlots.filter((s) => s.kind !== 'belt')
  const beltSlots = allEquipSlots.filter((s) => s.kind === 'belt')
  const beltStatVal = stats?.value('belt') ?? beltSlots.length

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[290px_1fr_320px] gap-3 min-h-0">
      {/* 1. LEFT: EQUIPMENT & DEDICATED UTILITY BELT SLOTS */}
      <GamePanel
        title="Equipment"
        className="h-full flex flex-col min-h-0"
        bodyClassName="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto gap-3 p-3"
        action={
          <span className="flex items-center gap-1.5 font-ui text-[11px] font-bold text-accent">
            <Shield className="h-3.5 w-3.5 text-tint-cyan" />
            <span className="text-ink">{armour} AC</span>
          </span>
        }
      >
        {equipment && (
          <div className="flex flex-col gap-3">
            {/* A. Paper Doll Worn Equipment */}
            <div className="flex flex-col gap-1.5">
              <span className="font-label text-[10px] font-bold caps-5 text-tint-cyan">
                Worn Gear
              </span>
              <div className="grid grid-cols-2 gap-2">
                {gearSlots.map(({ id: slot, label, icon }) => {
                  const item = equipment.inSlot(slot)
                  return (
                    <ItemSlot
                      key={slot}
                      from={slotFrom(slot)}
                      label={label}
                      icon={icon ? <KindIcon name={icon} /> : undefined}
                      item={item ? { uid: item.uid, label: itemName(item), count: item.count } : null}
                      selected={!!item && item.uid === picked}
                      tip={item ? itemTip(item) : undefined}
                      onDropItem={toSlot(slot)}
                      onClick={() => item && setPicked(item.uid)}
                      onDoubleClick={() => item && quick(item, entity, act, visitor.sheet)}
                      onMenu={item ? menu(item) : undefined}
                    />
                  )
                })}
              </div>
            </div>

            {/* B. Dedicated Utility Belt Pouches (Count Governed by 'belt' Stat) */}
            <div className="flex flex-col gap-1.5 border-t border-line/50 pt-2.5">
              <div className="flex items-center justify-between">
                <span className="font-label text-[10.5px] font-bold caps-5 text-accent flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-accent" />
                  Utility Belt
                </span>
                <span className="font-ui text-[9.5px] font-bold text-accent border border-accent/40 bg-accent/15 px-1.5 py-0.2">
                  {beltSlots.length} Pockets (Stat: {beltStatVal})
                </span>
              </div>

              {beltSlots.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {beltSlots.map((slot, index) => {
                    const item = equipment.inSlot(slot.id)
                    return (
                      <ItemSlot
                        key={slot.id}
                        from={slotFrom(slot.id)}
                        label={`B${index + 1}`}
                        icon={<FlaskConical className="h-4 w-4 text-tint-green-ink/40" />}
                        item={item ? { uid: item.uid, label: itemName(item), count: item.count } : null}
                        selected={!!item && item.uid === picked}
                        tip={item ? itemTip(item) : undefined}
                        onDropItem={toSlot(slot.id)}
                        onClick={() => item && setPicked(item.uid)}
                        onDoubleClick={() => item && quick(item, entity, act, visitor.sheet)}
                        onMenu={item ? menu(item) : undefined}
                      />
                    )
                  })}
                </div>
              ) : (
                <div className="border border-line/30 tone-panel-40 p-2 text-center font-ui text-[10px] text-faint">
                  No Belt Pockets (Belt Stat is 0)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick equipment summary strip */}
        <div className="border border-line/40 tone-panel-40 p-2 flex flex-col gap-1 font-ui text-[10.5px]">
          <div className="flex items-center justify-between text-dim">
            <span>Main Hand</span>
            <span className="text-ink font-semibold truncate max-w-[140px]">
              {equipment?.inSlot('mainHand') ? itemName(equipment.inSlot('mainHand')!) : 'Empty'}
            </span>
          </div>
          <div className="flex items-center justify-between text-dim">
            <span>Off Hand</span>
            <span className="text-ink font-semibold truncate max-w-[140px]">
              {equipment?.inSlot('offHand') ? itemName(equipment.inSlot('offHand')!) : 'Empty'}
            </span>
          </div>
        </div>
      </GamePanel>

      {/* 2. CENTER: BACKPACK WITH CATEGORY FILTERS & GRID */}
      <GamePanel
        title="Backpack"
        className="h-full flex flex-col min-h-0"
        bodyClassName="flex-1 min-h-0 flex flex-col overflow-hidden gap-3 p-3"
        aside={`${bag.items.length} / ${size}`}
        action={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-ui text-[11.5px] font-bold text-accent">
              <Coins className="h-3.5 w-3.5" />
              <span>{gold} GP</span>
            </span>
          </div>
        }
      >
        {/* Category filters & encumbrance meter */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(['all', 'gear', 'consumable'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 font-label text-[10.5px] font-bold caps-5 transition-all',
                    category === cat
                      ? 'border border-tint-cyan bg-tint-cyan/20 text-tint-cyan shadow-[0_0_10px_color-mix(in_srgb,var(--color-tint-cyan)_calc(30%*var(--glow)),transparent)]'
                      : 'border border-line/40 tone-well-40 text-faint hover:text-ink hover:border-line-strong'
                  )}
                >
                  {cat === 'all' ? 'All' : cat === 'gear' ? 'Gear' : 'Consumables'}
                </button>
              ))}
            </div>

            {/* Encumbrance stats */}
            <div className="flex items-center gap-1.5 font-ui text-[11px] text-dim">
              <Weight className="h-3.5 w-3.5 text-tint-cyan" />
              <span>{Math.round(weight * 10) / 10} / {maxCarry} lbs</span>
            </div>
          </div>

          {/* Encumbrance progress bar */}
          <div className="h-1.5 w-full tone-panel-60 border border-line/40 overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                weight > maxCarry
                  ? 'bg-alert'
                  : weight > maxCarry * 0.8
                  ? 'bg-tint-amber-ink'
                  : 'bg-tint-cyan'
              )}
              style={{ width: `${Math.min(100, Math.round((weight / maxCarry) * 100))}%` }}
            />
          </div>
        </div>

        {/* Backpack Slots Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: Math.max(size, filteredItems.length) }, (_, i) => {
              const item = filteredItems[i] ?? null
              return (
                <ItemSlot
                  key={item?.uid ?? `empty.${i}`}
                  from={BAG}
                  item={item ? { uid: item.uid, label: itemName(item), count: item.count } : null}
                  selected={!!item && item.uid === picked}
                  tip={item ? itemTip(item, wornIn(item)) : undefined}
                  onDropItem={toBag}
                  onClick={() => item && setPicked(item.uid)}
                  onDoubleClick={() => item && quick(item, entity, act, visitor.sheet)}
                  onMenu={item ? menu(item) : undefined}
                />
              )
            })}
          </div>
        </div>
      </GamePanel>

      {/* 3. RIGHT: ITEM DETAILS INSPECTOR / LOADOUT OVERVIEW */}
      <GamePanel
        title={selected ? itemName(selected) : 'Loadout & Vitals'}
        className="h-full flex flex-col min-h-0"
        bodyClassName="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto p-3"
        aside={selected && equipment?.slotOf(selected) ? `Equipped (${equipment.label(equipment.slotOf(selected)!)})` : undefined}
      >
        {selected ? (
          <div className="flex flex-col gap-3">
            <ItemBody item={selected} worn={wornIn(selected)} />
            <div className="pt-2 border-t border-line/40">
              <ActionBar items={itemActions(selected, entity, act, visitor.sheet)} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-ink">
            <div className="flex items-center gap-2 border-b border-line/40 pb-2">
              <Sparkle className="h-4 w-4 text-tint-cyan" />
              <span className="font-label text-[11px] font-bold caps-5 text-tint-cyan">
                Combat Loadout
              </span>
            </div>

            <div className="flex flex-col gap-2 font-ui text-[11.5px]">
              <div className="flex items-center justify-between border border-line/40 tone-panel-40 px-3 py-2">
                <span className="text-dim">Armor Class</span>
                <span className="font-bold text-tint-cyan">{armour} AC</span>
              </div>
              <div className="flex items-center justify-between border border-line/40 tone-panel-40 px-3 py-2">
                <span className="text-dim">Movement Speed</span>
                <span className="font-bold text-ink">{speed} ft</span>
              </div>
              <div className="flex items-center justify-between border border-line/40 tone-panel-40 px-3 py-2">
                <span className="text-dim">Belt Pockets</span>
                <span className="font-bold text-accent">{beltSlots.length} Pockets</span>
              </div>
              <div className="flex items-center justify-between border border-line/40 tone-panel-40 px-3 py-2">
                <span className="text-dim">Carried Weight</span>
                <span className={cn('font-bold', weight > maxCarry ? 'text-alert' : 'text-ok')}>
                  {Math.round(weight * 10) / 10} / {maxCarry} lbs
                </span>
              </div>
            </div>

            {/* Belt Quick Slots Preview */}
            <div className="border border-line/40 tone-panel-40 p-3 flex flex-col gap-2">
              <span className="font-label text-[10.5px] caps-5 text-accent flex items-center justify-between">
                <span>Belt Pouches ({beltSlots.filter((s) => equipment?.inSlot(s.id)).length} / {beltSlots.length})</span>
                <span className="text-faint text-[9.5px]">Governed by Belt Stat</span>
              </span>
              <div className="flex flex-col gap-1.5 text-[12px]">
                {beltSlots.map((slot, index) => {
                  const item = equipment?.inSlot(slot.id)
                  return (
                    <div
                      key={slot.id}
                      onClick={() => item && setPicked(item.uid)}
                      className={cn(
                        'flex items-center justify-between p-1.5 border transition-colors',
                        item
                          ? 'border-line/40 tone-well-50 hover:border-tint-cyan hover:bg-tint-cyan/10 cursor-pointer'
                          : 'border-line/20 tone-panel-20 text-faint'
                      )}
                    >
                      <span className="font-label text-[10px] text-accent caps font-bold">B{index + 1}</span>
                      <span className={cn('truncate max-w-[160px]', item ? 'font-semibold text-ink' : 'italic text-faint')}>
                        {item ? itemName(item) : 'Empty'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </GamePanel>
    </div>
  )
}

registerGameScreen({
  id: 'inventory',
  label: 'Inventory',
  icon: <Backpack />,
  key: 'i',
  order: 20,
  Screen: InventoryScreen
})
