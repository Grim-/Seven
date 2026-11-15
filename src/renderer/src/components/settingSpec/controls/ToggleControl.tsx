import { Field, Toggle } from '../../ui'
import { registerSettingControl, type SettingControlProps } from '../controls'

function ToggleControl({ spec, value, onChange }: SettingControlProps) {
  return (
    <Field label={spec.label} hint={spec.hint}>
      <Toggle checked={value === true} onChange={onChange} />
    </Field>
  )
}

registerSettingControl('toggle', ToggleControl)
