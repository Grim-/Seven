import { ChevronRight, History, LayoutGrid, Star } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { KindIcon } from '../../lib/library'
import { cn } from '../../lib/cn'
import { SETUP_GROUP, railGroups, railKind } from './groups'
import { entryMenuAt, kindMenuAt } from './entryMenu'
import { isFileFavouriteKind, useFavourites, whenFavouriteExists } from '../../lib/favourites'
import { ListRow } from '../../components/ui'
import { useRememberedLocation } from '../../lib/window'
import type { DataSelection } from '../../store/data'

export function KindRail({
  sections,
  current: selected,
  closed,
  onPick,
  onPickEntry,
  onToggle,
  overview = 'everything',
  onPickOverview,
  recentCount = 0
}: {
  sections: LibrarySection[]
  current: string | null
  closed: Set<string>
  onPick: (kind: string | null) => void
  onPickEntry?: (kind: string, id: string) => void
  onToggle: (group: string) => void
  overview?: 'everything' | 'recent'
  onPickOverview?: (mode: 'everything' | 'recent') => void
  recentCount?: number
}) {
  const current = railKind(selected)
  const [picked, select] = useRememberedLocation<DataSelection | null>(null)
  const menuSelect = (s: DataSelection | null) => {
    if (!s) return onPick(null)
    if (s.id === 'all') return onPick(s.kind)
    if (onPickEntry) return onPickEntry(s.kind, s.id)
    select(s)
  }
  const favourites = useFavourites().filter((p) => !isFileFavouriteKind(p.kind))
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5">
      <ListRow
        active={selected === null && overview === 'everything'}
        onClick={() => (onPickOverview ? onPickOverview('everything') : onPick(null))}
        icon={<LayoutGrid className="h-3.5 w-3.5" />}
        title="Everything"
      />
      {onPickOverview && (
        <ListRow
          active={selected === null && overview === 'recent'}
          onClick={() => onPickOverview('recent')}
          icon={<History className="h-3.5 w-3.5" />}
          title="Recent"
          meta={recentCount || undefined}
          tooltip="Last 10 entries opened"
        />
      )}
      {favourites.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 font-label text-[10px] font-bold caps-18 text-faint">
            <Star className="h-3 w-3" />
            Favourites
          </div>
          {favourites.map((p) => {
            if (!p.id) {
              const section = sections.find((s) => s.kind === p.kind)
              return (
                <ListRow
                  key={`${p.kind}/`}
                  active={current === p.kind && (!picked?.id || picked.id === 'all')}
                  onClick={() => whenFavouriteExists(p, () => onPick(p.kind))}
                  onMenu={section ? (e) => kindMenuAt(e, section, menuSelect) : undefined}
                  icon={<KindIcon name={p.icon} className="h-3.5 w-3.5" />}
                  title={showName(p.label)}
                  meta="kind"
                />
              )
            }
            const id = p.id
            return (
              <ListRow
                key={`${p.kind}/${id}`}
                active={picked?.kind === p.kind && picked.id === id}
                onClick={() => whenFavouriteExists(p, () => (onPickEntry ? onPickEntry(p.kind, id) : select({ kind: p.kind, id })))}
                onMenu={(e) => entryMenuAt(e, p.kind, id, p.label)}
                icon={<KindIcon name={p.icon} className="h-3.5 w-3.5" />}
                title={showName(p.label)}
              />
            )
          })}
        </div>
      )}
      {railGroups(sections).map((group) => {
        const shut = group.name === SETUP_GROUP ? !closed.has(`open:${group.name}`) : closed.has(group.name)
        const hasCurrent = group.sections.some((s) => s.kind === current)
        return (
          <div key={group.name} className="mt-2">
            <button onClick={() => onToggle(group.name === SETUP_GROUP ? `open:${group.name}` : group.name)} className="flex w-full items-center gap-1.5 px-2.5 py-1 text-left font-label text-[10px] font-bold caps-18 text-faint hover:text-ink">
              <ChevronRight className={cn('h-3 w-3 transition-transform', !shut && 'rotate-90')} />
              {group.name}
            </button>
            {(!shut || hasCurrent) &&
              group.sections
                .filter((s) => !shut || s.kind === current)
                .map((s) => <ListRow key={s.kind} active={s.kind === current} onClick={() => onPick(s.kind)} onMenu={(e) => kindMenuAt(e, s, menuSelect)} icon={<KindIcon name={s.icon} className="h-3.5 w-3.5" />} title={s.plural} meta={s.count} tooltip={s.description} />)}
          </div>
        )
      })}
    </nav>
  )
}
