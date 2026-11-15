import { hitDetail, type LibraryHit, type LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { Segmented } from '../../components/ui'
import { useEntryPreview } from '../../components/entries/entryPreview'
import { KindIcon } from '../../lib/library'
import { formatRelative } from '../../lib/format'
import { useRecentEntries, type RecentEntry } from '../../lib/recentData'
import type { DataSelection } from '../../store/data'
import { entryMenuAt, kindMenuAt, openEntryMenu } from './entryMenu'
import { openIn } from './KindList'

function HitRow({ section, hit, at, onOpen, onMenu }: { section: LibrarySection; hit: LibraryHit; at?: number; onOpen: () => void; onMenu: (e: React.MouseEvent) => void }) {
  const when = at ?? hit.at
  return (
    <button onClick={onOpen} onContextMenu={onMenu} className="flex items-center gap-3 border-b border-line/20 px-2 py-2 text-left hover:bg-white/[0.03]">
      <KindIcon name={section.icon} className="h-4 w-4 shrink-0 text-accent-soft" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] text-white">{showName(hit.title)}</span>
        {hitDetail(hit) && <span className="block truncate text-[11.5px] text-dim">{hitDetail(hit)}</span>}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{section.label}</span>
      {when !== undefined && <span className="w-16 shrink-0 text-right font-mono text-[10.5px] text-faint">{formatRelative(when)}</span>}
    </button>
  )
}

function RecentHitRow({ item, section, select }: { item: RecentEntry; section: LibrarySection; select: (s: DataSelection | null) => void }) {
  const known = section.entries.find((e) => e.id === item.id)
  const preview = useEntryPreview(known ? '' : `@${item.kind}:${item.id}`)
  if (preview && 'missing' in preview) return null
  const hit: LibraryHit = known ?? {
    kind: item.kind,
    id: item.id,
    title: preview ? preview.title : item.id,
    summary: preview?.line ?? ''
  }
  return (
    <HitRow
      section={section}
      hit={hit}
      at={item.at || undefined}
      onOpen={() => openIn(item.kind, item.id, select)}
      onMenu={(e) => entryMenuAt(e, item.kind, item.id, hit.title)}
    />
  )
}

export function Everything({
  sections,
  query,
  selected,
  select,
  mode = 'everything',
  onModeChange
}: {
  sections: LibrarySection[]
  query: string
  selected: DataSelection | null
  select: (s: DataSelection | null) => void
  mode?: 'everything' | 'recent'
  onModeChange?: (mode: 'everything' | 'recent') => void
}) {
  const opened = useRecentEntries()
  const ctx = (section: LibrarySection, hit: LibraryHit) => ({ open: () => openIn(section.kind, hit.id, select), select, selected })
  if (query) {
    const found = sections.filter((s) => s.entries.length)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {!found.length && <div className="text-[13px] text-faint">Nothing matches "{query}".</div>}
        {found.map((section) => (
          <section key={section.kind} className="flex flex-col">
            <button onClick={() => select({ kind: section.kind, id: 'all' })} onContextMenu={(e) => kindMenuAt(e, section, select)} className="mb-1 self-start font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent-soft hover:text-white">
              {section.plural}
            </button>
            {section.entries.map((hit) => (
              <HitRow key={hit.id} section={section} hit={hit} onOpen={ctx(section, hit).open} onMenu={(e) => openEntryMenu(e, section, hit, ctx(section, hit))} />
            ))}
          </section>
        ))}
      </div>
    )
  }

  const changed = sections
    .flatMap((section) => section.entries.filter((h) => h.at !== undefined && !h.id.startsWith('all:')).map((hit) => ({ section, hit })))
    .sort((a, b) => (b.hit.at ?? 0) - (a.hit.at ?? 0))
    .slice(0, 40)

  const recentItems = opened
    .map((item) => ({ item, section: sections.find((s) => s.kind === item.kind) }))
    .filter((x): x is { item: RecentEntry; section: LibrarySection } => Boolean(x.section))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent-soft">
          {mode === 'recent' ? 'Recently opened' : 'Recently changed'}
        </h2>
        {onModeChange && (
          <Segmented
            value={mode}
            options={[
              { value: 'everything', label: 'Recently changed' },
              { value: 'recent', label: opened.length ? `Recently opened (${opened.length})` : 'Recently opened' }
            ]}
            onChange={onModeChange}
          />
        )}
      </div>
      {mode === 'recent' ? (
        recentItems.length ? (
          recentItems.map(({ item, section }) => <RecentHitRow key={`${item.kind}/${item.id}`} item={item} section={section} select={select} />)
        ) : (
          <div className="text-[13px] text-faint">Nothing opened yet. Anything you open here appears in your last 10.</div>
        )
      ) : (
        <>
          {changed.map(({ section, hit }) => (
            <HitRow key={`${section.kind}/${hit.id}`} section={section} hit={hit} onOpen={ctx(section, hit).open} onMenu={(e) => openEntryMenu(e, section, hit, ctx(section, hit))} />
          ))}
          {!changed.length && <div className="text-[13px] text-faint">Nothing yet. Pick a kind on the left to start.</div>}
        </>
      )}
    </div>
  )
}
