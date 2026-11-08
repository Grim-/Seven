import { Toggle } from '../../ui'
import { registerParamEditor } from './registry'

registerParamEditor('flag', {
  Editor: ({ value, onChange }) => <Toggle checked={value === true} onChange={onChange} />
})
