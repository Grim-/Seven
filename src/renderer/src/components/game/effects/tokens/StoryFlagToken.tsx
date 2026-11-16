import { BrowseList } from '../../../ui/BrowsePick'
import { useKnownWorldFlags } from '../../useGameSuggestions'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ value }: TokenProps) {
  const s = typeof value === 'string' ? value.trim() : ''
  return <>{s || 'flag'}</>
}

function Edit({ value, onChange, close }: TokenEditProps) {
  const flags = useKnownWorldFlags()
  const options = flags.map((f) => ({ value: f.id, label: f.id, group: f.world }))
  return (
    <BrowseList
      options={options}
      value={typeof value === 'string' ? value : ''}
      allowCustom
      placeholder="Pick world flag or type custom…"
      onPick={(next) => {
        onChange(next)
        close()
      }}
    />
  )
}

registerEffectToken('storyFlag', { Text, Edit, wide: true })
