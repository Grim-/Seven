import { DND_CONDITIONS, type DndStats } from '@shared/dnd'
import { ChipInput, InlineNumber } from '../../../ui'
import { Section } from './Section'

export function Conditions({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  return (
    <Section
      title="Conditions"
      action={
        <span className="flex items-baseline gap-1.5 font-ui text-[11px] text-dim">
          exhaustion <InlineNumber value={dnd.exhaustion} min={0} max={6} onSave={(exhaustion) => onChange({ exhaustion })} className={dnd.exhaustion ? 'text-alert' : 'text-ink'} />
        </span>
      }
    >
      <ChipInput value={dnd.conditions} onChange={(conditions) => onChange({ conditions })} suggestions={DND_CONDITIONS} placeholder="None. Type to add one" />
    </Section>
  )
}
