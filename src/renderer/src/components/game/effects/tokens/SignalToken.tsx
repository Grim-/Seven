import { GAME_SIGNALS, signalLabel } from '@shared/game/core'
import { BrowseList } from '../../../ui/BrowsePick'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ value }: TokenProps) {
  const id = typeof value === 'string' ? value : ''
  return <>{signalLabel(id)}</>
}

function Edit({ value, onChange, close }: TokenEditProps) {
  const options = GAME_SIGNALS.map((s) => ({
    value: s.id,
    label: s.id ? `${s.label} (${s.id})` : s.label,
    group: s.group,
    note: s.note
  }))
  return (
    <BrowseList
      options={options}
      value={typeof value === 'string' ? value : ''}
      allowCustom
      placeholder="Search signals or type custom…"
      onPick={(next) => {
        onChange(next)
        close()
      }}
    />
  )
}

registerEffectToken('signal', { Text, Edit, wide: true })
