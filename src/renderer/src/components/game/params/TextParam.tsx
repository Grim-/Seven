import { Input, Textarea } from '../../ui'
import { registerParamEditor } from './registry'

registerParamEditor('text', {
  Editor: ({ spec, value, onChange }) => {
    const text = typeof value === 'string' ? value : ''
    return spec.long ? <Textarea value={text} onChange={(e) => onChange(e.target.value)} className="min-h-20" /> : <Input value={text} onChange={(e) => onChange(e.target.value)} />
  },
  wide: (spec) => spec.long === true
})
