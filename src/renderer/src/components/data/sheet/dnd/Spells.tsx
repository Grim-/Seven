import { DND_STATS, signed, spellAttack, spellDc, spellFrom, type DndSpell, type DndStat, type DndStats } from '@shared/dnd'
import { RecordRows, Select } from '../../../ui'
import { useCompendiumList } from '../../../dnd/useCompendiumList'
import { CompendiumAdd } from './CompendiumAdd'
import { detailFor } from './CompendiumDetail'
import { Section } from './Section'
import { SpellSlots } from './SpellSlots'

export function Spells({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const spells = useCompendiumList('spell')
  const dc = spellDc(dnd)
  const add = (name: string) => {
    const ref = spells.find(name)
    onChange({ spells: [...dnd.spells, ref ? spellFrom(ref) : { name, level: 0, prepared: false, note: '' }].sort((a, b) => a.level - b.level) })
  }
  return (
    <Section
      title="Spells"
      aside={dc !== null ? `save DC ${dc} · attack ${signed(spellAttack(dnd) ?? 0)}` : undefined}
      action={<Select value={dnd.spellAbility ?? ''} options={[{ value: '', label: 'No spellcasting' }, ...DND_STATS.map((s) => ({ value: s, label: `Casts with ${s.toUpperCase()}` }))]} onChange={(v) => onChange({ spellAbility: (v || null) as DndStat | null })} className="h-7 w-40 text-[11.5px]" />}
    >
      {dnd.spellAbility ? (
        <>
          <SpellSlots dnd={dnd} onChange={onChange} />
          <RecordRows<DndSpell>
            dense
            rows={dnd.spells}
            onChange={(next) => onChange({ spells: next })}
            blank={() => ({ name: '', level: 0, prepared: false, note: '' })}
            detail={detailFor('spell', spells)}
            add={<CompendiumAdd label="Add spell" names={spells.names} onAdd={add} />}
            columns={[{ key: 'level', label: 'Lvl', kind: 'number', width: '3rem' }, { key: 'name', label: 'Spell', placeholder: 'Misty Step' }, { key: 'prepared', label: 'Prep', kind: 'check' }, { key: 'note', label: 'Note', placeholder: 'Bonus action, 30 feet' }]}
          />
        </>
      ) : (
        <span className="text-[12px] text-faint">Not a spellcaster. Pick the casting ability to add slots and spells.</span>
      )}
    </Section>
  )
}
