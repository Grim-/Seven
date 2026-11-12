import type { ToolChoiceMode } from '@shared/types'
import { Field, Select } from '../ui'

export function toolChoiceLabel(mode: ToolChoiceMode): string {
  switch (mode) {
    case 'force_reason':
      return 'Force Reason (Deliberate first)'
    case 'required':
      return 'Require Tool (Any tool first)'
    case 'none':
      return 'No Tools (Pure chat)'
    case 'auto':
    default:
      return 'Auto (Model decides)'
  }
}

export function ToolChoiceSelect({
  value,
  fallback,
  hint,
  onChange
}: {
  value: ToolChoiceMode | null
  fallback: string
  hint?: string
  onChange: (mode: ToolChoiceMode | null) => void
}) {
  const options: { value: string; label: string }[] = [
    { value: '', label: `Default: ${fallback}` },
    { value: 'auto', label: 'Auto (Model decides)' },
    { value: 'force_reason', label: 'Force Reason (Deliberate first)' },
    { value: 'required', label: 'Require Tool (Any tool first)' },
    { value: 'none', label: 'No Tools (Pure chat)' }
  ]
  return (
    <Field label="Tool Execution Mode" hint={hint}>
      <Select
        value={value ?? ''}
        options={options}
        onChange={(v) => onChange((v || null) as ToolChoiceMode | null)}
        className="h-8 text-[12px]"
      />
    </Field>
  )
}
