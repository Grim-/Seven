import { KindShell } from '../ui'
import { useKindEntries } from '../../views/data/useKindEntries'
import { presentOf, type KindPickerProps } from '../../registries/kinds'
import { kindItem } from '../../lib/kindItem'

export function KindPicker({ section, onPick }: KindPickerProps) {
  const list = useKindEntries(section.kind)
  const { Thumb } = presentOf(section.kind)
  if (list === null) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  return (
    <KindShell
      id={`pick-${section.kind}`}
      inherit={`kind-${section.kind}`}
      layouts={Thumb ? ['tiles', 'cards', 'deck', 'list'] : ['cards', 'deck', 'list']}
      items={list.map((h) => kindItem(section, h))}
      onOpen={(item) => {
        const hit = list.find((h) => h.id === item.key)
        if (hit) onPick(hit.kind, hit.id)
      }}
      dragOut
      empty={`No ${section.plural.toLowerCase()} yet.`}
    />
  )
}
