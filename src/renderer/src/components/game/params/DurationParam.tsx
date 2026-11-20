import { DurationInput } from '../DurationInput'
import { registerParamEditor } from './registry'

registerParamEditor('duration', {
  Editor: ({ spec, value, onChange }) => <DurationInput value={typeof value === 'number' ? value : Number(spec.default) || 0} onChange={onChange} />
})
