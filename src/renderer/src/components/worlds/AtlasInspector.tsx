import { useState, type MouseEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowRightLeft,
  Crosshair,
  Eye,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  PenLine,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  X
} from 'lucide-react'
import { localPlaceMermaid, placePath, regionPath, type PlaceVisitor, type WorldMapUse } from '@shared/maps'
import { shapeBounds, type Point, type ShapeForm } from '@shared/shapes'
import { showName } from '@shared/ids'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY, type WorldEntity, type WorldEntry } from '@shared/world'
import { actorEntry, npcActorId, type WorldNpc } from '@shared/worldNpcs'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { entryMenuAt } from '../../views/data/entryMenu'
import {
  Button,
  EmptyState,
  Eyebrow,
  Field,
  InlineNumber,
  InlineTitle,
  NavArrows,
  Popover,
  ShellTabs,
  StatusBadge,
  confirmDelete,
  openMenu,
  type ShellTab
} from '../ui'
import { Chip } from '../chat/References'
import { CopyLinkButton } from '../data/CopyLinkButton'
import { LinkInlineEdit } from '../data/LinkInlineEdit'
import { LinkTextarea } from '../data/LinkTextarea'
import { LinkFaceList } from '../entries/LinkFaces'
import { EntryPicker } from '../library/EntryPicker'
import { CharacterRow } from '../maps/CharacterRow'
import { ObjectPlayManager } from '../maps/ObjectPlayManager'
import { characterItems, setWhere } from '../maps/placeActions'
import { placeName } from '../maps/placeShapes'
import { PlayList } from '../play/PlayList'
import { placePlay } from '../play/playHolder'
import { PlaceEvents } from '../worldEvents/PlaceEvents'
import { CreateOrBringCastModal } from './cast/CreateOrBringCastModal'
import { WorldPlacePick } from './WorldPlacePick'
import { WorldRegionPick } from './WorldRegionPick'
import { openCopyToWorld } from './CopyToWorldModal'

