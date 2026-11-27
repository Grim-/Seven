import { useState } from 'react'
import { Flame, Plus } from 'lucide-react'
import { blankWorldEvent, eventKey, eventLink, type WorldEvent } from '@shared/game/worldEvents'
import type { WorldMeta } from '@shared/world'
import { engine } from '../../lib/ipc'
import { cn } from '../../lib/cn'
import { entryMenuAt } from '../../views/data/entryMenu'
import { Button, Eyebrow } from '../ui'
import { NEW_ENTRY, StoredScreen } from '../decisions/StoredScreen'
import { WorldEventEditor, type EditableWorldEvent } from './WorldEventEditor'
import { useWorldEvents } from './useWorldEvents'

function startModeLabel(ev: WorldEvent): string {
  if (ev.startsActive) return 'Starts active'
  if (ev.trigger.at !== null || ev.trigger.flags.length > 0) return 'Triggered'
  return 'Manual'
}

export function WorldEventsTab({ world, initialKey }: { world: WorldMeta; initialKey?: string }) {
  const events = useWorldEvents(world.id)
  const [selected, setSelected] = useState<string | null>(initialKey === NEW_ENTRY ? NEW_ENTRY : initialKey ? eventLink(world.id, initialKey) : null)
  const editable = (e: WorldEvent): EditableWorldEvent => ({
    id: e.id ? eventLink(world.id, e.id) : '',
    worldId: e.worldId || world.id,
    title: e.title,
    name: e.title,
    premise: e.premise,
    scope: e.scope,
    ...(e.startsActive ? { startsActive: true } : {}),
    trigger: e.trigger,
    rumours: e.rumours,
    participants: e.participants,
    outcomes: e.outcomes,
    tags: e.tags,
    updatedAt: e.updatedAt
  })
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-line/40 bg-bg">
      <div className="flex w-64 shrink-0 flex-col border-r border-line/40 tone-sidebar-40 select-none">
        <div className="flex items-center justify-between border-b border-line/40 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-accent" />
            <Eyebrow>Events ({events.length})</Eyebrow>
          </div>
          <Button size="sm" variant="badge" icon={<Plus className="h-3 w-3" />} onClick={() => setSelected(NEW_ENTRY)}>
            New
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {events.map((e) => {
            const link = eventLink(world.id, e.id)
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelected(link)}
                onContextMenu={(ev) => entryMenuAt(ev, 'world', link, e.title, [])}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border-l-2 px-2.5 py-1.5 text-left text-[12px]',
                  selected === link ? 'border-l-accent bg-accent/10 font-semibold text-ink' : 'border-l-transparent text-dim hover:tone-card-50 hover:text-ink'
                )}
              >
                <span className="truncate">{e.title}</span>
                <span className={cn('shrink-0 font-ui text-[9px] caps', e.startsActive ? 'text-accent' : 'text-faint')}>
                  {startModeLabel(e)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <StoredScreen<EditableWorldEvent>
          kind="world"
          id={selected}
          select={(s) => setSelected(s?.id && s.id !== 'all' ? s.id : null)}
          what="world event"
          event="worldEvents.changed"
          get={(id) => engine('worldEvents.get', { id: eventKey(id), worldId: world.id }).then(editable)}
          save={(value, previousId) =>
            engine('worldEvents.save', {
              event: { ...value, id: eventKey(value.id), title: value.name, worldId: value.worldId || world.id },
              previousId: previousId ? eventKey(previousId) : null
            }).then(editable)
          }
          blank={() => editable(blankWorldEvent(world.id))}
          badge={(e) => `${startModeLabel(e).toUpperCase()} · ${e.scope.level.toUpperCase()}`}
          Editor={WorldEventEditor}
        />
      </div>
    </div>
  )
}
