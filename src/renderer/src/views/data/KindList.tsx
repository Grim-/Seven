import { Plus } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import { KindShell } from '../../components/ui'
import { kindItem } from '../../lib/kindItem'
import type { DataSelection } from '../../store/data'
import { kindUi, presentOf } from '../../registries/kinds'
import { KindSelectionBar, openEntryMenu, openIn, openMultiEntryMenu } from './entryMenu'
import { useKindEntries } from './useKindEntries'

export { openIn }

export function KindList({ section, selected, select }: { section: LibrarySection; selected: DataSelection | null; select: (s: DataSelection | null) => void }) {
  const list = useKindEntries(section.kind)
  const ui = kindUi(section.kind)
  const { Thumb } = presentOf(section.kind)
  const add = ui.add?.(section.kind, select)
  if (list === null) return <div className="font-ui text-[11px] text-dim">Loading…</div>
  return (
    <KindShell
      id={`kind-${section.kind}`}
      pickable
      layouts={Thumb ? ['tiles', 'cards', 'deck', 'list'] : ['cards', 'deck', 'list']}
      items={list.map((h) => kindItem(section, h))}
      selectionBar={(picked, { selectAll, clear }) => (
        <KindSelectionBar
          kind={section.kind}
          picked={picked}
          total={list.length}
          exportable={section.exportable}
          removable={section.removable}
          onSelectAll={selectAll}
          onClear={clear}
        />
      )}
      onOpen={(item) => openIn(section.kind, item.key, select)}
      onMenu={(e, item, picked) => {
        if (picked.length > 1) {
          openMultiEntryMenu(e, section, picked)
          return
        }
        const hit = list.find((h) => h.id === item.key)
        if (hit) openEntryMenu(e, section, hit, { open: () => openIn(section.kind, hit.id, select), select, selected })
      }}
      adds={add ? [{ label: ui.addLabel ?? `New ${section.label.toLowerCase()}`, icon: <Plus />, onClick: add }] : []}
      empty={`No ${section.plural.toLowerCase()} yet.`}
    />
  )
}
