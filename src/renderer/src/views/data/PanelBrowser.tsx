import { useEffect, useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { hitDetail, type LibraryHit, type LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { BackBar, SearchBox, ListRow } from '../../components/ui'
import { useData, type DataSelection } from '../../store/data'
import { engine } from '../../lib/ipc'
import { formatRelative } from '../../lib/format'
import { KindIcon, useLibrary } from '../../lib/library'
import { kindUi, presentOf } from '../../registries/kinds'
import { useApp } from '../../store/app'
import { KindPane } from './KindPane'
import { openEntryMenu } from './entryMenu'
import { openIn } from './KindList'

function isCurrent(current: DataSelection | null, kind: string, id: string): boolean {
  return Boolean(current && current.id === id && (current.kind === kind || kindUi(current.kind) === kindUi(kind)))
}

function KindSection({
  section,
  query,
  open,
  onToggle,
  current,
  onPick,
  onOpenAll,
  onAdd,
  onMenu,
  onHeaderMenu
}: {
  section: LibrarySection
  query: string
  open: boolean
  onToggle: () => void
  current: DataSelection | null
  onPick: (id: string) => void
  onOpenAll?: () => void
  onAdd?: () => void
  onMenu?: (e: React.MouseEvent, hit: LibraryHit) => void
  onHeaderMenu?: (e: React.MouseEvent) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [all, setAll] = useState<LibraryHit[] | null>(null)
  useEffect(() => {
    if (!expanded) return setAll(null)
    let live = true
    void engine('library.find', { query, kind: section.kind })
      .then((hits) => live && setAll(hits.filter((h) => h.kind === section.kind).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [expanded, section, query])
  const entries = all ?? section.entries
  const ui = kindUi(section.kind)
  const { Thumb } = presentOf(section.kind)
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b border-line/50 py-1.5">
        <button onClick={onToggle} title={open ? 'Collapse' : 'Expand'} className="p-0.5 text-accent-soft hover:text-white">
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        <button
          onClick={onOpenAll ?? onToggle}
          onContextMenu={onHeaderMenu}
          title={section.description}
          className={`flex flex-1 items-center gap-1.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.16em] hover:text-white ${current?.kind === section.kind && current.id === 'all' ? 'text-white' : 'text-accent-soft'}`}
        >
          <KindIcon name={section.icon} className="h-3.5 w-3.5" />
          {section.plural}
          <span className="font-normal text-faint">{section.count}</span>
        </button>
        {onAdd && (
          <button title={ui.addLabel ?? `New ${section.label.toLowerCase()}`} onClick={onAdd} className="p-1 text-dim hover:text-accent">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-col py-1">
          {entries.length === 0 && <div className="px-2 py-1.5 text-[12px] text-faint">None yet.</div>}
          {entries.map((e) => {
            const selected = isCurrent(current, section.kind, e.id)
            const meta = [e.tags?.length ? e.tags.map((t) => `#${t}`).join(' ') : '', hitDetail(e), ui.timed && e.at ? formatRelative(e.at) : ''].filter(Boolean).join(' · ') || (e.at ? formatRelative(e.at) : '')
            return (
              <ListRow key={e.id} active={selected} onClick={() => onPick(e.id)} onMenu={onMenu ? (ev) => onMenu(ev, e) : undefined} icon={Thumb ? <Thumb id={e.id} /> : undefined} title={showName(e.title)} subtitle={meta || undefined} />
            )
          })}
          {!expanded && section.count > entries.length && (
            <button onClick={() => setExpanded(true)} className="px-2 py-1 text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim hover:text-accent">
              Show all {section.count}
            </button>
          )}
          {expanded && (
            <button onClick={() => setExpanded(false)} className="px-2 py-1 text-left font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim hover:text-accent">
              Show fewer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function PanelBrowser({ selected, select }: { selected: DataSelection | null; select: (s: DataSelection | null) => void }) {
  useEffect(() => {
    void useData.getState().refresh().catch(() => undefined)
  }, [])
  const listPrefs = useApp((s) => s.settings?.dataList) ?? { open: true, width: 288 }
  const updateSettings = useApp((s) => s.updateSettings)
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  const { sections } = useLibrary(q, q ? 20 : 6)
  const closed = new Set(listPrefs.closed ?? [])
  const toggle = (kind: string) => void updateSettings({ dataList: { ...listPrefs, closed: closed.has(kind) ? [...closed].filter((k) => k !== kind) : [...closed, kind] } })
  const section = sections?.find((x) => x.kind === selected?.kind)
  if (selected && section)
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2.5">
        <BackBar onBack={() => select(null)} kind={section.plural} />
        <div className="flex min-h-0 flex-1 flex-col">
          <KindPane section={section} selected={selected} select={select} />
        </div>
      </div>
    )
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2.5">
      <SearchBox value={query} onChange={setQuery} />
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {sections === null && <div className="px-2 py-1.5 font-mono text-[11px] text-dim">Loading…</div>}
        {sections?.map((sec) => (
          <KindSection
            key={sec.kind}
            section={sec}
            query={q}
            open={Boolean(q) || !closed.has(sec.kind)}
            onToggle={() => toggle(sec.kind)}
            current={selected}
            onPick={(id) => openIn(sec.kind, id, select)}
            onOpenAll={() => select({ kind: sec.kind, id: 'all' })}
            onAdd={kindUi(sec.kind).add?.(sec.kind, select)}
            onMenu={(e, h) => openEntryMenu(e, sec, h, { open: () => openIn(sec.kind, h.id, select), select, selected })}
          />
        ))}
        {q && sections?.length === 0 && <div className="px-2 py-1.5 text-[12px] text-faint">Nothing matches "{q}".</div>}
      </div>
    </div>
  )
}
