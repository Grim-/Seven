import { Field } from '../../ui'
import { PictureField } from '../../pictures/PictureField'
import { MEDIA_OPTIONS } from '../../pictures/mediaOptions'
import { registerSettingControl, type SettingControlProps } from '../controls'

function PictureControl({ spec, value, onChange }: SettingControlProps) {
  return (
    <Field label={spec.label} hint={spec.hint}>
      <PictureField options={MEDIA_OPTIONS} value={String(value) || null} onChange={(id) => onChange(id ?? '')} />
    </Field>
  )
}

registerSettingControl('picture', PictureControl)
