import { Plus, X } from 'lucide-react'
import { ChipInput } from '../../../ui'
import { useKnownGameTags } from '../../useGameSuggestions'
import { EffectTokenButton, EffectTokenText } from '../EffectTokenButton'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function Text({ spec, value }: TokenProps) {
  const list = listOf(value)
  if (!list.length) return <>none</>
  const of = spec.of
  if (!of) return <>{list.map(String).filter(Boolean).join(', ') || 'none'}</>
  return (
    <>
      {list.map((item, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <EffectTokenText name="" spec={of} value={item} />
        </span>
      ))}
    </>
  )
}

function Edit({ spec, value, onChange }: TokenEditProps) {
  const knownTags = useKnownGameTags()
  const list = listOf(value)
  const of = spec.of
  if (!of) {
    return (
      <ChipInput
        value={list.map(String).filter(Boolean)}
        suggestions={knownTags}
        onChange={(next) => onChange(next)}
        placeholder="Pick existing or type new…"
      />
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {list.map((item, i) => (
        <span key={i} className="inline-flex items-center">
          <EffectTokenButton name={of.label ?? 'item'} spec={of} value={item} onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} />
          <button type="button" title="Remove" onClick={() => onChange(list.filter((_, j) => j !== i))} className="grid h-[26px] w-5 place-items-center text-faint hover:text-alert">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button type="button" onClick={() => onChange([...list, of.default])} className="inline-flex h-[26px] items-center gap-1 border border-dashed border-line px-2 font-ui text-[11px] text-dim hover:border-accent hover:text-accent">
        <Plus className="h-3 w-3" />
        Add
      </button>
    </div>
  )
}

registerEffectToken('list', { Text, Edit, wide: true })
