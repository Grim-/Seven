import { useMemo, useState } from 'react'
import { MapPin, Plus } from 'lucide-react'
import { placeTree, type PlaceNode } from '@shared/maps'
import type { WorldMeta } from '@shared/world'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'
import { Button, EmptyState, Eyebrow, Select } from '../ui'
import { usePlaceRecords, useRegionRecords } from '../maps/usePlaceRecords'
import { PlaceEditor } from './PlaceEditor'
import { CreateZonePane } from './ZoneMapStage'

interface Props {
  world: WorldMeta
  initialKey?: string
  onOpenMap?: (mapId: string) => void
}

export function WorldPlaces({ world, initialKey, onOpenMap }: Props) {
  const places = usePlaceRecords(world.id)
  const regions = useRegionRecords(world.id)
  const mapUses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []
  const mapList = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const [selected, setSelected] = useState<string | null>(initialKey ?? null)
  const [creating, setCreating] = useState(false)
  const [regionFilter, setRegionFilter] = useState<string>('all')

  const shaped = useMemo(() => {
    const out: Record<string, never> = {}
    for (const u of mapUses) for (const k of Object.keys(u.shapes)) out[k] = undefined as never
    return out
  }, [mapUses])

  const filteredPlaces = useMemo(() => {
    if (regionFilter === 'all') return places
    if (regionFilter === 'none') {
      return Object.fromEntries(
        Object.entries(places).filter(([, p]) => {
          const r = typeof p.Region === 'string' ? p.Region : ''
          return !r || !(r in regions)
        })
      )
    }
    return Object.fromEntries(Object.entries(places).filter(([, p]) => p.Region === regionFilter))
  }, [places, regions, regionFilter])

  const tree = useMemo(() => placeTree(filteredPlaces, shaped), [filteredPlaces, shaped])
  const keys = Object.keys(places)
  const activeKey = selected && selected in places ? selected : (Object.keys(filteredPlaces)[0] ?? keys[0] ?? null)
  const active = activeKey ? places[activeKey] : null

  const mapNameOf = (id: string) => mapList.find((m) => m.id === id)?.name ?? id

  const renderTreeNodes = (nodes: PlaceNode[], depth = 0) =>
    nodes.map((n) => {
      const rKey = typeof places[n.key]?.Region === 'string' ? (places[n.key].Region as string) : ''
      const rName = rKey && regions[rKey] ? String(regions[rKey].Name || rKey) : ''
      return (
        <div key={n.key}>
          <button
            type="button"
            onClick={() => {
              setCreating(false)
              setSelected(n.key)
            }}
            style={{ paddingLeft: `${10 + depth * 14}px` }}
            className={cn(
              'flex w-full items-center justify-between gap-1.5 border-l-2 py-1.5 pr-2 text-left text-[12px] transition-colors',
              !creating && activeKey === n.key
                ? 'border-l-accent bg-accent/10 font-semibold text-ink'
                : 'border-l-transparent text-dim hover:tone-card-50 hover:text-ink'
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate">{n.name}</div>
              {rName && regionFilter === 'all' && <div className="truncate font-ui text-[9.5px] text-faint">{rName}</div>}
            </div>
            <span className={cn('shrink-0 font-ui text-[9px]', n.shaped ? 'text-secondary-ink' : 'text-warn')}>
              {n.shaped ? 'ZONE' : 'NO ZONE'}
            </span>
          </button>
          {n.children.length > 0 && renderTreeNodes(n.children, depth + 1)}
        </div>
      )
    })

  const filterOptions = [
    { value: 'all', label: `All regions (${keys.length})` },
    ...Object.entries(regions)
      .map(([k, r]) => ({ value: k, label: String(r.Name || k) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    { value: 'none', label: 'Unassigned' }
  ]

  const defaultRegionForCreate =
    regionFilter !== 'all' && regionFilter !== 'none'
      ? regionFilter
      : active && typeof active.Region === 'string'
        ? active.Region
        : ''

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-line/40 bg-bg">
      <div className="flex w-64 shrink-0 flex-col border-r border-line/40 tone-sidebar-40 select-none">
        <div className="flex flex-col gap-1.5 border-b border-line/40 px-2.5 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              <Eyebrow>Places ({keys.length})</Eyebrow>
            </div>
            <Button size="sm" variant="badge" icon={<Plus className="h-3 w-3" />} onClick={() => setCreating(true)}>
              New
            </Button>
          </div>
          {Object.keys(regions).length > 0 && (
            <Select value={regionFilter} options={filterOptions} onChange={setRegionFilter} className="h-6 text-[11px]" />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {!tree.length ? (
            <div className="p-3 text-[11.5px] text-faint">
              {!mapUses.length
                ? 'Attach a map to this world first, then create Places by drawing their zone on it.'
                : 'No places yet. Click New to draw a place zone and set its spawn point on the map.'}
            </div>
          ) : (
            renderTreeNodes(tree)
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {creating ? (
          <CreateZonePane
            world={world.id}
            kind="place"
            mapUses={mapUses}
            mapNameOf={mapNameOf}
            places={places}
            regions={regions}
            initialRegion={defaultRegionForCreate}
            onCreated={(key) => {
              setCreating(false)
              setSelected(key)
            }}
            onCancel={() => setCreating(false)}
          />
        ) : !activeKey || !active ? (
          <EmptyState title="Create a place on your map">
            Every Place requires a zone drawn on a map and defines the spawn point where characters placed there appear. Click New to draw one on the map.
          </EmptyState>
        ) : (
          <PlaceEditor
            key={activeKey}
            world={world.id}
            placeKey={activeKey}
            onOpenMap={onOpenMap}
            onDeleted={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}
