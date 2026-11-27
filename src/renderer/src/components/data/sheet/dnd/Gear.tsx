import { DND_COINS, itemFrom, type DndItem, type DndStats } from '@shared/dnd'
import { InlineNumber, RecordRows } from '../../../ui'
import { useCompendiumList } from '../../../dnd/useCompendiumList'
import { CompendiumAdd } from './CompendiumAdd'
import { detailFor } from './CompendiumDetail'
import { Section } from './Section'

export function Gear({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const gear = useCompendiumList('equipment')
  return (
    <Section title="Equipment">
      <div className="flex flex-wrap gap-x-3 font-ui text-[12px]">
        {DND_COINS.map((c) => (
          <span key={c} className="flex items-baseline gap-1">
            <InlineNumber value={dnd.coins[c]} min={0} onSave={(n) => onChange({ coins: { ...dnd.coins, [c]: n } })} className={dnd.coins[c] ? 'text-ink' : 'text-faint'} />
            <span className="text-[10.5px] caps text-accent-soft">{c}</span>
          </span>
        ))}
      </div>
      <RecordRows<DndItem>
        dense
        rows={dnd.equipment}
        onChange={(equipment) => onChange({ equipment })}
        blank={() => ({ name: '', qty: 1, equipped: false, note: '' })}
        detail={detailFor('equipment', gear)}
        add={<CompendiumAdd label="Add item" names={gear.names} onAdd={(name) => { const ref = gear.find(name); onChange({ equipment: [...dnd.equipment, ref ? itemFrom(ref) : { name, qty: 1, equipped: false, note: '' }] }) }} />}
        columns={[{ key: 'name', label: 'Item', placeholder: 'Rope, 50 ft' }, { key: 'note', label: 'Damage, AC, properties', placeholder: '1d8 piercing, finesse' }, { key: 'qty', label: 'Qty', kind: 'number', width: '3rem' }, { key: 'equipped', label: 'Worn', kind: 'check', width: '2.5rem' }]}
      />
    </Section>
  )
}
