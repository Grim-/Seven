import { ChevronRight, LayoutGrid, Star } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import { KindIcon } from '../../lib/library'
import { cn } from '../../lib/cn'
import { SETUP_GROUP, railGroups, railKind } from './groups'
import { entryMenuAt, kindMenuAt } from './entryMenu'
import { useFavourites } from '../../lib/favourites'
import { kindUi } from '../../registries/kinds'
import { ListRow } from '../../components/ui'
import { useRememberedLocation } from '../../lib/window'
import type { DataSelection } from '../../store/data'


export function KindRail({ sections, current: selected, closed, onPick, onPickEntry, onToggle }: { sections: LibrarySection[]; current: string | null; closed: Set<string>; onPick: (kind: string | null) => void; onPickEntry?: (kind: string, id: string) => void; onToggle: (group: string) => void }) {
  const current = railKind(selected)
  const [picked, select] = useRememberedLocation<DataSelection | null>(null)
  const favourites = useFavourites().filter((p) => p.id && !kindUi(p.kind).ownView)
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5">
      <ListRow active={selected === null} onClick={() => onPick(null)} icon={<LayoutGrid className="h-3.5 w-3.5" />} title="Everything" />
      {favourites.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-faint">
            <Star className="h-3 w-3" />
            Favourites
          </div>
          {favourites.map((p) => (
            <ListRow key={`${p.kind}/${p.id}`} active={picked?.kind === p.kind && picked.id === p.id} onClick={() => (onPickEntry ? onPickEntry(p.kind, p.id as string) : select({ kind: p.kind, id: p.id as string }))} onMenu={(e) => entryMenuAt(e, p.kind, p.id as string, p.label)} icon={<KindIcon name={p.icon} className="h-3.5 w-3.5" />} title={p.label} />
          ))}
        </div>
      )}
      {railGroups(sections).map((group) => {
        const shut = group.name === SETUP_GROUP ? !closed.has(`open:${group.name}`) : closed.has(group.name)
        const hasCurrent = group.sections.some((s) => s.kind === current)
        return (
          <div key={group.name} className="mt-2">
            <button onClick={() => onToggle(group.name === SETUP_GROUP ? `open:${group.name}` : group.name)} className="flex w-full items-center gap-1.5 px-2.5 py-1 text-left font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-faint hover:text-white">
              <ChevronRight className={cn('h-3 w-3 transition-transform', !shut && 'rotate-90')} />
              {group.name}
            </button>
            {(!shut || hasCurrent) &&
              group.sections
                .filter((s) => !shut || s.kind === current)
                .map((s) => <ListRow key={s.kind} active={s.kind === current} onClick={() => onPick(s.kind)} onMenu={(e) => kindMenuAt(e, s, select)} icon={<KindIcon name={s.icon} className="h-3.5 w-3.5" />} title={s.plural} meta={s.count} tooltip={s.description} />)}
          </div>
        )
      })}
    </nav>
  )
}
