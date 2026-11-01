import { placePath, placeRef } from '@shared/maps'
import { Markdown } from '../chat/Markdown'
import type { EntrySurfaceProps } from '../../registries/kinds'
import { EmptyState } from '../ui'
import { EntryCard, Loading } from '../entries/EntryCard'
import { LinkFaceList } from '../entries/LinkFaces'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'
import { MapCanvas } from './MapCanvas'
import { placeName } from './placeShapes'
import { usePlaceRecords } from './usePlaceRecords'
import { usePresence } from './usePresence'
import { PresenceMarkers } from './PresenceMarkers'

function PlaceBody({ id, large }: { id: string; large: boolean }) {
  const { world, key } = placeRef(id)
  const places = usePlaceRecords(world)
  const found = useLive(() => engine('maps.withPlace', { world, place: key }), 'worlds.changed')
  const here = usePresence(world)
  const place = places[key]
  if (!place) return <Loading />
  const now = typeof place.Now === 'string' ? place.Now : ''
  const files = typeof place.Files === 'string' ? place.Files : ''
  return (
    <div className={cn('grid gap-3', found && (large ? 'grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-[150px_minmax(0,1fr)]'))}>
      {found && <MapCanvas map={found.map} shapes={found.use.shapes} places={places} here={here} still={!large} selected={key} className={cn('notch-sm bg-black/60', large ? 'h-[60vh]' : 'h-32')} />}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="font-mono text-[11px] text-dim">{placePath(places, key).map((k) => placeName(places, k)).join(' › ')}</div>
        {now ? <Markdown text={now} className="border border-cyan/25 bg-cyan/[0.04] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-white/90" /> : <div className="text-[12px] text-faint">Nothing is happening here.</div>}
        {here[key]?.length ? (
          <span className="flex gap-1.5">
            <PresenceMarkers visitors={here[key]} />
          </span>
        ) : null}
        <LinkFaceList text={files} />
      </div>
    </div>
  )
}

export function PlaceChat({ id }: EntrySurfaceProps) {
  const { world, key } = placeRef(id)
  const places = usePlaceRecords(world)
  if (!places[key]) return <EmptyState title="Removed">This place no longer exists.</EmptyState>
  return (
    <EntryCard title={placeName(places, key)} tag="place">
      <PlaceBody id={id} large={false} />
    </EntryCard>
  )
}

export function PlaceStage({ id }: EntrySurfaceProps) {
  return <PlaceBody id={id} large />
}

export function PlaceWidget({ id }: EntrySurfaceProps) {
  return <PlaceBody id={id} large={false} />
}
