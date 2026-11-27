import { useMemo, useState } from 'react'
import { BookOpen, Dices, Play } from 'lucide-react'
import { eventLink, eventPlace, type ResolvedWorldEvent } from '@shared/game/worldEvents'
import type { WorldMeta } from '@shared/world'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { entryMenuAt } from '../../views/data/entryMenu'
import { Chip, withReferences } from '../chat/References'
import { Button, EmptyState, Eyebrow, Popover, SearchBox, Segmented } from '../ui'
import { openMetaScene } from './useMetaScene'
import { isWaiting, useWorldEvents } from './useWorldEvents'

type EventFilter = 'active' | 'resolved' | 'dormant' | 'all'

export function WorldEventsPlayView({
  world,
  onSwitchToEditor
}: {
  world: WorldMeta
  onSwitchToEditor?: () => void
}) {
  const events = useWorldEvents(world.id)
  const [filter, setFilter] = useState<EventFilter>('active')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const active = events.filter(isWaiting).length
    const resolved = events.filter((e) => Boolean(e.resolution)).length
    const dormant = events.filter((e) => e.status === 'dormant' && !e.resolution).length
    return { active, resolved, dormant, all: events.length }
  }, [events])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events.filter((e) => {
      if (filter === 'active' && !isWaiting(e)) return false
      if (filter === 'resolved' && !e.resolution) return false
      if (filter === 'dormant' && (e.status !== 'dormant' || Boolean(e.resolution))) return false
      if (!q) return true
      return (
        e.title.toLowerCase().includes(q) ||
        e.premise.toLowerCase().includes(q) ||
        e.rumours.some((r) => r.text.toLowerCase().includes(q) || (r.headline ?? '').toLowerCase().includes(q)) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }, [events, filter, query])

  const activate = (ev: ResolvedWorldEvent) =>
    void engine('worldEvents.setStatus', { id: ev.id, worldId: world.id, status: 'active' })
      .then(() => toast.success('Event Active', `${ev.title} is now underway.`))
      .catch(failed('Could not start event'))

  const resolve = (ev: ResolvedWorldEvent, outcomeId: string | null) =>
    void engine('worldEvents.resolve', { id: ev.id, worldId: world.id, outcomeId })
      .then(() => toast.success('Event Resolved', ev.title))
      .catch(failed('Could not resolve event'))

  const openRoundTable = (ev: ResolvedWorldEvent) =>
    void openMetaScene(world.id, ev.id).catch(failed('Could not open round table'))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg font-ui select-none">
      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/50 tone-panel-50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'active', label: `Active (${counts.active})` },
              { value: 'resolved', label: `Resolved (${counts.resolved})` },
              { value: 'dormant', label: `Upcoming (${counts.dormant})` },
              { value: 'all', label: `All (${counts.all})` }
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder="Search events & rumours…" className="w-60" />
          {onSwitchToEditor && (
            <Button size="sm" variant="ghost" onClick={onSwitchToEditor}>
              Author Events
            </Button>
          )}
        </div>
      </div>

      {/* EVENT CARDS */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
        {events.length === 0 ? (
          <EmptyState title="No world events yet">
            Events track unfolding crises, faction skirmishes, and story turning points across {world.name}.
            {onSwitchToEditor && (
              <div className="mt-3 flex justify-center">
                <Button size="sm" variant="primary" onClick={onSwitchToEditor}>
                  Create Events in Editor
                </Button>
              </div>
            )}
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState title={`No ${filter === 'all' ? 'matching' : filter} events`}>
            {filter === 'active' && counts.dormant > 0
              ? `Nothing is active right now — ${counts.dormant} upcoming event${counts.dormant === 1 ? '' : 's'} can be started or triggered.`
              : 'Try switching filter or clearing your search.'}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {shown.map((ev) => {
              const waiting = isWaiting(ev)
              const resolved = Boolean(ev.resolution)
              const placeKey = eventPlace(ev)
              return (
                <article
                  key={ev.id}
                  onContextMenu={(e) => entryMenuAt(e, 'world', eventLink(world.id, ev.id), ev.title, [])}
                  className={cn(
                    'flex flex-col justify-between gap-3.5 border p-4 transition-colors',
                    waiting
                      ? 'border-accent/70 tone-panel-70'
                      : resolved
                        ? 'border-ok/40 tone-surface-50'
                        : 'border-line/50 tone-surface-40'
                  )}
                >
                  <div className="flex flex-col gap-2.5">
                    {/* TITLE + STATUS */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="text-[16px] font-bold leading-snug text-ink">{ev.title}</h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="border border-line/50 tone-well-50 px-1.5 py-px font-label text-[9.5px] caps-5 text-dim">
                            {ev.scope.level}
                          </span>
                          {placeKey && <Chip kind="world" refText={`${world.id}/place/${placeKey}`} />}
                          {ev.tags.map((tag) => (
                            <span key={tag} className="text-[10.5px] text-faint">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <span
                        className={cn(
                          'shrink-0 border px-2 py-0.5 font-label text-[9.5px] font-bold caps-8',
                          waiting
                            ? 'border-accent bg-accent/15 text-accent'
                            : resolved
                              ? 'border-ok/50 bg-ok/10 text-ok'
                              : 'border-line/60 tone-well-50 text-faint'
                        )}
                      >
                        {waiting ? 'Active' : resolved ? 'Resolved' : 'Dormant'}
                      </span>
                    </div>

                    {/* PREMISE */}
                    {ev.premise && (
                      <p className="font-body text-[13px] leading-relaxed text-ink/90">
                        {withReferences(ev.premise)}
                      </p>
                    )}

                    {/* RUMOURS */}
                    {ev.rumours.length > 0 && (
                      <div className="flex flex-col gap-1 border-l-2 border-accent/40 pl-3">
                        <Eyebrow>Rumours</Eyebrow>
                        {ev.rumours.slice(0, 3).map((r) => (
                          <p key={r.id} className="font-body text-[12px] italic text-dim">
                            {r.headline ? <strong className="not-italic text-ink">{r.headline}: </strong> : null}
                            “{withReferences(r.text)}”
                          </p>
                        ))}
                      </div>
                    )}

                    {/* PARTICIPANTS */}
                    {ev.participants.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="font-label text-[9.5px] caps-5 text-faint">Involved:</span>
                        {ev.participants.map((p) => {
                          const label = p.name || p.refId || p.kind
                          return (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 border border-line/45 tone-well-50 px-2 py-0.5 text-[11px] text-ink"
                            >
                              {p.kind === 'faction' && p.refId ? (
                                <Chip kind="world" refText={`${world.id}/faction/${p.refId}`} />
                              ) : p.kind === 'sheet' && p.refId ? (
                                <Chip kind="sheet" refText={p.refId} />
                              ) : (
                                <span>{label}</span>
                              )}
                              {p.role ? <span className="text-faint">({p.role})</span> : null}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* RESOLUTION BANNER */}
                    {ev.resolution && (
                      <div className="border border-ok/40 bg-ok/10 px-3 py-2">
                        <div className="font-label text-[10px] font-bold caps-8 text-ok">
                          Outcome · {ev.resolution.outcomeLabel}
                        </div>
                        {ev.resolution.transcriptSummary && (
                          <p className="mt-0.5 font-body text-[12px] text-ink/85">
                            {withReferences(ev.resolution.transcriptSummary)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* INTERACTIVE PLAY ACTIONS */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/35 pt-3">
                    <div className="text-[11px] text-faint">
                      {waiting && ev.outcomes.length > 0
                        ? `${ev.outcomes.length} possible outcome${ev.outcomes.length === 1 ? '' : 's'}`
                        : resolved
                          ? 'Recorded in world state'
                          : 'Waiting for trigger or manual start'}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {ev.status === 'dormant' && !resolved && ev.hasSave && (
                        <Button size="sm" variant="secondary" icon={<Play />} onClick={() => activate(ev)}>
                          Start Event
                        </Button>
                      )}

                      {ev.status !== 'dormant' && (
                        <Button
                          size="sm"
                          variant={waiting ? 'primary' : 'secondary'}
                          icon={<BookOpen />}
                          onClick={() => openRoundTable(ev)}
                        >
                          {waiting ? 'Play Scene' : 'Review Scene'}
                        </Button>
                      )}

                      {waiting && ev.hasSave && ev.outcomes.length > 0 && (
                        <Popover
                          align="end"
                          title={`Resolve · ${ev.title}`}
                          className="w-72 p-2.5"
                          trigger={
                            <Button size="sm" variant="secondary" icon={<Dices />}>
                              Resolve
                            </Button>
                          }
                        >
                          {(close) => (
                            <div className="flex flex-col gap-1.5">
                              <Button
                                size="sm"
                                variant="primary"
                                icon={<Dices />}
                                onClick={() => {
                                  resolve(ev, null)
                                  close()
                                }}
                              >
                                Let Fate Decide (Roll)
                              </Button>
                              <div className="my-1 border-t border-line/40" />
                              <span className="px-1 font-label text-[9.5px] caps-5 text-faint">
                                Or choose outcome directly
                              </span>
                              {ev.outcomes.map((o) => (
                                <button
                                  key={o.id}
                                  type="button"
                                  onClick={() => {
                                    resolve(ev, o.id)
                                    close()
                                  }}
                                  className="flex flex-col gap-0.5 border border-line/40 tone-well-50 px-2.5 py-1.5 text-left transition-colors hover:border-accent hover:text-ink cursor-pointer"
                                >
                                  <span className="text-[12px] font-semibold text-ink">{o.label}</span>
                                  {o.summary && <span className="line-clamp-2 text-[10.5px] text-dim">{o.summary}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </Popover>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
