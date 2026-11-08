import type { RollerChoice } from '@shared/storedDecision'
import { Field, Segmented } from '../../ui'

const OPTIONS = [
  { value: 'agent' as const, label: 'Agent picks' },
  { value: 'player' as const, label: 'Player picks' }
]

export function RollerField({ value, onChange }: { value: RollerChoice; onChange: (next: RollerChoice) => void }) {
  return (
    <Field label="Who rolls the check" tip="Whether the agent chooses the character when making the decision, or the player chooses freely.">
      <Segmented<RollerChoice> value={value} options={OPTIONS} onChange={onChange} />
    </Field>
  )
}
