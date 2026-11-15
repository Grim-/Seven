import { TriggerActionSelect } from '../TriggerActionSelect'
import { registerParamEditor, type ParamEditorProps } from './registry'

function StoredActionPick({ value, onChange }: ParamEditorProps) {
  return <TriggerActionSelect value={typeof value === 'string' ? value : null} onChange={(id) => onChange(id ?? '')} placeholder="None" />
}

registerParamEditor('storedAction', { Editor: StoredActionPick })
