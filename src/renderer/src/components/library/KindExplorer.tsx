import type { ReactNode } from 'react'
import { EmptyState, KindShell, ListRow } from '../ui'
import { KindRail } from '../../views/data/KindRail'
import { useLibrary } from '../../lib/library'
import { useViewPlace } from '../../lib/viewPlace'
import { kindItem } from '../../lib/kindItem'
import { KindPicker } from './KindPicker'
import { kindUi } from '../../registries/kinds'

export interface ExplorerTab {
  id: string
  label: string
  icon: ReactNode
  node: ReactNode
}

export function KindExplorer({ id, onPick, tabs = [] }: { id: string; onPick: (kind: string, id: string) => void; tabs?: ExplorerTab[] }) {
  const { sections } = useLibrary('', 12)
  const [current, setCurrent] = useViewPlace<string | null>(`${id}.kind`, null)
  const [closed, setClosed] = useViewPlace<string[]>(`${id}.closed`, [])
  const tab = tabs.find((t) => t.id === current)
  const shown = current ? (kindUi(current).showsAs ?? current) : null
  const section = sections?.find((s) => s.kind === shown) ?? null
  const Picker = (shown ? kindUi(shown).picker : undefined) ?? KindPicker
  const shut = new Set(closed)
  const all = (sections ?? []).flatMap((s) => s.entries.map((h) => ({ section: s, hit: h })))
  return (
    <div className="flex min-h-0 flex-1 gap-2">
      <aside className="panel-box flex w-56 shrink-0 flex-col">
        {tabs.length > 0 && (
          <div className="border-b border-line/40 py-1.5">
            {tabs.map((t) => (
              <ListRow key={t.id} active={current === t.id} onClick={() => setCurrent(t.id)} icon={t.icon} title={t.label} />
            ))}
          </div>
        )}
        <KindRail sections={sections ?? []} current={tab ? '' : current} closed={shut} onPick={setCurrent} onToggle={(g) => setClosed(shut.has(g) ? closed.filter((x) => x !== g) : [...closed, g])} />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {tab ? (
          tab.node
        ) : section ? (
          <Picker key={section.kind} section={section} onPick={onPick} />
        ) : sections === null ? (
          <div className="font-mono text-[11px] text-dim">Loading…</div>
        ) : all.length ? (
          <KindShell
            id={`${id}.everything`}
            layouts={['cards', 'deck', 'list']}
            items={all.map(({ section: s, hit }) => ({ ...kindItem(s, hit), key: `${hit.kind}/${hit.id}` }))}
            onOpen={(item) => {
              const found = all.find(({ hit }) => `${hit.kind}/${hit.id}` === item.key)
              if (found) onPick(found.hit.kind, found.hit.id)
            }}
            empty="Nothing yet."
          />
        ) : (
          <EmptyState title="Nothing here yet">Make pages, characters and the rest in Data, then put them here.</EmptyState>
        )}
      </div>
    </div>
  )
}
