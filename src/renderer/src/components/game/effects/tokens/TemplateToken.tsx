import { defType } from '@shared/game/defs'
import { BrowseList } from '../../../ui/BrowsePick'
import { useGameDefs } from '../../useGameDefs'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ spec, value }: TokenProps) {
  const defs = useGameDefs(spec.templateKind ?? '')
  const id = typeof value === 'string' ? value : ''
  return <>{defs.list?.find((d) => d.id === id)?.name ?? id}</>
}

function Edit({ spec, value, onChange, close }: TokenEditProps) {
  const kind = spec.templateKind ?? ''
  const defs = useGameDefs(kind)
  const group = defType(kind)?.plural ?? 'All'
  const options = (defs.list ?? []).map((d) => ({ value: d.id, label: d.name, group, note: d.notes || undefined }))
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

registerEffectToken('template', { Text, Edit, wide: true })
