import { attackFrom, type DndAttack, type DndStats } from '@shared/dnd'
import { RecordRows } from '../../../ui'
import { useCompendiumList } from '../../../dnd/useCompendiumList'
import { CompendiumAdd } from './CompendiumAdd'
import { detailFor } from './CompendiumDetail'
import { Section } from './Section'

export function Attacks({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const gear = useCompendiumList('equipment')
  const weapons = gear.refs.filter((r) => r.facts.damage).map((r) => r.name)
  const add = (name: string) => {
    const ref = gear.find(name)
    onChange({ attacks: [...dnd.attacks, ref ? attackFrom(dnd, ref) : { name, bonus: '', damage: '', notes: '' }] })
  }
  return (
    <Section title="Attacks">
      <RecordRows<DndAttack>
        dense
        rows={dnd.attacks}
        onChange={(attacks) => onChange({ attacks })}
        blank={() => ({ name: '', bonus: '', damage: '', notes: '' })}
        detail={detailFor('equipment', gear)}
        add={<CompendiumAdd label="Add attack" names={weapons} onAdd={add} />}
        columns={[{ key: 'name', label: 'Name', placeholder: 'Rapier' }, { key: 'bonus', label: 'Hit', width: '3.5rem', placeholder: '+5' }, { key: 'damage', label: 'Damage', placeholder: '1d8+3 piercing' }, { key: 'notes', label: 'Notes', placeholder: 'Finesse' }]}
      />
    </Section>
  )
}
