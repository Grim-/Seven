import type { DndStats } from '@shared/dnd'
import { InlineEdit } from '../../../ui'
import { Section } from './Section'

const ROWS: { key: keyof DndStats['proficiencies']; label: string; placeholder: string }[] = [
  { key: 'armor', label: 'Armour', placeholder: 'Light, medium' },
  { key: 'weapons', label: 'Weapons', placeholder: 'Simple, martial' },
  { key: 'tools', label: 'Tools', placeholder: "Thieves' tools" },
  { key: 'languages', label: 'Languages', placeholder: 'Common, Primordial' }
]

export function Proficiencies({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  return (
    <Section title="Proficiencies">
      <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1 text-[12.5px]">
        {ROWS.map((r) => [
          <span key={`${r.key}-l`} className="text-faint">{r.label}</span>,
          <InlineEdit key={r.key} value={dnd.proficiencies[r.key]} placeholder={r.placeholder} onSave={(v) => onChange({ proficiencies: { ...dnd.proficiencies, [r.key]: v } })} className="text-white" />
        ])}
      </div>
    </Section>
  )
}
