import { BrowseList } from '../../../ui/BrowsePick'
import { useKnownGameTags } from '../../useGameSuggestions'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ value }: TokenProps) {
  const s = typeof value === 'string' ? value.trim() : ''
  return <>{s || 'tag'}</>
}

function Edit({ value, onChange, close }: TokenEditProps) {
  const tags = useKnownGameTags()
  const options = tags.map((t) => ({ value: t, label: t, group: 'Tags' }))
  return (
    <BrowseList
      options={options}
      value={typeof value === 'string' ? value : ''}
      allowCustom
      placeholder="Pick tag or type custom…"
      onPick={(next) => {
        onChange(next)
        close()
      }}
    />
  )
}

registerEffectToken('gameTag', { Text, Edit, wide: true })
