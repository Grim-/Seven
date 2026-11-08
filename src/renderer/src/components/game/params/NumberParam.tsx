import { NumberField } from '../../ui'
import { registerParamEditor } from './registry'

registerParamEditor('number', {
  Editor: ({ spec, value, onChange }) => <NumberField value={typeof value === 'number' ? value : undefined} min={spec.min} max={spec.max} onChange={(n) => onChange(n ?? spec.default)} />
})
