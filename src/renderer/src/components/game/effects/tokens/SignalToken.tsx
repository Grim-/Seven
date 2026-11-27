import { signalLabel } from '@shared/game/core'
import { BrowseList } from '../../../ui/BrowsePick'
import { useSignalOptions } from '../../linkEvents'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ value }: TokenProps) {
  const id = typeof value === 'string' ? value : ''
  return <>{signalLabel(id)}</>
}

function Edit({ value, onChange, close }: TokenEditProps) {
  const options = useSignalOptions()
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
