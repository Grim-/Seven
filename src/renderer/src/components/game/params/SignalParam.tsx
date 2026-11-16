import { GAME_SIGNALS } from '@shared/game/core'
import { BrowsePick } from '../../ui/BrowsePick'
import { registerParamEditor, type ParamEditorProps } from './registry'

function SignalPick({ value, onChange }: ParamEditorProps) {
  const options = GAME_SIGNALS.map((s) => ({
    value: s.id,
    label: s.id ? `${s.label} (${s.id})` : s.label,
    group: s.group,
    note: s.note
  }))
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