function PlaceHereSection({
  world,
  placeKey,
  places,
  use,
  visitors
}: {
  world: string
  placeKey: string
  places: Record<string, WorldEntity>
  use: WorldMapUse
  visitors: PlaceVisitor[]
}) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const worldsList = useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
  const worldMeta = worldsList.find((w) => w.id === world) ?? null
  const worldNpcs: WorldNpc[] =
    useLive(() => engine('npcs.list', { world, layer: 'play' }), ['npcs.changed', 'saves.changed'], [world]) ?? []
  const stationableNpcs = worldNpcs.filter(
    (n) => !n.archetype && !visitors.some((v) => v.sheet === npcActorId(world, n.id))
  )

  return (
    <div className="flex flex-col gap-2 border border-line/50 tone-surface-60 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Cast Here ({visitors.length})</Eyebrow>
        <div className="flex items-center gap-2">
          <Popover
            title="Station an existing World NPC or Character here"
            trigger={
              <span className="inline-flex cursor-pointer items-center gap-1 font-label text-[10px] caps-5 text-secondary-ink hover:text-ink">
                <UserPlus className="h-3 w-3" /> Station Existing
              </span>
            }
          >
            {(close) => (
              <div className="flex flex-col gap-2">
                {stationableNpcs.length > 0 && (
                  <div className="flex max-h-36 flex-col gap-1 overflow-y-auto border-b border-line/40 pb-2">
                    <span className="font-label text-[9.5px] caps-5 text-dim">World NPCs</span>
                    {stationableNpcs.map((n) => {
                      const actorId = npcActorId(world, n.id)
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            void setWhere(actorId, placeKey, world).catch(failed('Could not station NPC'))
                            close()
                          }}
                          className="flex items-center justify-between border border-line/40 tone-well-40 px-2 py-1 text-left text-[11.5px] text-ink hover:border-accent cursor-pointer"
                        >
                          <span className="truncate font-semibold">{showName(n.title)}</span>
                          <span className="font-label text-[9px] caps text-dim">World NPC</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <EntryPicker
                  kind="sheet"
                  title="Station standalone character"
                  inline
                  onClose={close}
                  onPick={(hit) => {
                    void setWhere(hit.id, placeKey, world).catch(failed('Could not station character'))
                    close()
                  }}
                />
              </div>
            )}
          </Popover>

          {worldMeta && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex cursor-pointer items-center gap-1 font-label text-[10px] caps-5 text-accent hover:text-ink"
            >
              <Plus className="h-3 w-3" /> Create / Stamp
            </button>
          )}
        </div>
      </div>

      {visitors.length === 0 ? (
        <div className="text-[11.5px] text-faint">Nobody is stationed here right now.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visitors.map((v) => {
            const entry = actorEntry(v.sheet)
            return (
              <div key={v.sheet} className="flex flex-col gap-1 border border-line/40 tone-well-40 p-1.5">
                <CharacterRow
                  visitor={v}
                  onRemove={() => void setWhere(v.sheet, null, world).catch(failed('Could not remove character'))}
                  onMenu={(e) => openMenu(e, v.name, characterItems(v, places, placeKey, world))}
                />
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <Chip kind={entry.kind} refText={entry.id} />
                  {v.line && <span className="truncate text-[10.5px] text-dim">{v.line}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && worldMeta && (
        <CreateOrBringCastModal
          world={worldMeta}
          uses={[use]}
          initialPlace={placeKey}
          onClose={() => setShowCreateModal(false)}
          onAdded={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}

export interface AtlasTarget {
  kind: 'place' | 'region'
  key: string
}

type PlaceTabId = 'scene' | 'exits' | 'here' | 'actions'

function normalizeExits(raw: unknown): WorldEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((e) => {
      if (typeof e === 'string') return { text: e, ref: null, locked: false }
      if (!e || typeof e !== 'object') return null
      const r = e as { text?: unknown; ref?: unknown; locked?: unknown }
      return {
        text: typeof r.text === 'string' ? r.text : '',
        ref: typeof r.ref === 'string' && r.ref ? r.ref : null,
        locked: r.locked === true
      }
    })
    .filter((e): e is WorldEntry => e !== null && (Boolean(e.text) || Boolean(e.ref)))
}

function centerOf(form: ShapeForm): Point {
  const b = shapeBounds(form)
  return { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }
}

interface RegionInspectorProps {
  world: string
  regionKey: string
  regions: Record<string, WorldEntity>
  places: Record<string, WorldEntity>
  use: WorldMapUse
  onNavigate: (target: AtlasTarget) => void
  onRedrawZone: () => void
  onStartCreateRegion: (parentKey: string) => void
  onStartCreatePlace: (regionKey: string, insideKey: string | null) => void
  onDeleted: () => void
}

function RegionInspectorBody({
  world,
  regionKey,
  regions,
  places,
  use,
  onNavigate,
  onRedrawZone,
  onStartCreateRegion,
  onStartCreatePlace,
  onDeleted
}: RegionInspectorProps) {
  const active = regions[regionKey]
  if (!active) return <EmptyState title="Region removed">This region no longer exists.</EmptyState>

  const updateRegion = (patch: WorldEntity) => {
    void engine('worlds.put', { id: world, type: REGION_TYPE_KEY, key: regionKey, entity: patch }).catch(failed('Could not save region'))
  }

  const parentKey = typeof active.Parent === 'string' && active.Parent && active.Parent in regions ? active.Parent : null
  const ancestors = regionPath(regions, regionKey).slice(0, -1)
  const subregions = Object.keys(regions)
    .filter((k) => k !== regionKey && regions[k]?.Parent === regionKey)
    .sort((a, b) => placeName(regions, a).localeCompare(placeName(regions, b)))
  const childPlaces = Object.keys(places)
    .filter((k) => places[k]?.Region === regionKey)
    .sort((a, b) => placeName(places, a).localeCompare(placeName(places, b)))
  const zoneForm = (use.regionShapes ?? {})[regionKey] ?? null
  const bounds = zoneForm ? shapeBounds(zoneForm) : null

  return (
    <div className="flex flex-col gap-3.5 p-3 font-ui">
      {/* CLICKABLE TRAIL CHIPS */}
      {ancestors.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {ancestors.map((rk, i) => (
            <span key={rk} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-faint">›</span>}
              <Chip kind="world" refText={`${world}/region/${rk}`} onOpen={() => onNavigate({ kind: 'region', key: rk })} />
            </span>
          ))}
        </div>
      )}

      {/* ZONE & QUICK SPAWN ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-line/60 tone-well-50 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={zoneForm ? 'ok' : 'warn'}>
            {bounds ? `${Math.round(bounds.w)}×${Math.round(bounds.h)}` : 'No zone on this map'}
          </StatusBadge>
          <Button size="sm" variant="secondary" icon={<PenLine />} onClick={onRedrawZone}>
            {zoneForm ? 'Redraw zone' : 'Draw zone'}
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" icon={<Layers />} onClick={() => onStartCreateRegion(regionKey)}>
            + Subregion
          </Button>
          <Button size="sm" variant="primary" icon={<MapPin />} onClick={() => onStartCreatePlace(regionKey, null)}>
            + Place Here
          </Button>
        </div>
      </div>

      {/* PARENT REGION PICKER + LIVE LINK CHIP */}
      <Field label="Parent Region">
        <div className="flex flex-col gap-1.5">
          {parentKey && (
            <div className="flex items-center gap-1.5">
              <Chip
                kind="world"
                refText={`${world}/region/${parentKey}`}
                onOpen={() => onNavigate({ kind: 'region', key: parentKey })}
                onRemove={() => updateRegion({ Parent: null })}
              />
            </div>
          )}
          <WorldRegionPick
            world={world}
            value={parentKey}
            excludeKey={regionKey}
            placeholder="Top-level region"
            onChange={(next) => updateRegion({ Parent: next })}
          />
        </div>
      </Field>

      {/* SUMMARY WITH @LINK AUTOCOMPLETE & LINK CHIPS */}
      <Field label="Summary">
        <LinkTextarea
          rolls={false}
          rows={3}
          value={String(active.Summary ?? '')}
          onValue={(Summary) => updateRegion({ Summary })}
          placeholder="Atmosphere, ruling factions, hazards — type @ to link any entry…"
        />
      </Field>

      {/* CLICK-THROUGH SUBREGIONS */}
      {subregions.length > 0 && (
        <div className="flex flex-col gap-1.5 border border-line/50 tone-surface-60 p-2.5">
          <Eyebrow>Subregions ({subregions.length})</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {subregions.map((sk) => (
              <Chip key={sk} kind="world" refText={`${world}/region/${sk}`} onOpen={() => onNavigate({ kind: 'region', key: sk })} />
            ))}
          </div>
        </div>
      )}

      {/* CLICK-THROUGH PLACES IN THIS REGION */}
      <div className="flex flex-col gap-2 border border-line/50 tone-surface-60 p-2.5">
        <div className="flex items-center justify-between">
          <Eyebrow>Places in {placeName(regions, regionKey)} ({childPlaces.length})</Eyebrow>
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => onStartCreatePlace(regionKey, null)}>
            New Place
          </Button>
        </div>
        {childPlaces.length === 0 ? (
          <div className="text-[11.5px] text-faint">No places in this region yet. Click + Place Here to draw one inside it.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {childPlaces.map((pk) => {
              const sp = use.spawns?.[pk] ?? (use.shapes[pk] ? centerOf(use.shapes[pk]) : null)
              return (
                <div
                  key={pk}
                  onClick={() => onNavigate({ kind: 'place', key: pk })}
                  onContextMenu={(e) => entryMenuAt(e, 'world', `${world}/place/${pk}`, placeName(places, pk), [])}
                  className="flex cursor-pointer items-center justify-between gap-2 border border-line/40 tone-card-60 px-2.5 py-1.5 transition-colors hover:border-accent"
                >
                  <Chip kind="world" refText={`${world}/place/${pk}`} onOpen={() => onNavigate({ kind: 'place', key: pk })} />
                  <span className="shrink-0 font-data text-[10px] text-dim">
                    {sp ? `Spawn ${sp.x}, ${sp.y}` : 'Unzoned on map'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-line/40 pt-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="text-alert" />}
          onClick={() =>
            confirmDelete(
              `Delete region "${placeName(regions, regionKey)}"?`,
              'Subregions and places inside it move up to its parent region, and its zone comes off maps.',
              () => engine('worlds.remove', { id: world, type: REGION_TYPE_KEY, key: regionKey }),
              onDeleted
            )
          }
        >
          Delete Region
        </Button>
      </div>
    </div>
  )
}

interface PlaceInspectorProps {
  world: string
  placeKey: string
  places: Record<string, WorldEntity>
  regions: Record<string, WorldEntity>
  here: Record<string, PlaceVisitor[]>
  player: string | null
  use: WorldMapUse
  placingSpawn: boolean
  onTogglePlaceSpawn: () => void
  onUpdateSpawn: (at: Point) => void
  onRedrawZone: () => void
  onNavigate: (target: AtlasTarget) => void
  onStartCreatePlace: (regionKey: string, insideKey: string | null) => void
  onDeleted: () => void
}

function PlaceInspectorBody({
  world,
  placeKey,
  places,
  regions,
  here,
  player,
  use,
  placingSpawn,
  onTogglePlaceSpawn,
  onUpdateSpawn,
  onRedrawZone,
  onNavigate,
  onStartCreatePlace,
  onDeleted
}: PlaceInspectorProps) {
  const [tab, setTab] = useState<PlaceTabId>('scene')
  const [newExitLabel, setNewExitLabel] = useState('')
  const [newExitTarget, setNewExitTarget] = useState<string | null>(null)

  const active = places[placeKey]
  if (!active) return <EmptyState title="Place removed">This place no longer exists.</EmptyState>

  const updateField = (patch: WorldEntity) => {
    void engine('worlds.put', { id: world, type: PLACE_TYPE_KEY, key: placeKey, entity: patch }).catch(failed('Could not save place'))
  }

  const regionKey = typeof active.Region === 'string' && active.Region && active.Region in regions ? active.Region : null
  const parentPlaceKey = typeof active.Inside === 'string' && active.Inside && active.Inside in places ? active.Inside : null
  const childPlaces = Object.keys(places)
    .filter((k) => k !== placeKey && places[k]?.Inside === placeKey)
    .sort((a, b) => placeName(places, a).localeCompare(placeName(places, b)))

  const regionTrail = regionKey ? regionPath(regions, regionKey) : []
  const placeTrail = placePath(places, placeKey).slice(0, -1)

  const zoneForm = use.shapes[placeKey] ?? null
  const defaultSpawn = zoneForm ? centerOf(zoneForm) : { x: 0, y: 0 }
  const spawn = use.spawns?.[placeKey] ?? defaultSpawn

  const exits = normalizeExits(active.Exits)
  const visitors = here[placeKey] ?? []
  const mermaid = localPlaceMermaid(places, placeKey)
  const filesText = typeof active.Files === 'string' ? active.Files : ''

  const addExit = () => {
    const text = newExitLabel.trim() || 'passage'
    updateField({ Exits: [...exits, { text, ref: newExitTarget, locked: false }] })
    setNewExitLabel('')
    setNewExitTarget(null)
  }

  const tabs: (ShellTab<PlaceTabId> & { render: () => ReactNode })[] = [
    {
      value: 'scene',
      label: 'Scene',
      render: () => (
        <div className="flex flex-col gap-3.5">
          {/* REGION & PARENT PLACE PICKERS + CLICKABLE LINK CHIPS */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field label="Region / Area">
              <div className="flex flex-col gap-1.5">
                {regionKey && (
                  <div>
                    <Chip
                      kind="world"
                      refText={`${world}/region/${regionKey}`}
                      onOpen={() => onNavigate({ kind: 'region', key: regionKey })}
                      onRemove={() => updateField({ Region: null })}
                    />
                  </div>
                )}
                <WorldRegionPick
                  world={world}
                  value={regionKey}
                  placeholder="Assign region…"
                  onChange={(next) => updateField({ Region: next })}
                />
              </div>
            </Field>

            <Field label="Inside (Parent Place)">
              <div className="flex flex-col gap-1.5">
                {parentPlaceKey && (
                  <div>
                    <Chip
                      kind="world"
                      refText={`${world}/place/${parentPlaceKey}`}
                      onOpen={() => onNavigate({ kind: 'place', key: parentPlaceKey })}
                      onRemove={() => updateField({ Inside: null })}
                    />
                  </div>
                )}
                <WorldPlacePick
                  world={world}
                  value={parentPlaceKey}
                  placeholder="Standalone in region"
                  onChange={(next) => {
                    if (next === placeKey) return
                    updateField({ Inside: next })
                  }}
                />
              </div>
            </Field>
          </div>

          {/* CHILD PLACES / ROOMS NESTED INSIDE THIS PLACE */}
          {childPlaces.length > 0 && (
            <div className="flex flex-col gap-1.5 border border-line/50 tone-surface-60 p-2.5">
              <div className="flex items-center justify-between">
                <Eyebrow>Places Inside ({childPlaces.length})</Eyebrow>
                <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => onStartCreatePlace(regionKey ?? '', placeKey)}>
                  Room Inside
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {childPlaces.map((ck) => (
                  <Chip key={ck} kind="world" refText={`${world}/place/${ck}`} onOpen={() => onNavigate({ kind: 'place', key: ck })} />
                ))}
              </div>
            </div>
          )}

          <Field label="Looks (Visual Description)">
            <LinkTextarea
              rolls={false}
              rows={3}
              value={String(active.Looks ?? '')}
              onValue={(Looks) => updateField({ Looks })}
              placeholder="Lighting, layout, materials, atmosphere — type @ to reference entries…"
            />
          </Field>

          <Field label="Now (Live Scene State)">
            <LinkTextarea
              rolls={false}
              rows={2}
              value={String(active.Now ?? '')}
              onValue={(Now) => updateField({ Now })}
              placeholder="What is happening here right now — type @ to reference characters or events…"
            />
          </Field>

          <div className="flex flex-col gap-2 border border-line/50 tone-surface-60 p-2.5">
            <div className="flex items-center justify-between">
              <Eyebrow>Linked Lore, Pages &amp; Sheets</Eyebrow>
              <Popover
                title="Link an entry to this place"
                trigger={
                  <span className="inline-flex cursor-pointer items-center gap-1 font-label text-[10px] caps-5 text-accent hover:text-ink">
                    <Plus className="h-3 w-3" /> Link Entry
                  </span>
                }
              >
                {(close) => (
                  <EntryPicker
                    kind={null}
                    title="Link entry"
                    inline
                    onClose={close}
                    onPick={(hit) => {
                      const ref = `@${hit.kind}:${hit.id}`
                      updateField({ Files: filesText.trim() ? `${filesText.trim()} ${ref}` : ref })
                      close()
                    }}
                  />
                )}
              </Popover>
            </div>
            <LinkTextarea
              rolls={false}
              rows={2}
              value={filesText}
              onValue={(Files) => updateField({ Files })}
              placeholder="@page:notes @sheet:innkeeper"
            />
            <LinkFaceList text={filesText} />
          </div>
        </div>
      )
    },
    {
      value: 'exits',
      label: 'Exits',
      count: exits.length,
      render: () => (
        <div className="flex flex-col gap-3">
          <Eyebrow>1-Hop Local Connections</Eyebrow>
          {exits.length === 0 ? (
            <div className="border border-line/40 tone-well-40 p-3 text-[11.5px] text-faint">
              No local exits yet. Link adjacent rooms, doors, or roads below so agents navigate 1-hop without clairvoyance.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {exits.map((ex, idx) => (
                <div key={idx} className="flex flex-col gap-2 border border-line/50 tone-card-60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 font-semibold text-ink">
                      <LinkInlineEdit
                        value={ex.text}
                        placeholder="Exit description (e.g. Ironbound oak door)"
                        onSave={(text) => {
                          const next = [...exits]
                          next[idx] = { ...ex, text }
                          updateField({ Exits: next })
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...exits]
                        next[idx] = { ...ex, locked: !ex.locked }
                        updateField({ Exits: next })
                      }}
                      className={cn(
                        'shrink-0 border px-1.5 py-0.5 font-label text-[9.5px] font-bold caps-5 cursor-pointer',
                        ex.locked ? 'border-alert/50 bg-alert/15 text-alert' : 'border-ok/40 bg-ok/10 text-ok'
                      )}
                    >
                      {ex.locked ? 'Locked' : 'Open'}
                    </button>
                    <button
                      type="button"
                      title="Remove exit"
                      onClick={() => updateField({ Exits: exits.filter((_, i) => i !== idx) })}
                      className="text-dim hover:text-alert cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-secondary-ink" />
                    {ex.ref && ex.ref in places && (
                      <Chip
                        kind="world"
                        refText={`${world}/place/${ex.ref}`}
                        onOpen={() => onNavigate({ kind: 'place', key: ex.ref! })}
                        onRemove={() => {
                          const next = [...exits]
                          next[idx] = { ...ex, ref: null }
                          updateField({ Exits: next })
                        }}
                      />
                    )}
                    <div className="min-w-40 flex-1">
                      <WorldPlacePick
                        world={world}
                        value={ex.ref}
                        placeholder="Link destination place…"
                        onChange={(ref) => {
                          const next = [...exits]
                          next[idx] = { ...ex, ref }
                          updateField({ Exits: next })
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ADD EXIT BUILDER */}
          <div className="flex flex-col gap-2 border border-line/50 tone-well-40 p-2.5">
            <Eyebrow>Add 1-Hop Exit</Eyebrow>
            <LinkTextarea
              rolls={false}
              rows={1}
              value={newExitLabel}
              onValue={setNewExitLabel}
              placeholder="Doorway, stair, road, or passage…"
              className="min-h-0 resize-none"
            />
            <div className="flex items-center gap-2">
              <WorldPlacePick
                world={world}
                value={newExitTarget}
                placeholder="Destination place…"
                onChange={setNewExitTarget}
                className="flex-1"
              />
              <Button size="sm" variant="primary" icon={<Plus />} onClick={addExit}>
                Add Exit
              </Button>
            </div>
          </div>

          {mermaid && (
            <div className="flex flex-col gap-1.5 border border-line/40 tone-panel-50 p-2.5">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-secondary-ink" />
                <Eyebrow>Local 1-Hop Topology</Eyebrow>
              </div>
              <pre className="overflow-x-auto font-mono text-[10.5px] text-dim">{mermaid}</pre>
            </div>
          )}
        </div>
      )
    },
    {
      value: 'here',
      label: 'Here',
      count: visitors.length,
      render: () => (
        <div className="flex flex-col gap-3.5">
          <PlaceHereSection
            world={world}
            placeKey={placeKey}
            places={places}
            use={use}
            visitors={visitors}
          />

          <PlaceEvents world={world} place={placeKey} />
        </div>
      )
    },
    {
      value: 'actions',
      label: 'Actions',
      render: () => (
        <div className="flex flex-col gap-3">
          <PlayList play={placePlay(world, placeKey, active, player, visitors.flatMap((v) => (v.agent ? [v.agent] : [])))} />
          <ObjectPlayManager
            world={world}
            character={player}
            actionsText={String(active.Actions ?? '')}
            decisionsText={String(active.Decisions ?? '')}
            onChangeActions={(Actions) => updateField({ Actions })}
            onChangeDecisions={(Decisions) => updateField({ Decisions })}
          />
        </div>
      )
    }
  ]

  const currentTab = tabs.find((t) => t.value === tab) ?? tabs[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col font-ui">
      {/* CLICK-THROUGH BREADCRUMB TRAIL + SPAWN / ZONE BAR */}
      <div className="flex flex-col gap-2 border-b border-line/50 tone-panel-60 px-3 py-2">
        {(regionTrail.length > 0 || placeTrail.length > 0) && (
          <div className="flex flex-wrap items-center gap-1">
            {regionTrail.map((rk, i) => (
              <span key={`r:${rk}`} className="inline-flex items-center gap-1">
                {i > 0 && <span className="text-faint">›</span>}
                <Chip kind="world" refText={`${world}/region/${rk}`} onOpen={() => onNavigate({ kind: 'region', key: rk })} />
              </span>
            ))}
            {placeTrail.map((pk, i) => (
              <span key={`p:${pk}`} className="inline-flex items-center gap-1">
                {(regionTrail.length > 0 || i > 0) && <span className="text-faint">›</span>}
                <Chip kind="world" refText={`${world}/place/${pk}`} onOpen={() => onNavigate({ kind: 'place', key: pk })} />
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <StatusBadge tone={zoneForm ? 'ok' : 'warn'}>{zoneForm ? 'Zone' : 'Draw Zone'}</StatusBadge>
            {zoneForm && (
              <span className="inline-flex items-center gap-1 border border-line/60 tone-well-60 px-2 py-0.5 text-secondary-ink">
                <Crosshair className="h-3 w-3 text-accent" />
                <span className="text-dim">Spawn</span>
                <InlineNumber value={spawn.x} onSave={(x) => onUpdateSpawn({ x, y: spawn.y })} min={0} />
                <span className="text-faint">,</span>
                <InlineNumber value={spawn.y} onSave={(y) => onUpdateSpawn({ x: spawn.x, y })} min={0} />
                <button
                  type="button"
                  title="Reset spawn to zone center"
                  onClick={() => onUpdateSpawn(defaultSpawn)}
                  className="ml-0.5 text-faint hover:text-accent cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {zoneForm && (
              <Button
                size="sm"
                variant={placingSpawn ? 'primary' : 'secondary'}
                icon={<Crosshair />}
                onClick={onTogglePlaceSpawn}
                title="Click on the map to set exact character spawn coordinates"
              >
                {placingSpawn ? 'Click Map…' : 'Set Spawn'}
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<PenLine />} onClick={onRedrawZone}>
              {zoneForm ? 'Redraw' : 'Draw Zone'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus />}
              title="Draw a child place / room inside this place"
              onClick={() => onStartCreatePlace(regionKey ?? '', placeKey)}
            >
              Room
            </Button>
          </div>
        </div>
      </div>

      <ShellTabs value={currentTab.value} options={tabs} onChange={setTab} className="px-2 pt-1 tone-panel-40" />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {currentTab.render()}
        <div className="mt-4 flex justify-end border-t border-line/40 pt-2.5">
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="text-alert" />}
            onClick={() =>
              confirmDelete(
                `Delete place "${placeName(places, placeKey)}"?`,
                'Child places inside it move up one level, and its zone and spawn point come off maps.',
                () => engine('worlds.remove', { id: world, type: PLACE_TYPE_KEY, key: placeKey }),
                onDeleted
              )
            }
          >
            Delete Place
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AtlasInspector({
  world,
  target,
  places,
  regions,
  here,
  player,
  use,
  width,
  expanded,
  onToggleExpand,
  onResizeStart,
  back,
  forward,
  placingSpawn,
  onTogglePlaceSpawn,
  onUpdateSpawn,
  onRedrawZone,
  onNavigate,
  onStartCreateRegion,
  onStartCreatePlace,
  onClose
}: {
  world: string
  target: AtlasTarget
  places: Record<string, WorldEntity>
  regions: Record<string, WorldEntity>
  here: Record<string, PlaceVisitor[]>
  player: string | null
  use: WorldMapUse
  width: number
  expanded: boolean
  onToggleExpand: () => void
  onResizeStart: (e: React.PointerEvent) => void
  back: (() => void) | null
  forward: (() => void) | null
  placingSpawn: boolean
  onTogglePlaceSpawn: () => void
  onUpdateSpawn: (at: Point) => void
  onRedrawZone: () => void
  onNavigate: (target: AtlasTarget) => void
  onStartCreateRegion: (parentKey: string) => void
  onStartCreatePlace: (regionKey: string, insideKey: string | null) => void
  onClose: () => void
}) {
  const isRegion = target.kind === 'region'
  const record = isRegion ? regions[target.key] : places[target.key]
  const title = record ? String(record.Name || target.key) : target.key
  const entryPath = isRegion ? `${world}/region/${target.key}` : `${world}/place/${target.key}`
  const typeKey = isRegion ? REGION_TYPE_KEY : PLACE_TYPE_KEY

  const handleContextMenu = (e: MouseEvent) => {
    entryMenuAt(e, 'world', entryPath, title, [])
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="relative z-20 flex min-h-0 shrink-0 flex-col border-l border-line/60 tone-panel-95 shadow-panel backdrop-blur-[var(--panel-blur)]"
    >
      {/* DRAG RESIZE HANDLE */}
      <div
        onPointerDown={onResizeStart}
        onDoubleClick={onToggleExpand}
        title="Drag edge to resize (320px–960px) · Double-click to toggle width"
        className="group absolute inset-y-0 -left-1.5 z-30 flex w-3 cursor-ew-resize items-center justify-center hover:bg-secondary-ink/30"
      >
        <div className="h-8 w-0.5 bg-line/60 group-hover:bg-secondary-ink" />
      </div>

      {/* INSPECTOR HEADER BAR */}
      <div
        onContextMenu={handleContextMenu}
        className="flex shrink-0 items-center justify-between gap-2 border-b border-line/60 tone-sidebar-80 px-2.5 py-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <NavArrows back={back} forward={forward} />
          <span className="font-label text-[9.5px] font-bold caps-8 text-accent">
            {isRegion ? 'Region' : 'Place'}
          </span>
          <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
            <InlineTitle
              value={title}
              onSave={(next) => {
                if (next.trim()) {
                  void engine('worlds.put', { id: world, type: typeKey, key: target.key, entity: { Name: next.trim() } }).catch(
                    failed('Could not rename')
                  )
                }
              }}
            />
          </div>
          <CopyLinkButton kind="world" id={entryPath} />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            icon={<ArrowRightLeft />}
            title={`Copy "${title}" to another world`}
            onClick={() => openCopyToWorld({ entries: [{ ref: entryPath, title }], sourceWorld: world })}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={expanded ? <Minimize2 /> : <Maximize2 />}
            title={expanded ? 'Compact inspector width' : 'Expand inspector width'}
            onClick={onToggleExpand}
          />
          <Button size="sm" variant="ghost" icon={<X />} title="Close inspector (Esc)" onClick={onClose} />
        </div>
      </div>

      {/* INDEPENDENTLY SCROLLING BODY (NEVER TRAPS MAP WHEEL ZOOM) */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {isRegion ? (
          <RegionInspectorBody
            world={world}
            regionKey={target.key}
            regions={regions}
            places={places}
            use={use}
            onNavigate={onNavigate}
            onRedrawZone={onRedrawZone}
            onStartCreateRegion={onStartCreateRegion}
            onStartCreatePlace={onStartCreatePlace}
            onDeleted={onClose}
          />
        ) : (
          <PlaceInspectorBody
            world={world}
            placeKey={target.key}
            places={places}
            regions={regions}
            here={here}
            player={player}
            use={use}
            placingSpawn={placingSpawn}
            onTogglePlaceSpawn={onTogglePlaceSpawn}
            onUpdateSpawn={onUpdateSpawn}
            onRedrawZone={onRedrawZone}
            onNavigate={onNavigate}
            onStartCreatePlace={onStartCreatePlace}
            onDeleted={onClose}
          />
        )}
      </div>
    </div>
  )
}
