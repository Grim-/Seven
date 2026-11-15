import { Field, Select } from '../../ui'
import { registerSettingControl, type SettingControlProps } from '../controls'

function ChoiceControl({ spec, value, onChange }: SettingControlProps) {
  return (
    <Field label={spec.label} hint={spec.hint}>
      <Select value={String(value)} options={spec.options ?? []} onChange={onChange} />
    </Field>
  )
}

registerSettingControl('choice', ChoiceControl)
