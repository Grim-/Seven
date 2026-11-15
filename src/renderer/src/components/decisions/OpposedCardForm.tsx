import type { OpposedProps, OpposedSide } from '@shared/opposedCheck'
import { BASE } from '@shared/actions'
import { Field, Input, NumberField, Segmented } from '../ui'
import { OpposedSideFields } from './OpposedSideFields'

const SIDE: OpposedSide = { name: '', sheet: null, does: '', against: '', bonus: 0, action: null, loses: '', effects: [] }

export const BLANK_OPPOSED: OpposedProps = { question: '', a: SIDE, b: SIDE, dc: null }

export function OpposedCardForm({ value, onChange }: { value: OpposedProps; onChange: (next: OpposedProps) => void }) {
  const set = (patch: Partial<OpposedProps>) => onChange({ ...value, ...patch })
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Field label="Question">
        <Input value={value.question} onChange={(e) => set({ question: e.target.value })} placeholder="Does the guard spot the lie?" />
      </Field>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-2">
        <OpposedSideFields title="Whoever plays it" side={value.a} targets={[]} onChange={(a) => set({ a })} editable who={false} />
        <div className="flex min-w-0 flex-col gap-2">
          <Segmented
            value={value.dc === null ? 'roll' : 'dc'}
            options={[
              { value: 'roll', label: 'The target rolls' },
              { value: 'dc', label: 'Fixed DC' }
            ]}
            onChange={(v) => set({ dc: v === 'dc' ? (value.dc ?? BASE) : null })}
          />
          {value.dc === null ? (
            <OpposedSideFields title="The target (picked when played)" side={value.b} targets={[]} onChange={(b) => set({ b })} editable who={false} />
          ) : (
            <Field label="DC">
              <NumberField value={value.dc} onChange={(v) => set({ dc: v ?? 0 })} className="w-20" />
            </Field>
          )}
        </div>
      </div>
    </div>
  )
}
