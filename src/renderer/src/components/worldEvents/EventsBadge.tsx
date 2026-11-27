import { Flame, Plus } from 'lucide-react'
import { eventLink, type ResolvedWorldEvent } from '@shared/game/worldEvents'
import { cn } from '../../lib/cn'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { Eyebrow, Popover } from '../ui'
import { NEW_ENTRY } from '../decisions/StoredScreen'
import { EventRow } from './EventRow'
import { openMetaScene } from './useMetaScene'
import { isWaiting, useWorldEvents } from './useWorldEvents'

export function EventsBadge({ worldId, className }: { worldId: string; className?: string }) {
  const events = useWorldEvents(worldId)
  const active = events.filter(isWaiting)
  const resolved = events.filter((ev) => ev.status === 'resolved' || Boolean(ev.resolution))
  const dormant = events.filter((ev) => ev.status === 'dormant' && !ev.resolution)

  const openScene = (eventId: string) => {
    void openMetaScene(worldId, eventId).catch(failed('Could not open meta-narrative scene'))
  }
  const renderRow = (ev: ResolvedWorldEvent) => <EventRow key={ev.id} worldId={worldId} ev={ev} onTable={openScene} />

  return (
    <Popover
      align="end"
      trigger={
        <span
          className={cn(
            'inline-flex h-6 cursor-pointer items-center gap-1.5 border border-line/70 tone-well-80 px-2 font-label text-[10px] font-bold caps-5 hover:border-accent hover:text-ink',
            active.length ? 'border-accent/70 text-accent' : 'text-dim',
            className
          )}
        >
          <Flame className={cn('h-3 w-3', active.length > 0 && 'animate-pulse')} />
          <span>Events{active.length > 0 ? ` (${active.length})` : ''}</span>
        </span>
      }
      className="w-80 p-2 font-ui text-[11px]"
    >
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line/50 pb-1">
          <span className="text-[9.5px] font-bold caps-5 text-accent">World Events (Current Save)</span>
          <button
            type="button"
            title="New world event"
            onClick={() => openEntry('world', eventLink(worldId, NEW_ENTRY))}
            className="text-secondary-ink hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {events.length === 0 ? (
          <span className="py-2 text-center text-[10px] text-faint">No world events defined in this world.</span>
        ) : (
          <>
            {active.length > 0 && (
              <div className="flex flex-col gap-1">
                <Eyebrow className="text-accent">Active ({active.length})</Eyebrow>
                {active.map(renderRow)}
              </div>
            )}
            {resolved.length > 0 && (
              <div className="flex flex-col gap-1">
                <Eyebrow>Resolved ({resolved.length})</Eyebrow>
                {resolved.map(renderRow)}
              </div>
            )}
            {dormant.length > 0 && (
              <div className="flex flex-col gap-1">
                <Eyebrow>Dormant ({dormant.length})</Eyebrow>
                {dormant.map(renderRow)}
              </div>
            )}
          </>
        )}
      </div>
    </Popover>
  )
}
