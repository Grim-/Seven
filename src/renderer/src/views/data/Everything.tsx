import { hitDetail, type LibraryHit, type LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { KindIcon } from '../../lib/library'
import { formatRelative } from '../../lib/format'
import type { DataSelection } from '../../store/data'
import { kindMenuAt, openEntryMenu } from './entryMenu'
import { openIn } from './KindList'

function HitRow({ section, hit, onOpen, onMenu }: { section: LibrarySection; hit: LibraryHit; onOpen: () => void; onMenu: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onOpen} onContextMenu={onMenu} className="flex items-center gap-3 border-b border-line/20 px-2 py-2 text-left hover:bg-white/[0.03]">
      <KindIcon name={section.icon} className="h-4 w-4 shrink-0 text-accent-soft" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] text-white">{showName(hit.title)}</span>
        {hitDetail(hit) && <span className="block truncate text-[11.5px] text-dim">{hitDetail(hit)}</span>}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{section.label}</span>
      {hit.at !== undefined && <span className="w-16 shrink-0 text-right font-mono text-[10.5px] text-faint">{formatRelative(hit.at)}</span>}
    </button>
  )
}

export function Everything({ sections, query, selected, select }: { sections: LibrarySection[]; query: string; selected: DataSelection | null; select: (s: DataSelection | null) => void }) {
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
  const recent = sections
    .flatMap((section) => section.entries.filter((h) => h.at !== undefined && !h.id.startsWith('all:')).map((hit) => ({ section, hit })))
    .sort((a, b) => (b.hit.at ?? 0) - (a.hit.at ?? 0))
    .slice(0, 40)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <h2 className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent-soft">Recently changed</h2>
      {recent.map(({ section, hit }) => (
        <HitRow key={`${section.kind}/${hit.id}`} section={section} hit={hit} onOpen={ctx(section, hit).open} onMenu={(e) => openEntryMenu(e, section, hit, ctx(section, hit))} />
      ))}
      {!recent.length && <div className="text-[13px] text-faint">Nothing yet. Pick a kind on the left to start.</div>}
    </div>
  )
}
