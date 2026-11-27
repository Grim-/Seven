import { BrowsePick } from '../../ui/BrowsePick'
import { useSignalOptions } from '../linkEvents'
import { registerParamEditor, type ParamEditorProps } from './registry'

function SignalPick({ value, onChange }: ParamEditorProps) {
  const options = useSignalOptions()
  return (
    <BrowsePick
      value={typeof value === 'string' ? value : ''}
      options={options}
      allowCustom
      placeholder="Pick signal or type custom…"
      onChange={(next) => onChange(next ?? '')}
    />
  )
}

registerParamEditor('signal', { Editor: SignalPick })
