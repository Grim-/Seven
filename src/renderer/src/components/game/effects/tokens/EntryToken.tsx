import { BrowseList } from '../../../ui/BrowsePick'
import { useEntryOptions } from '../../useEntryOptions'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ spec, value }: TokenProps) {
  const options = useEntryOptions(spec.entryKind ?? '')
  const id = typeof value === 'string' ? value : ''
  return <>{options.find((o) => o.value === id)?.label ?? id}</>
}

function Edit({ spec, value, onChange, close }: TokenEditProps) {
  const options = useEntryOptions(spec.entryKind ?? '')
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

registerEffectToken('entry', { Text, Edit, wide: true })
