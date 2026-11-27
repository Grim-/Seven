import type { WebLogEntry } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { formatRelative } from '../../lib/format'
import { cn } from '../../lib/cn'
import { TextPart } from '../data/TextPart'
import { EntryCard, Lines, BigStat } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

const DAY = 24 * 60 * 60 * 1000
const ALLOWED: WebLogEntry['outcome'][] = ['allowed', 'auto']

function useRecent() {
  return useLibraryData(() => engine('weblog.list'), 'weblog') ?? []
}

function Row({ e }: { e: WebLogEntry }) {
  return (
    <>
      <span className="shrink-0 font-ui text-[10.5px] text-faint">{formatRelative(e.at)}</span>
      <span className="shrink-0 font-label text-[10px] caps text-secondary">{e.kind}</span>
      <span className="min-w-0 flex-1 truncate font-ui text-[11.5px]">{e.target}</span>
      <span className={cn('shrink-0 font-label text-[10px] caps', ALLOWED.includes(e.outcome) ? 'text-ok' : 'text-alert')}>{e.outcome}</span>
    </>
  )
}

export function WebLogChat({ id }: EntrySurfaceProps) {
  const recent = useRecent()
  return (
    <EntryCard title="Web log" tag="weblog">
      <TextPart entry={`weblog/${id}`} />
      {recent.length > 0 && <Lines items={recent.slice(0, 5).map((e, i) => <Row key={i} e={e} />)} />}
    </EntryCard>
  )
}

export function WebLogWidget() {
  const recent = useRecent()
  const today = recent.filter((e) => Date.now() - e.at < DAY)
  const allowed = today.filter((e) => ALLOWED.includes(e.outcome)).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-6">
        <BigStat value={allowed} label="allowed today" />
        <BigStat value={today.length - allowed} label="stopped" className="text-alert" />
      </div>
      {recent[0] && <span className="truncate font-ui text-[11px] text-dim">last: {recent[0].target}</span>}
    </div>
  )
}
