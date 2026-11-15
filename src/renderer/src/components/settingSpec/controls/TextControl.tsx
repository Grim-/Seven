import { Field, Input } from '../../ui'
import { registerSettingControl, type SettingControlProps } from '../controls'

function TextControl({ spec, value, onChange }: SettingControlProps) {
  return (
    <Field label={spec.label} hint={spec.hint}>
      <Input value={String(value)} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

registerSettingControl('text', TextControl)
