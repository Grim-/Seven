import { THINKING_LEVELS, type ThinkingLevel } from '@shared/types'
import { Field, Select } from '../ui'
import { thinkingLabel } from '../../lib/thinking'

export function ThinkingSelect({ value, fallback, hint, onChange }: { value: ThinkingLevel | null; fallback: string; hint: string; onChange: (level: ThinkingLevel | null) => void }) {
  const options = [{ value: '', label: `Default: ${fallback}` }, ...THINKING_LEVELS.map((l) => ({ value: l, label: thinkingLabel(l) }))]
  return (
    <Field label="Thinking" hint={hint}>
      <Select value={value ?? ''} options={options} onChange={(v) => onChange((v || null) as ThinkingLevel | null)} className="h-8 text-[12px]" />
    </Field>
  )
}
