import { choiceLabel } from '@shared/game/core/params'
import { Select } from '../../ui'
import { registerParamEditor } from './registry'

registerParamEditor('choice', {
  Editor: ({ spec, value, onChange }) => <Select value={typeof value === 'string' ? value : String(spec.default)} options={(spec.choices ?? []).map((c) => ({ value: c, label: choiceLabel(spec, c) }))} onChange={onChange} />
})
