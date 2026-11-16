import { useState, type MouseEvent } from 'react'
import { Shield, X } from 'lucide-react'
import { Equipment, Inventory, Item, Stats } from '@shared/game/components'
import { Button, openMenu } from '../../../ui'
import { BrowsePick } from '../../../ui/BrowsePick'
import { KindIcon } from '../../../../lib/library'
import { toast } from '../../../../store/toasts'
import { GamePanel, ItemSlot, type ItemDrag } from '../../../../game/ui'
import { itemName, itemTip } from '../../../play/screens/itemTip'
import { registerComponentPanel, type PanelProps } from './registry'

const slotFrom = (slot: string) => `slot:${slot}`
const slotOfDrag = (from: string) => (from.startsWith('slot:') ? from.slice(5) : null)

function EquipmentPanel({ comp, entity, changed }: PanelProps<Equipment>) {
  const bag = entity.comp(Inventory)
  const carried = bag?.items ?? []
  const stats = entity.comp(Stats)
  const armour = Math.round(stats?.value('armour') ?? stats?.value('armor') ?? 10)
  const allSlots = comp.slotList()
  const gearSlots = allSlots.filter((s) => s.kind !== 'belt')
  const beltSlots = allSlots.filter((s) => s.kind === 'belt')
  const [activeSlot, setActiveSlot] = useState<string | null>(null)

  const act = (result: true | string) => {
    if (result !== true) toast.error('Could not do that', result)
    changed()
  }

  const onDropTo = (slot: string) => (drag: ItemDrag) => {
    const fromSlot = slotOfDrag(drag.from)
    if (fromSlot) {
      const off = comp.unequip(fromSlot)
      if (off !== true) return act(off)
    }
    const found =
      carried.find((i) => i.uid === drag.uid) ??
      comp.comps.find((c): c is Item => c instanceof Item && c.uid === drag.uid)
    if (found) act(comp.equip(found, slot))
  }

  const slotMenu = (slot: string, worn: Item | null) => (e: MouseEvent) => {
    const fits = carried.filter((item) => comp.fitting(item).includes(slot))
    openMenu(e, comp.label(slot), [
      ...(worn ? [{ label: 'Take off', icon: <X />, onSelect: () => act(comp.unequip(slot)) }] : []),
      ...fits.map((i) => ({ label: `Equip ${itemName(i)}`, onSelect: () => act(comp.equip(i, slot)) }))
    ])
  }

  const activeWorn = activeSlot ? comp.inSlot(activeSlot) : null
  const activeFits = activeSlot ? carried.filter((item) => comp.fitting(item).includes(activeSlot)) : []

  return (
    <GamePanel
      title="Equipment"
      aside={`${comp.comps.length} equipped`}
      action={
        <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-cyan">
          <Shield className="h-3.5 w-3.5" />
          {armour} AC
        </span>
      }
      bodyClassName="gap-2.5 p-3"
    >
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {gearSlots.map(({ id: slot, label, icon }) => {
          const worn = comp.inSlot(slot)
          return (
            <ItemSlot
              key={slot}
              from={slotFrom(slot)}
              label={label}
              icon={icon ? <KindIcon name={icon} /> : undefined}
              item={worn ? { uid: worn.uid, label: itemName(worn), count: worn.count } : null}
              selected={activeSlot === slot}
              tip={worn ? itemTip(worn) : { title: label, body: <span className="text-[11px] text-dim">Click to equip or drop gear here</span> }}
              onDropItem={onDropTo(slot)}
              onClick={() => setActiveSlot((cur) => (cur === slot ? null : slot))}
              onDoubleClick={() => worn && act(comp.unequip(slot))}
              onMenu={slotMenu(slot, worn)}
            />
          )
        })}
      </div>

      {beltSlots.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line/30 pt-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Utility Belt</span>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {beltSlots.map(({ id: slot, label, icon }) => {
              const worn = comp.inSlot(slot)
              return (
                <ItemSlot
                  key={slot}
                  from={slotFrom(slot)}
                  label={label}
                  icon={icon ? <KindIcon name={icon} /> : undefined}
                  item={worn ? { uid: worn.uid, label: itemName(worn), count: worn.count } : null}
                  selected={activeSlot === slot}
                  tip={worn ? itemTip(worn) : { title: label, body: <span className="text-[11px] text-dim">Drop utility item or click</span> }}
                  onDropItem={onDropTo(slot)}
                  onClick={() => setActiveSlot((cur) => (cur === slot ? null : slot))}
                  onDoubleClick={() => worn && act(comp.unequip(slot))}
                  onMenu={slotMenu(slot, worn)}
                />
              )
            })}
          </div>
        </div>
      )}

      {activeSlot && (
        <div className="flex flex-wrap items-center gap-2 border border-line/40 bg-black/50 px-2.5 py-2">
          <span className="font-mono text-[10.5px] uppercase text-cyan">{comp.label(activeSlot)}:</span>
          {activeWorn ? (
            <>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-white">{itemName(activeWorn)}</span>
              <Button size="sm" variant="ghost" icon={<X />} onClick={() => act(comp.unequip(activeSlot))}>
                Take off
              </Button>
            </>
          ) : activeFits.length > 0 ? (
            <BrowsePick
              value={null}
              options={activeFits.map((i) => ({ value: i.uid, label: itemName(i), group: 'Bag', note: i.count > 1 ? `×${i.count}` : undefined }))}
              placeholder="Equip fitting item…"
              onChange={(uid) => {
                const found = activeFits.find((i) => i.uid === uid)
                if (found) act(comp.equip(found, activeSlot))
              }}
              className="min-w-[10rem] flex-1"
            />
          ) : (
            <span className="text-[12px] text-faint">No fitting items in bag.</span>
          )}
        </div>
      )}
    </GamePanel>
  )
}

registerComponentPanel(Equipment.type, { Panel: EquipmentPanel })
