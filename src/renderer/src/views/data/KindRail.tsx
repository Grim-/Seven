import { ChevronRight, LayoutGrid } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import { KindIcon } from '../../lib/library'
import { cn } from '../../lib/cn'
import { SETUP_GROUP, railGroups, railKind } from './groups'
import { kindMenuAt } from './entryMenu'
import { ListRow } from '../../components/ui'
import { useRememberedLocation } from '../../lib/window'
import type { DataSelection } from '../../store/data'


export function KindRail({ sections, current: selected, closed, onPick, onToggle }: { sections: LibrarySection[]; current: string | null; closed: Set<string>; onPick: (kind: string | null) => void; onToggle: (group: string) => void }) {
  const current = railKind(selected)
  const [, select] = useRememberedLocation<DataSelection | null>(null)
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5">
      <ListRow active={selected === null} onClick={() => onPick(null)} icon={<LayoutGrid className="h-3.5 w-3.5" />} title="Everything" />
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
