import { useEffect, useState } from 'react'
import type { MapData } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { engine } from '../../../../lib/ipc'
import { useLive } from '../../../../lib/useLive'
import { BrowsePick, type BrowseOption } from '../../../ui'
import { useWorldScope } from '../../worldScope'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function useWorldMapData(worldId: string | null): MapData[] {
  const uses = useLive(
    () => (worldId ? engine('worlds.maps', { id: worldId }) : Promise.resolve([])),
    'worlds.changed',
    [worldId]
  ) ?? []
  const [maps, setMaps] = useState<MapData[]>([])
  const mapIdsKey = uses.map((u) => u.map).join(',')

  useEffect(() => {
    let live = true
    if (!uses.length) {
      setMaps([])
      return
    }
    void Promise.all(uses.map((u) => engine('maps.get', { id: u.map }).catch(() => null))).then((loaded) => {
      if (live) setMaps(loaded.filter((m): m is MapData => Boolean(m)))
    })
    return () => {
      live = false
    }
  }, [mapIdsKey])

  return maps
}

function PlaceText({ value }: TokenProps) {
  const worldId = useWorldScope()
  const raw = typeof value === 'string' ? value : ''
  const places =
    useLive(
      () => (worldId ? engine('worlds.records', { id: worldId, type: PLACE_TYPE_KEY }) : Promise.resolve({})),
      'worlds.changed',
      [worldId]
    ) ?? {}
  if (!raw) return <span className="text-dim">place</span>
  const key = raw.includes('/') ? (raw.split('/').pop() ?? raw) : raw
  const name = places[key]?.Name
  return <>{typeof name === 'string' && name.trim() ? name : key}</>
}

function PlaceEdit({ value, onChange }: TokenEditProps) {
  const worldId = useWorldScope()
  const places =
    useLive(
      () => (worldId ? engine('worlds.records', { id: worldId, type: PLACE_TYPE_KEY }) : Promise.resolve({})),
      'worlds.changed',
      [worldId]
    ) ?? {}
  const options: BrowseOption[] = Object.entries(places).map(([key, rec]) => {
    const rawName = (rec as { Name?: unknown } | null)?.Name
    return {
      value: key,
      label: typeof rawName === 'string' && rawName.trim() ? rawName : key,
      group: 'World Places'
    }
  })
  return (
    <BrowsePick
      value={typeof value === 'string' && value ? value : null}
      options={options}
      placeholder="Pick a place…"
      onChange={(v) => onChange(v ?? '')}
    />
  )
}

function FactionText({ value }: TokenProps) {
  const worldId = useWorldScope()
  const raw = typeof value === 'string' ? value : ''
  const factions =
    useLive(
      () => engine('factions.list', worldId ? { world: worldId } : undefined),
      'factions.changed',
      [worldId]
    ) ?? []
  if (!raw) return <span className="text-dim">faction</span>
  return <>{factions.find((f) => f.id === raw)?.name ?? raw}</>
}

function FactionEdit({ value, onChange }: TokenEditProps) {
  const worldId = useWorldScope()
  const factions =
    useLive(
      () => engine('factions.list', worldId ? { world: worldId } : undefined),
      'factions.changed',
      [worldId]
    ) ?? []
  const options: BrowseOption[] = factions.map((f) => ({
    value: f.id,
    label: f.name,
    group: 'Factions',
    note: f.defaultStance
  }))
  return (
    <BrowsePick
      value={typeof value === 'string' && value ? value : null}
      options={options}
      placeholder="Pick a faction…"
      onChange={(v) => onChange(v ?? '')}
    />
  )
}

function SpawnerText({ value }: TokenProps) {
  const worldId = useWorldScope()
  const maps = useWorldMapData(worldId)
  const raw = typeof value === 'string' ? value : ''
  if (!raw) return <span className="text-dim">spawner</span>
  const [mapId, id] = raw.includes(':') ? raw.split(':') : ['', raw]
  const map = maps.find((m) => !mapId || m.id === mapId)
  const sp = map?.spawners?.find((s) => s.id === id)
  return <>{sp ? `${sp.name || sp.id} (${map?.name ?? mapId})` : id}</>
}

function SpawnerEdit({ value, onChange }: TokenEditProps) {
  const worldId = useWorldScope()
  const maps = useWorldMapData(worldId)
  const options: BrowseOption[] = maps.flatMap((m) =>
    (m.spawners ?? []).map((s) => ({
      value: `${m.id}:${s.id}`,
      label: s.name || s.id,
      group: m.name,
      note: s.faction ? `faction: ${s.faction}` : undefined
    }))
  )
  return (
    <BrowsePick
      value={typeof value === 'string' && value ? value : null}
      options={options}
      placeholder="Pick a spawner…"
      onChange={(v) => onChange(v ?? '')}
    />
  )
}

function LayerText({ value }: TokenProps) {
  const worldId = useWorldScope()
  const maps = useWorldMapData(worldId)
  const raw = typeof value === 'string' ? value : ''
  if (!raw) return <span className="text-dim">layer</span>
  const [mapId, id] = raw.includes(':') ? raw.split(':') : ['', raw]
  const map = maps.find((m) => !mapId || m.id === mapId)
  const layer = map?.layers.find((l) => l.id === id)
  return <>{layer ? `${layer.name} (${map?.name ?? mapId})` : id}</>
}

function LayerEdit({ value, onChange }: TokenEditProps) {
  const worldId = useWorldScope()
  const maps = useWorldMapData(worldId)
  const options: BrowseOption[] = maps.flatMap((m) =>
    m.layers.map((l) => ({
      value: `${m.id}:${l.id}`,
      label: l.name,
      group: m.name,
      note: l.kind
    }))
  )
  return (
    <BrowsePick
      value={typeof value === 'string' && value ? value : null}
      options={options}
      placeholder="Pick a map layer…"
      onChange={(v) => onChange(v ?? '')}
    />
  )
}

registerEffectToken('worldPlace', { Text: PlaceText, Edit: PlaceEdit })
registerEffectToken('worldFaction', { Text: FactionText, Edit: FactionEdit })
registerEffectToken('worldSpawner', { Text: SpawnerText, Edit: SpawnerEdit })
registerEffectToken('mapLayer', { Text: LayerText, Edit: LayerEdit })
