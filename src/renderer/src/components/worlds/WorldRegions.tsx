import { useMemo, useState } from 'react'
import { Layers, MapPin, Plus, Trash2 } from 'lucide-react'
import { regionPath, regionTree, type PlaceNode } from '@shared/maps'
import type { ShapeForm } from '@shared/shapes'
import { REGION_TYPE_KEY, type WorldEntity, type WorldMeta } from '@shared/world'
import { engine } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'
import { Button, EmptyState, Eyebrow, Field, Input, Select, confirmDelete } from '../ui'
import { LinkTextarea } from '../data/LinkTextarea'
import { usePlaceRecords, useRegionRecords } from '../maps/usePlaceRecords'
import { CreateZonePane, ZoneMapCanvas } from './ZoneMapStage'

interface Props {
  world: WorldMeta
  initialKey?: string
  onOpenMap?: (mapId: string) => void
}

export function WorldRegions({ world, initialKey }: Props) {
  const regions = useRegionRecords(world.id)
  const places = usePlaceRecords(world.id)
  const mapUses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []
  const mapList = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const [selected, setSelected] = useState<string | null>(initialKey ?? null)
  const [creating, setCreating] = useState<{ kind: 'region'; parent: string } | { kind: 'place'; region: string } | null>(null)
  const [targetMapId, setTargetMapId] = useState('')

  const shapedRegions = useMemo(() => {
    const out: Record<string, ShapeForm> = {}
    for (const u of mapUses) {
      for (const [k, f] of Object.entries(u.regionShapes ?? {})) out[k] = f
    }
    return out
  }, [mapUses])

  const tree = useMemo(() => regionTree(regions, shapedRegions), [regions, shapedRegions])
  const keys = Object.keys(regions)
  const activeKey = selected && selected in regions ? selected : (keys[0] ?? null)
  const active = activeKey ? regions[activeKey] : null

  const mapNameOf = (id: string) => mapList.find((m) => m.id === id)?.name ?? id

  const updateRegion = (key: string, patch: WorldEntity) => {
    void engine('worlds.put', { id: world.id, type: REGION_TYPE_KEY, key, entity: patch }).catch(failed('Could not save region'))
  }

  const handleDeleteRegion = (key: string) => {
    const label = String(regions[key]?.Name || key)
    confirmDelete(
      `Delete region "${label}"?`,
      'Subregions and places inside it will move up to its parent region (or become unassigned), and its region zone will be removed from maps.',
      () => engine('worlds.remove', { id: world.id, type: REGION_TYPE_KEY, key }).then(() => setSelected(null))
    )
  }

  const renderNodes = (nodes: PlaceNode[], depth = 0) =>
    nodes.map((n) => (
      <div key={n.key}>
        <button
          type="button"
          onClick={() => {
            setCreating(null)
            setSelected(n.key)
          }}
          style={{ paddingLeft: `${10 + depth * 14}px` }}
          className={cn(
            'flex w-full items-center justify-between border-l-2 py-1.5 pr-2 text-left text-[12px] transition-colors',
            !creating && activeKey === n.key
              ? 'border-l-accent bg-accent/10 font-semibold text-ink'
              : 'border-l-transparent text-dim hover:tone-card-50 hover:text-ink'
          )}
        >
          <span className="truncate">{n.name}</span>
          <span className={cn('font-ui text-[9px]', n.shaped ? 'text-secondary-ink' : 'text-warn')}>
            {n.shaped ? 'ZONE' : 'NO ZONE'}
          </span>
        </button>
        {n.children.length > 0 && renderNodes(n.children, depth + 1)}
      </div>
    ))

  const activeMapUse = activeKey
    ? (mapUses.find((u) => Boolean(u.regionShapes?.[activeKey])) ??
      mapUses.find((u) => u.map === targetMapId) ??
      mapUses[0] ??
      null)
    : null
  const activeRegionForm = activeKey && activeMapUse ? (activeMapUse.regionShapes?.[activeKey] ?? null) : null
  const regionPlaces = activeKey
    ? Object.entries(places)
        .filter(([, p]) => p.Region === activeKey)
        .sort((a, b) => String(a[1].Name || a[0]).localeCompare(String(b[1].Name || b[0])))
    : []
  const parentOptions = [
    { value: '', label: '— Top-level region —' },
    ...keys
      .filter((k) => k !== activeKey)
      .map((k) => ({
        value: k,
        label: regionPath(regions, k)
          .map((rk) => String(regions[rk]?.Name || rk))
          .join(' › ')
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ]

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-line/40 bg-bg">
      <div className="flex w-64 shrink-0 flex-col border-r border-line/40 tone-sidebar-40 select-none">
        <div className="flex items-center justify-between border-b border-line/40 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-accent" />
            <Eyebrow>Regions ({keys.length})</Eyebrow>
          </div>
          <Button size="sm" variant="badge" icon={<Plus className="h-3 w-3" />} onClick={() => setCreating({ kind: 'region', parent: '' })}>
            New
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {!keys.length ? (
            <div className="p-3 text-[11.5px] text-faint">No regions yet. Click New to draw a region zone on your map.</div>
          ) : (
            renderNodes(tree)
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {creating ? (
          creating.kind === 'region' ? (
            <CreateZonePane
              world={world.id}
              kind="region"
              mapUses={mapUses}
              mapNameOf={mapNameOf}
              places={places}
              regions={regions}
              initialParent={creating.parent}
              onCreated={(key) => {
                setCreating(null)
                setSelected(key)
              }}
              onCancel={() => setCreating(null)}
            />
          ) : (
            <CreateZonePane
              world={world.id}
              kind="place"
              mapUses={mapUses}
              mapNameOf={mapNameOf}
              places={places}
              regions={regions}
              initialRegion={creating.region}
              onCreated={(key) => {
                setCreating(null)
                openEntry('world', `${world.id}/place/${key}`)
              }}
              onCancel={() => setCreating(null)}
            />
          )
        ) : !activeKey || !active ? (
          <EmptyState title="Create a region on your map">
            Regions logically split a map into areas and hold the Places nested inside them. Click New to name a region and draw its zone directly on the map.
          </EmptyState>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            <div className="flex items-start justify-between gap-3 border-b border-line/50 pb-3">
              <div>
                <div className="font-ui text-[10.5px] text-dim">
                  {regionPath(regions, activeKey)
                    .map((k) => String(regions[k]?.Name || k))
                    .join(' › ')}{' '}
                  · <span className="text-secondary-ink">@world:{world.id}/region/{activeKey}</span>
                </div>
                <h2 className="mt-0.5 text-[17px] font-semibold text-ink">{String(active.Name || activeKey)}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating({ kind: 'region', parent: activeKey })}>
                  New Subregion
                </Button>
                <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => handleDeleteRegion(activeKey)}>
                  Delete
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Name">
                <Input value={String(active.Name ?? '')} onChange={(e) => updateRegion(activeKey, { Name: e.target.value })} />
              </Field>
              <Field label="Inside (Parent Region)">
                <Select
                  value={typeof active.Parent === 'string' ? active.Parent : ''}
                  options={parentOptions}
                  onChange={(v) => updateRegion(activeKey, { Parent: v || null })}
                />
              </Field>
              {mapUses.length > 1 && activeMapUse && (
                <Field label="Map">
                  <Select
                    value={activeMapUse.map}
                    options={mapUses.map((u) => ({ value: u.map, label: mapNameOf(u.map) }))}
                    onChange={setTargetMapId}
                  />
                </Field>
              )}
            </div>

            {activeMapUse ? (
              <ZoneMapCanvas
                world={world.id}
                use={activeMapUse}
                places={places}
                regions={regions}
                targetKind="region"
                targetKey={activeKey}
                targetLabel={`Region · ${String(active.Name || activeKey)}`}
                form={activeRegionForm}
                onFormChange={(nextForm) => {
                  void engine('worlds.saveMapUse', {
                    id: world.id,
                    use: { ...activeMapUse, regionShapes: { ...(activeMapUse.regionShapes ?? {}), [activeKey]: nextForm } }
                  }).catch(failed('Could not save region zone'))
                }}
              />
            ) : (
              <EmptyState title="Attach a map first">Attach a map to this world to draw this region&apos;s zone.</EmptyState>
            )}

            <Field label="Summary">
              <LinkTextarea
                rolls={false}
                rows={3}
                value={String(active.Summary ?? '')}
                onValue={(v) => updateRegion(activeKey, { Summary: v })}
                placeholder="Describe this region or area, its atmosphere, factions, or boundaries…"
              />
            </Field>

            <div className="flex flex-col gap-2 border border-line/50 tone-surface-60 p-3">
              <div className="flex items-center justify-between">
                <Eyebrow>Places in this region ({regionPlaces.length})</Eyebrow>
                <Button size="sm" variant="secondary" icon={<Plus className="h-3 w-3" />} onClick={() => setCreating({ kind: 'place', region: activeKey })}>
                  New Place here
                </Button>
              </div>
              {regionPlaces.length === 0 ? (
                <div className="text-[12px] text-faint">No places in this region yet. Click &ldquo;New Place here&rdquo; to draw a place zone inside this region.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {regionPlaces.map(([pKey, p]) => {
                    const pUse = mapUses.find((u) => Boolean(u.shapes[pKey])) ?? null
                    const pSpawn = pUse?.spawns?.[pKey] ?? null
                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => openEntry('world', `${world.id}/place/${pKey}`)}
                        className="flex items-center justify-between gap-2 border border-line/40 tone-well-50 px-2.5 py-1.5 text-left text-[12px] hover:border-accent"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-ink">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
                          <span className="truncate">{String(p.Name || pKey)}</span>
                        </span>
                        <span className="shrink-0 font-ui text-[10.5px] text-dim">
                          {pUse ? `${mapNameOf(pUse.map)}${pSpawn ? ` · Spawn (${pSpawn.x}, ${pSpawn.y})` : ''}` : 'No zone'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
