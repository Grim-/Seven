import { DICE } from '@shared/rolledDecision'
import type { DecisionMode, StoredDecision } from '@shared/storedDecision'
import { Field, Input, NumberField, Segmented, Select, TagInput, Textarea } from '../ui'
import { RollerField } from '../play/roll/RollerField'
import { PickOptionsEditor } from './PickOptionsEditor'

export function DecisionEditor({ value: decision, onChange }: { value: StoredDecision; onChange: (next: StoredDecision) => void }) {
  const set = (patch: Partial<StoredDecision>) => onChange({ ...decision, ...patch })
  const rolled = decision.mode === 'roll'
  const kept = decision.options.length
  return (
    <div className="flex flex-col gap-3">
      <Field label="Name">
        <Input autoFocus={!decision.name} value={decision.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name" />
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Who picks">
          <Segmented<DecisionMode>
            value={decision.mode}
            options={[
              { value: 'pick', label: 'You pick' },
              { value: 'roll', label: 'A die picks' }
            ]}
            onChange={(mode) => set({ mode })}
          />
        </Field>
        {rolled ? (
          <Field label="Die">
            <Select value={String(decision.die)} options={DICE.map((d) => ({ value: String(d), label: `d${d}` }))} onChange={(v) => set({ die: Number(v) })} className="w-24" />
          </Field>
        ) : (
          <Field label="Options to write">
            <NumberField value={decision.count} min={1} onChange={(v) => set({ count: v ?? 1 })} className="w-24" />
          </Field>
        )}
      </div>
      {!rolled && <RollerField value={decision.roller ?? 'agent'} onChange={(roller) => set({ roller })} />}
      <Field label="Prompt">
        <Textarea value={decision.prompt} onChange={(e) => set({ prompt: e.target.value })} placeholder="What the options are about, for the agent to write them from" rows={3} />
      </Field>
      <Field label="Tags">
        <TagInput value={decision.tags} onChange={(tags) => set({ tags })} />
      </Field>
      <Field label={rolled ? `Kept options (none, or exactly ${decision.die})` : 'Kept options (none to have them written each time)'} group>
        <div className="flex flex-col gap-2">
          <PickOptionsEditor options={decision.options} onChange={(options) => set({ options })} rolls={!rolled} />
          {rolled && kept > 0 && kept !== decision.die && <span className="font-mono text-[11px] text-alert">{kept} kept; a d{decision.die} needs {decision.die}.</span>}
        </div>
      </Field>
    </div>
  )
}
