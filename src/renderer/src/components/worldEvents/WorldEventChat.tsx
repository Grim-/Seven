import { EVENT_SEGMENT, type ResolvedWorldEvent } from '@shared/game/worldEvents'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { EmptyState, StatusBadge } from '../ui'
import { EntryCard, Facts, Lines, Loading } from '../entries/EntryCard'
import { registerWorldPartUi, type WorldPartSurfaceProps } from '../worlds/worldPartUis'

function useWorldEventPreview(worldId: string, itemKey: string) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const events = useLive(
    () => engine('worldEvents.list', { worldId }),
    ['worldEvents.changed', 'saves.changed'],
    [worldId]
  )
  const world = worlds?.find((w) => w.id === worldId) ?? null
  const event = events?.find((e) => e.id === itemKey) ?? null
  return { ready: Boolean(worlds && events), world, event }
}

function statusBadge(ev: ResolvedWorldEvent) {
  if (ev.resolution) return <StatusBadge tone="ok">{ev.resolution.outcomeLabel}</StatusBadge>
  if (ev.status === 'active') return <StatusBadge tone="warn">Active</StatusBadge>
  return <StatusBadge tone="idle">Dormant</StatusBadge>
}

export function WorldEventChat({ worldId, itemKey }: WorldPartSurfaceProps) {
  const { ready, world, event } = useWorldEventPreview(worldId, itemKey)
  if (!ready) return <Loading />
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  if (!event) return <EmptyState title="Removed">This world event no longer exists.</EmptyState>

  const scopeText = event.scope.refId ? `${event.scope.level} (${event.scope.refId})` : event.scope.level
  const rows: [string, React.ReactNode][] = [
    ['World', world.name],
    ['Scope', scopeText],
    ...(event.resolution ? ([['Outcome', event.resolution.outcomeLabel]] as [string, React.ReactNode][]) : [])
  ]

  return (
    <EntryCard title={event.title} tag="event" aside={statusBadge(event)}>
      <Facts rows={rows} />
      {event.status === 'active' && event.rumours.length > 0 && (
        <Lines
          items={event.rumours.map((r) => (
            <span key={r.id} className="min-w-0">
              {r.headline && <b className="text-ink">{r.headline} · </b>}
              <span className="text-dim">{r.text}</span>
            </span>
          ))}
        />
      )}
    </EntryCard>
  )
}

export function WorldEventWidget({ worldId, itemKey }: WorldPartSurfaceProps) {
  const { ready, event } = useWorldEventPreview(worldId, itemKey)
  if (!ready) return <Loading />
  if (!event) return <EmptyState title="Removed">This world event no longer exists.</EmptyState>
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-ui text-[12px] font-semibold text-ink">{event.title}</span>
        {statusBadge(event)}
      </div>
      {event.status === 'active' && event.rumours[0] && (
        <span className="font-ui text-[11.5px] text-dim">{event.rumours[0].text}</span>
      )}
    </div>
  )
}

registerWorldPartUi(EVENT_SEGMENT, { Chat: WorldEventChat, Widget: WorldEventWidget })
