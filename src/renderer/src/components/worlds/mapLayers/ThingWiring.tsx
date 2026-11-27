import { ArrowLeft, ArrowRight, Boxes, Cable, X } from 'lucide-react'
import type { ComponentDef } from '@shared/game/core'
import { emittedEvents } from '@shared/game/components'
import type { MapLink } from '@shared/maps'
import { Button, EmptyState } from '../../ui'
import { EntityPieces } from '../../game/EntityPieces'
import { LinkEventsProvider } from '../../game/linkEvents'
import type { InspectorTab } from '../../maps/InspectorShell'

interface Props {
  thing: string
  links: MapLink[]
  name: (key: string) => string
  piecesOf: (key: string) => ComponentDef[]
  comps: ComponentDef[]
  onComps: (next: ComponentDef[]) => void
  onStartLink: () => void
  onUnlink: (id: string) => void
}

function LinkRow({ dir, name, events, onUnlink }: { dir: 'out' | 'in'; name: string; events: string[]; onUnlink: () => void }) {
  const Arrow = dir === 'out' ? ArrowRight : ArrowLeft
  return (
    <div className="flex items-center gap-1.5 border border-line/40 tone-panel-40 px-2 py-1 text-[11.5px]">
      <Arrow className="h-3 w-3 shrink-0 text-accent" />
      <span className="min-w-0 flex-1 truncate text-ink">{name}</span>
      <span className="truncate font-data text-[10px] text-accent">{events.join(', ') || '—'}</span>
      <button type="button" onClick={onUnlink} title="Remove link" className="p-0.5 text-faint hover:text-alert">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

export function wiringTabs({ thing, links, name, piecesOf, comps, onComps, onStartLink, onUnlink }: Props): InspectorTab[] {
  const out = links.filter((l) => l.from === thing)
  const into = links.filter((l) => l.to === thing)
  const mine = emittedEvents(comps)
  const incoming = [...new Set(into.flatMap((l) => emittedEvents(piecesOf(l.from))))]
  return [
    {
      id: 'links',
      label: 'Links',
      icon: <Cable />,
      count: out.length + into.length || undefined,
      body: (
        <div className="flex flex-col gap-1.5">
          <Button size="sm" variant="secondary" icon={<Cable />} onClick={onStartLink} className="self-start">
            Link to…
          </Button>
          {out.map((l) => (
            <LinkRow key={l.id} dir="out" name={name(l.to)} events={mine} onUnlink={() => onUnlink(l.id)} />
          ))}
          {into.map((l) => (
            <LinkRow key={l.id} dir="in" name={name(l.from)} events={emittedEvents(piecesOf(l.from))} onUnlink={() => onUnlink(l.id)} />
          ))}
          {!out.length && !into.length && <EmptyState title="No links" />}
        </div>
      )
    },
    {
      id: 'pieces',
      label: 'Pieces',
      icon: <Boxes />,
      count: comps.length || undefined,
      body: (
        <LinkEventsProvider events={incoming}>
          <EntityPieces value={comps} onChange={onComps} />
        </LinkEventsProvider>
      )
    }
  ]
}
