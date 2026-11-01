import { EmptyState, TraitChips } from '../ui'
import { useStyleList } from '../../store/styles'
import { EntryCard } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

export function StyleChat({ id }: EntrySurfaceProps) {
  const style = useStyleList((s) => s.list.find((x) => x.id === id))
  if (!style) return <EmptyState title="Removed">This reasoning style no longer exists.</EmptyState>
  return (
    <EntryCard title={style.name} tag="style">
      <span className="text-[12.5px] leading-relaxed text-dim">{style.instruction}</span>
      <TraitChips traits={style.voices.map((v, i) => ({ key: String(i), label: v.label, hint: v.line }))} />
    </EntryCard>
  )
}
