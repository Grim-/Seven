import { BrowseList } from '../../../ui/BrowsePick'
import { useTriggerActionOptions } from '../../TriggerActionSelect'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ value }: TokenProps) {
  const { actions } = useTriggerActionOptions()
  const id = typeof value === 'string' ? value : ''
  return <>{actions.find((a) => a.id === id)?.name ?? id}</>
}

function Edit({ value, onChange, close }: TokenEditProps) {
  const { options } = useTriggerActionOptions()
  return (
    <BrowseList
      options={options}
      value={typeof value === 'string' ? value : null}
      onPick={(next) => {
        onChange(next)
        close()
      }}
    />
  )
}

registerEffectToken('storedAction', { Text, Edit, wide: true })
