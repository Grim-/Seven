import type { ComponentDef } from '@shared/game/core'
import { Pieces } from '../parts/Pieces'
import { registerParamEditor } from './registry'

registerParamEditor('components', {
  Editor: ({ spec, value, onChange }) => <Pieces host={spec.host ?? ''} value={Array.isArray(value) ? (value as ComponentDef[]) : []} onChange={onChange} />,
  wide: true
})
