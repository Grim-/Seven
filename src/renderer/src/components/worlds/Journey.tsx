import { ScrollText } from 'lucide-react'
import type { JourneyEntry, JourneyKind } from '@shared/maps'
import { Button } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { formatRelative } from '../../lib/format'
import { cn } from '../../lib/cn'
import { showPlay } from '../play/playStore'

const TONE: Record<JourneyKind, string> = { moved: 'text-secondary-ink border-secondary-ink/35', action: 'text-accent border-accent/40', decision: 'text-tint-purple border-tint-purple/45' }
const LABEL: Record<JourneyKind, string> = { moved: 'Went', action: 'Action', decision: 'Decision' }

function JourneyList({ entries }: { entries: JourneyEntry[] }) {
  return (
    <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
      {[...entries].reverse().map((e, i) => (
        <div key={i} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-line/30 pb-1.5">
          <span className={cn('border px-1 text-center font-label text-[9.5px] caps-12 ', TONE[e.kind])}>{LABEL[e.kind]}</span>
          <span className="text-[12.5px] text-ink/90">{e.text}</span>
          <span className="font-ui text-[10px] text-faint">{formatRelative(Date.parse(e.at))}</span>
        </div>
      ))}
      {!entries.length && <span className="text-[12px] text-faint">Nothing yet. Moves, actions and decisions in this world show here.</span>}
    </div>
  )
}

export function JourneyStrip({ world, sheet }: { world: string; sheet: string }) {
  const entries = useLive(() => engine('worlds.journey', { id: world, sheet }), 'worlds.changed') ?? []
  const recent = entries.slice(-8)
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button size="sm" variant="ghost" icon={<ScrollText />} onClick={() => showPlay('Journey', <JourneyList entries={entries} />)}>
        Journey
      </Button>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto font-ui text-[10.5px]">
        {recent.map((e, i) => (
          <span key={i} title={e.text} className={cn('max-w-56 shrink-0 truncate border px-1.5 py-0.5', TONE[e.kind])}>
            {e.text}
          </span>
        ))}
      </div>
    </div>
  )
}
