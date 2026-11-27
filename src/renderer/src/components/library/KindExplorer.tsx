import { useEffect, useState, type ReactNode } from 'react'
import { hitDetail, type LibraryHit, type LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { EmptyState, KindShell, ListRow, SearchBox, type ShellItem } from '../ui'
import { KindRail } from '../../views/data/KindRail'
import { KindIcon, useLibrary } from '../../lib/library'
import { useViewPlace } from '../../lib/viewPlace'
import { KindPicker } from './KindPicker'
import { kindUi, presentOf } from '../../registries/kinds'
import { engine } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'

export interface ExplorerTab {
  id: string
  label: string
  icon: ReactNode
  node: ReactNode
}

function EverythingPicker({ query, onPick }: { query: string; onPick: (kind: string, id: string) => void }) {
  const [sections, setSections] = useState<LibrarySection[] | null>(null)
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      void engine('library.overview', { query, perKind: query ? 24 : 8 })
        .then((list) => live && setSections(list.filter((s) => s.entries.length)))
        .catch(noteFailure('library', 'Could not search', () => live && setSections([])))
    }, query ? 150 : 0)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query])

  if (sections === null) return <div className="font-ui text-[11px] text-dim">Loading…</div>

  const entries: { section: LibrarySection; hit: LibraryHit }[] = query
    ? sections.flatMap((section) => section.entries.filter((h) => !h.id.startsWith('all:')).map((hit) => ({ section, hit })))
    : sections
        .flatMap((section) => section.entries.filter((h) => !h.id.startsWith('all:')).map((hit) => ({ section, hit })))
        .sort((a, b) => (b.hit.at ?? 0) - (a.hit.at ?? 0))
        .slice(0, 48)

  const items: ShellItem[] = entries.map(({ section, hit }) => {
    const { Thumb, Face } = presentOf(section.kind)
    return {
      key: `${section.kind}/${hit.id}`,
      title: showName(hit.title),
      subtitle: [section.label, hitDetail(hit), hit.tags?.length ? `#${hit.tags.join(' #')}` : ''].filter(Boolean).join(' · ') || undefined,
      excerpt: hit.excerpt,
      tag: section.label.toUpperCase(),
      icon: <KindIcon name={section.icon} className="h-4 w-4" />,
      thumb: Thumb ? <Thumb id={hit.id} large /> : undefined,
      face: Face ? <Face id={hit.id} /> : undefined,
      updatedAt: hit.at
    }
  })

  return (
    <KindShell
      id="pick-everything"
      layouts={['cards', 'deck', 'tiles', 'list']}
      filter={false}
      items={items}
      onOpen={(item) => {
        const slash = item.key.indexOf('/')
        if (slash > 0) onPick(item.key.slice(0, slash), item.key.slice(slash + 1))
      }}
      empty={query ? `Nothing matches "${query}".` : 'Nothing here yet. Pick a kind on the left to browse.'}
    />
  )
}

export function KindExplorer({ id, onPick, tabs = [] }: { id: string; onPick: (kind: string, id: string) => void; tabs?: ExplorerTab[] }) {
  const { sections } = useLibrary('', 0)
  const [current, setCurrent] = useViewPlace<string | null>(`${id}.kind`, null)
  const [closed, setClosed] = useViewPlace<string[]>(`${id}.closed`, [])
  const [query, setQuery] = useState('')
  const tab = tabs.find((t) => t.id === current)
  const shown = current ? (kindUi(current).showsAs ?? current) : null
  const section = sections?.find((s) => s.kind === shown) ?? null
  const Picker = (shown ? kindUi(shown).picker : undefined) ?? KindPicker
  const shut = new Set(closed)
  return (
    <div className="flex min-h-0 flex-1 gap-2">
      <aside className="panel-box flex w-56 shrink-0 flex-col">
        <div className="border-b border-line/40 p-2">
          <SearchBox
            value={query}
            onChange={(v) => {
              setQuery(v)
              if (v.trim() && current !== null) setCurrent(null)
            }}
            placeholder="Search everything · #tag"
          />
        </div>
        {tabs.length > 0 && (
          <div className="border-b border-line/40 py-1.5">
            {tabs.map((t) => (
              <ListRow key={t.id} active={current === t.id} onClick={() => setCurrent(t.id)} icon={t.icon} title={t.label} />
            ))}
          </div>
        )}
        <KindRail
          sections={sections ?? []}
          current={tab ? '' : current}
          closed={shut}
          onPick={(k) => {
            if (k !== null) setQuery('')
            setCurrent(k)
          }}
          onPickEntry={onPick}
          onToggle={(g) => setClosed(shut.has(g) ? closed.filter((x) => x !== g) : [...closed, g])}
        />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {tab ? (
          tab.node
        ) : section ? (
          <Picker key={section.kind} section={section} onPick={onPick} />
        ) : sections === null ? (
          <div className="font-ui text-[11px] text-dim">Loading…</div>
        ) : current === null ? (
          <EverythingPicker query={query.trim()} onPick={onPick} />
        ) : (
          <EmptyState title="Pick a kind">Choose what to add from the list on the left.</EmptyState>
        )}
      </div>
    </div>
  )
}
