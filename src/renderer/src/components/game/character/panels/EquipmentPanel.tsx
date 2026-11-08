import { X } from 'lucide-react'
import { Equipment, Inventory } from '@shared/game/components'
import { Button, Select } from '../../../ui'
import { toast } from '../../../../store/toasts'
import { Section } from '../../../data/sheet/dnd/Section'
import { registerComponentPanel, type PanelProps } from './registry'

function EquipmentPanel({ comp, entity, changed }: PanelProps<Equipment>) {
  const carried = entity.comp(Inventory)?.items ?? []
  const act = (result: true | string) => {
    if (result !== true) toast.error('Could not do that', result)
    changed()
  }
  return (
    <Section title="Equipment">
      {comp.slotList().map(({ id: slot, label }) => {
        const worn = comp.inSlot(slot)
        const fits = carried.filter((item) => comp.fitting(item).includes(slot))
        return (
          <div key={slot} className="flex items-center gap-2 text-[13px]">
            <span className="w-24 shrink-0 font-mono text-[11.5px] text-faint">{label}</span>
            {worn ? (
              <>
                <span className="min-w-0 flex-1 truncate text-white/90">{String(worn.params.label || worn.id)}</span>
                <Button size="sm" variant="ghost" icon={<X />} title="Take off" onClick={() => act(comp.unequip(slot))} />
              </>
            ) : fits.length ? (
              <Select value="" options={[{ value: '', label: 'Put on…' }, ...fits.map((i) => ({ value: i.uid, label: String(i.params.label || i.id) }))]} onChange={(uid) => {
                const item = fits.find((i) => i.uid === uid)
                if (item) act(comp.equip(item, slot))
              }} className="h-7 flex-1 text-[12.5px]" />
            ) : (
              <span className="flex-1 text-faint">empty</span>
            )}
          </div>
        )
      })}
    </Section>
  )
}

registerComponentPanel(Equipment.type, { Panel: EquipmentPanel })
