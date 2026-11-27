import type { ReactNode } from 'react'
import type { MapData } from '@shared/maps'
import type { EntrySurfaceProps } from '../../registries/kinds'
import { EmptyState } from '../ui'
import { EntryCard, Loading } from '../entries/EntryCard'
import { MapCanvas } from './MapCanvas'
import { useMap } from './useMap'

function Loaded({ id, children }: { id: string; children: (map: MapData) => ReactNode }) {
  const map = useMap(id)
  if (map === null) return <Loading />
  if (!map) return <EmptyState title="Removed">This map no longer exists.</EmptyState>
  return <>{children(map)}</>
}

export function MapChat({ id }: EntrySurfaceProps) {
  return (
    <Loaded id={id}>
      {(map) => (
        <EntryCard title={map.name} tag="map" aside={<span className="font-ui text-[11px] text-faint">{map.size.w}×{map.size.h}</span>}>
          <MapCanvas map={map} still className="h-56 tone-panel-60" />
        </EntryCard>
      )}
    </Loaded>
  )
}

export function MapStage({ id }: EntrySurfaceProps) {
  return <Loaded id={id}>{(map) => <MapCanvas map={map} className="h-full min-h-[60vh] w-full" />}</Loaded>
}

export function MapWidget({ id }: EntrySurfaceProps) {
  return <Loaded id={id}>{(map) => <MapCanvas map={map} still className="h-full min-h-32 w-full" />}</Loaded>
}

export function MapThumb({ id }: { id: string; large?: boolean }) {
  return <Loaded id={id}>{(map) => <MapCanvas map={map} still className="pointer-events-none h-full w-full" />}</Loaded>
}
