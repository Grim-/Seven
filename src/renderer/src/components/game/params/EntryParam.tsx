import { BrowsePick } from '../../ui/BrowsePick'
import { useEntryOptions } from '../useEntryOptions'
import { registerParamEditor, type ParamEditorProps } from './registry'

function EntryPick({ spec, value, onChange }: ParamEditorProps) {
  const options = useEntryOptions(spec.entryKind ?? '')
  return <BrowsePick value={typeof value === 'string' && value ? value : null} options={options} placeholder="None" onChange={(id) => onChange(id ?? '')} />
}

registerParamEditor('entry', { Editor: EntryPick })
