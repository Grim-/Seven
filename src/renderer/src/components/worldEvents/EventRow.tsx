import { BookOpen, Dices, Play } from 'lucide-react'
import { eventLink, type ResolvedWorldEvent } from '@shared/game/worldEvents'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { openEntry } from '../../lib/library'
import { entryMenuAt } from '../../views/data/entryMenu'
import { isWaiting } from './useWorldEvents'

export function EventRow({ worldId, ev, onTable }: { worldId: string; ev: ResolvedWorldEvent; onTable: (id: string) => void }) {
  const activate = () => void engine('worldEvents.setStatus', { id: ev.id, worldId, status: 'active' }).catch(failed('Could not start the event'))
  const resolve = () => void engine('worldEvents.resolve', { id: ev.id, worldId, outcomeId: null }).catch(failed('Could not resolve the event'))
  return (
    <div
      onContextMenu={(e) => entryMenuAt(e, 'world', eventLink(worldId, ev.id), ev.title, [])}
      className={cn('flex items-center gap-1.5 border px-2 py-1.5', isWaiting(ev) ? 'border-accent/60 bg-accent/5' : 'border-line/40 tone-well-60')}
    >
      <button type="button" onClick={() => openEntry('world', eventLink(worldId, ev.id))} className="min-w-0 flex-1 truncate text-left text-ink hover:text-accent" title="Open the event">
        {ev.title}
      </button>
      {ev.resolution && <span className="max-w-28 shrink-0 truncate text-[9px] caps text-ok">{ev.resolution.outcomeLabel}</span>}
      {ev.status === 'dormant' && ev.hasSave && (
        <button type="button" title="Start this event now in the current save" onClick={activate} className="text-secondary-ink hover:text-accent">
          <Play className="h-3.5 w-3.5" />
        </button>
      )}
      {ev.status !== 'dormant' && (
        <button type="button" title="Play it out at the round table" onClick={() => onTable(ev.id)} className="text-secondary-ink hover:text-accent">
          <BookOpen className="h-3.5 w-3.5" />
        </button>
      )}
      {isWaiting(ev) && ev.hasSave && ev.outcomes.length > 0 && (
        <button type="button" title="Resolve now (let fate decide)" onClick={resolve} className="text-secondary-ink hover:text-accent">
          <Dices className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
