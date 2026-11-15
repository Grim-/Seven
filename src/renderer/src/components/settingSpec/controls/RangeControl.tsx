import { Field, Slider } from '../../ui'
import { registerSettingControl, type SettingControlProps } from '../controls'

function RangeControl({ spec, value, onChange }: SettingControlProps) {
  const n = Number(value)
  return (
    <Field label={`${spec.label} ${n}`} hint={spec.hint}>
      <Slider value={n} min={spec.min ?? 0} max={spec.max ?? 100} step={spec.step ?? 1} onChange={onChange} />
    </Field>
  )
}

registerSettingControl('range', RangeControl)
