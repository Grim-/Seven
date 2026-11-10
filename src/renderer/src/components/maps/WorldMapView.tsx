import { useState, useMemo, type MouseEvent, type ReactNode } from 'react'
import {
  ArrowUpToLine,
  Box,
  FolderOpen,
  Layers,
  MousePointerClick,
  Plus,
  RotateCw,
  Skull,
  Trash2,
  Unlink,
  Zap
} from 'lucide-react'
import {
  changeLayer,
  mapArea,
  mapObjects,
  moveLayer,
  placeId,
  placeTree,
  type ConditionGating,
  type MapData,
  type MapLayer,
  type ObjectLayerData,
  type PlaceVisitor,
  type WorldMapUse
} from '@shared/maps'
import { smallestAt, type Point, type ShapeForm, type ShapeKind } from '@shared/shapes'
import { PLACE_TYPE_KEY, recordKey } from '@shared/world'
import { showName } from '@shared/ids'
import {
  Button,
  EmptyState,
  LoadingScreen,
  Modal,
  Segmented,
  askText,
  confirmDelete,
  openMenu,
  useDraft,
  type MenuItem
} from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'
import { entryMenuAt } from '../../views/data/entryMenu'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { MapCanvas } from './MapCanvas'
import { PlaceTree } from './PlaceTree'
import { PlaceCard } from './PlaceCard'
import { placeName } from './placeShapes'
import { usePlaceData, type PlaceData, type WorldLayer } from './usePlaceRecords'
import { useMapPictures } from './useMapPictures'
import { characterItems, placeItems, setWhere } from './placeActions'
import { useMapTokens } from './useMapTokens'
import { PresenceMarkers } from './PresenceMarkers'
import { useEscapeLayer } from '../../lib/escape'
import { useViewPlace } from '../../lib/viewPlace'
import { useMap, useWorldMaps } from './useMap'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { AddPredefinedObjectModal } from './AddPredefinedObjectModal'
import { AddTriggerModal } from './AddTriggerModal'
import { WorldObjectInspector } from './WorldObjectInspector'
import { WorldTriggerInspector } from './WorldTriggerInspector'
import { WorldCharacterInspector } from './WorldCharacterInspector'
import { SpawnerInspector } from './SpawnerInspector'
import { PlaceSpawnerModal } from './PlaceSpawnerModal'
import { SheetPortrait } from '../data/SheetPortrait'
import { FlagSelect } from '../game/FlagSelect'
import type { MapObjectHandlers } from './mapObjects'

const FORMS: { value: ShapeKind; label: string }[] = [
  { value: 'outline', label: 'Outline' },
  { value: 'box', label: 'Box' }
]

function PlacesOnMap({
  world,
  map: sourceMap,
  source,
  data,
  onStart
}: {
  world: string
  map: MapData
  source: WorldMapUse
  data: PlaceData
  onStart: (place: string) => void
}) {
  const { places, changes, here } = data
  const { draft, change } = useDraft(source, (use) => engine('worlds.saveMapUse', { id: world, use }))
  const { draft: mapDraft, change: changeMap } = useDraft(sourceMap, (m) => engine('maps.save', { map: m }))

  // Navigation & Selection States
  const [sidebarTab, setSidebarTab] = useState<'places' | 'characters' | 'spawners' | 'triggers' | 'objects'>('places')
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null)
  const [selectedSpawnerId, setSelectedSpawnerId] = useState<string | null>(null)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedCharacterSheet, setSelectedCharacterSheet] = useState<string | null>(null)

  // Resizable Right Drawer State
  const [drawerWidth, setDrawerWidth] = useViewPlace<number>('worldDrawerWidth', 360)
  const [isExpanded, setIsExpanded] = useState(false)
  const [liveDrawerWidth, setLiveDrawerWidth] = useState<number | null>(null)

  const activeDrawerWidth = liveDrawerWidth ?? (isExpanded ? Math.max(drawerWidth, 680) : drawerWidth)

  const handleDrawerResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = activeDrawerWidth
    let finalW = startW

    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX
      finalW = Math.max(320, Math.min(960, startW + delta))
      setLiveDrawerWidth(finalW)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setLiveDrawerWidth(null)
      setDrawerWidth(finalW)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Creation Modals
  const [addTriggerAt, setAddTriggerAt] = useState<Point | null>(null)
  const [addObjectAt, setAddObjectAt] = useState<Point | null>(null)
  const [addSpawnerAt, setAddSpawnerAt] = useState<Point | null>(null)

  const player = useWorldPlayer(world)
  const [drawing, setDrawing] = useState<{ kind: ShapeKind; from?: Point } | null>(null)
  const [gatingOpen, setGatingOpen] = useState(false)
  const flags = useLive(() => engine('worlds.flags', { id: world }), 'worlds.changed') ?? {}
  const shape = selected ? draft.shapes[selected] : undefined

  // Active inspectors
  const selectedTrigger = (draft.triggers ?? []).find((t) => t.id === selectedTriggerId) ?? null
  const selectedSpawner = (mapDraft.spawners ?? []).find((s) => s.id === selectedSpawnerId) ?? null
  const selectedObject = mapObjects(mapDraft.layers).find((o) => o.id === selectedObjectId) ?? null

  const relevantFlags = useMemo(() => {
    const set = new Set<string>()
    for (const g of Object.values(draft.layerGating ?? {})) {
      if (g.needsFlag) set.add(g.needsFlag)
      if (g.hiddenIfFlag) set.add(g.hiddenIfFlag)
    }
    for (const g of Object.values(draft.propGating ?? {})) {
      if (g.needsFlag) set.add(g.needsFlag)
      if (g.hiddenIfFlag) set.add(g.hiddenIfFlag)
    }
    for (const t of draft.triggers ?? []) {
      if (t.needsFlag) set.add(t.needsFlag)
      if (t.hiddenIfFlag) set.add(t.hiddenIfFlag)
    }
    return [...set]
  }, [draft.layerGating, draft.propGating, draft.triggers])

  const setLayerGating = (layerId: string, gating: ConditionGating | null) => {
    const next = { ...(draft.layerGating ?? {}) }
    if (!gating || (!gating.needsFlag && !gating.hiddenIfFlag)) {
      delete next[layerId]
    } else {
      next[layerId] = gating
    }
    change({ ...draft, layerGating: next })
  }

  const setShape = (key: string, form: ShapeForm | null) => {
    const { [key]: _old, ...rest } = draft.shapes
    change({ ...draft, shapes: form ? { ...rest, [key]: form } : rest })
  }

  const select = (key: string | null) => {
    setDrawing(null)
    setSelectedTriggerId(null)
    setSelectedSpawnerId(null)
    setSelectedObjectId(null)
    setSelectedCharacterSheet(null)
    setSelected(key)
  }

  const open = Boolean(selected && places[selected])
  useEscapeLayer(
    (open && !drawing) || Boolean(selectedTriggerId) || Boolean(selectedSpawnerId) || Boolean(selectedObjectId) || Boolean(selectedCharacterSheet),
    () => {
      select(null)
    }
  )

  // Object Handlers
  const handleUpdateObject = (next: ObjectLayerData) => {
    changeMap({ ...mapDraft, layers: changeLayer(mapDraft.layers, next.id, () => next) })
  }

  const handleDeleteObject = (id: string) => {
    if (selectedObjectId === id) setSelectedObjectId(null)
    changeMap({ ...mapDraft, layers: changeLayer(mapDraft.layers, id, () => null) })
  }

  const handleUpdatePropGating = (id: string, gating: ConditionGating | null) => {
    const next = { ...(draft.propGating ?? {}) }
    if (!gating || (!gating.needsFlag && !gating.hiddenIfFlag)) {
      delete next[id]
    } else {
      next[id] = gating
    }
    change({ ...draft, propGating: next })
  }

  const worldObjectHandlers = useMemo<MapObjectHandlers>(
    () => ({
      selected: selectedObjectId ?? undefined,
      onPick: (o) => {
        setSelected(null)
        setSelectedTriggerId(null)
        setSelectedObjectId(o.id)
      },
      onMenu: (o, e) => {
        openMenu(e, o.name, [
          {
            label: 'Inspect / Configure Object',
            icon: <Box className="h-4 w-4 text-cyan" />,
            onSelect: () => {
              setSelected(null)
              setSelectedTriggerId(null)
              setSelectedObjectId(o.id)
            }
          },
          {
            label: 'Rotate 90°',
            icon: <RotateCw className="h-4 w-4" />,
            onSelect: () => handleUpdateObject({ ...o, rotation: (o.rotation + 90) % 360 })
          },
          {
            label: 'Bring to Front',
            icon: <ArrowUpToLine className="h-4 w-4" />,
            onSelect: () => {
              const layers = moveLayer(mapDraft.layers, o.id, mapDraft.layers.length - 1)
              changeMap({ ...mapDraft, layers })
            }
          },
          {
            label: 'Delete Object',
            icon: <Trash2 className="h-4 w-4 text-alert" />,
            danger: true,
            onSelect: () => handleDeleteObject(o.id)
          }
        ])
      },
      onChange: (id, patch) => {
        changeMap({
          ...mapDraft,
          layers: changeLayer(mapDraft.layers, id, (l) => ({ ...l, ...patch }) as MapLayer)
        })
      }
    }),
    [mapDraft, selectedObjectId]
  )

  const newPlace = (inside: string | null, at?: Point) =>
    askText(inside ? `New place inside ${placeName(places, inside)}` : 'New place', 'Name', '', async (name) => {
      const key = recordKey(name)
      if (!key) return
      if (!places[key])
        await engine('worlds.put', {
          id: world,
          type: PLACE_TYPE_KEY,
          key,
          entity: { Name: name.trim(), Inside: inside ?? '' }
        })
      setSelected(key)
      setDrawing(at ? { kind: 'outline', from: at } : null)
    })

  const actionsFor = (key: string): MenuItem[] =>
    placeItems({
      world,
      placeKey: key,
      places,
      here: here[key] ?? [],
      shaped: Boolean(draft.shapes[key]),
      player,
      onStart: player ? () => onStart(key) : null,
      onNewInside: () => newPlace(key),
      onDraw: () => {
        setSelected(key)
        setDrawing({ kind: 'outline' })
      },
      onRemoveShape: () => {
        setDrawing(null)
        setShape(key, null)
      },
      onDeleted: () => setSelected((s) => (s === key ? null : s))
    })

  const placeMenu = (e: MouseEvent, key: string) =>
    entryMenuAt(e, 'place', placeId(world, key), placeName(places, key), [
      { label: 'Open', icon: <FolderOpen />, onSelect: () => select(key) },
      ...actionsFor(key)
    ])

  const characterMenu = (e: MouseEvent, v: PlaceVisitor, at: string) =>
    openMenu(e, v.name, characterItems(v, places, at))

  const people = useMapTokens({
    world,
    use: draft,
    places,
    player,
    editing: true,
    save: change,
    onSelect: (sheet) => {
      setSelected(null)
      setSelectedTriggerId(null)
      setSelectedObjectId(null)
      setSelectedCharacterSheet(sheet)
    }
  })

  const selectedToken = useMemo(
    () => people.tokens.find((t) => t.visitor.sheet === selectedCharacterSheet) ?? null,
    [people.tokens, selectedCharacterSheet]
  )

  const selectedPlaceKeyForToken = useMemo(() => {
    if (!selectedToken) return null
    return smallestAt(draft.shapes, selectedToken.at)
  }, [selectedToken, draft.shapes])

  const mapMenu = (e: MouseEvent, at: Point) =>
    openMenu(e, showName(mapDraft.name), [
      {
        label: 'Place Predefined Map Object here...',
        icon: <Box className="h-4 w-4 text-cyan" />,
        onSelect: () => setAddObjectAt(at)
      },
      {
        label: 'Place Trigger zone here...',
        icon: <Zap className="h-4 w-4 text-accent" />,
        onSelect: () => setAddTriggerAt(at)
      },
      {
        label: 'Place Creature Spawner here...',
        icon: <Skull className="h-4 w-4 text-alert" />,
        onSelect: () => setAddSpawnerAt(at)
      },
      { label: 'New place here', icon: <Plus />, onSelect: () => newPlace(null, at) },
      people.putHere(at),
      people.spawnCreatureHere(at),
      ...(selected
        ? [
            {
              label: `New place inside ${placeName(places, selected)} here`,
              icon: <Plus />,
              onSelect: () => newPlace(selected, at)
            }
          ]
        : []),
      {
        label: `Remove ${showName(mapDraft.name)} from this world`,
        icon: <Unlink className="h-4 w-4 text-alert" />,
        danger: true,
        onSelect: () =>
          confirmDelete(
            `Remove ${showName(mapDraft.name)} from this world?`,
            "This world's places drawn on it will be detached; the map itself remains safe in Maps.",
            () => engine('worlds.dropMap', { id: world, map: source.map }),
            undefined,
            'Remove from World'
          )
      }
    ])

  const addMenu = (e: MouseEvent) =>
    selected
      ? openMenu(e, 'New place', [
          { label: 'New place', onSelect: () => newPlace(null) },
          { label: `New place inside ${placeName(places, selected)}`, onSelect: () => newPlace(selected) }
        ])
      : newPlace(null)

  const area = mapArea(mapDraft)
  const overlay =
    selected && (shape || drawing) ? (
      <ShapeEditor
        size={area}
        shapes={shape && !drawing ? [{ id: selected, label: placeName(places, selected), form: shape }] : []}
        onChange={(list) => list[0] && setShape(selected, list[0].form)}
        selected={selected}
        onSelect={() => undefined}
        drawing={drawing?.kind ?? null}
        from={drawing?.from}
        onDrawn={() => setDrawing(null)}
        newLabel={placeName(places, selected)}
        newId={() => selected}
        passThrough
        onMenu={placeMenu}
        marks={() =>
          here[selected]?.length ? (
            <PresenceMarkers visitors={here[selected]} onMenu={(e, v) => characterMenu(e, v, selected)} />
          ) : null
        }
        className="absolute left-0 top-0"
      >
        <div style={{ width: area.w, height: area.h }} />
      </ShapeEditor>
    ) : undefined

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] border border-line/40 bg-black/40">
      {/* LEFT SIDEBAR: PLACES | TRIGGERS | OBJECTS */}
      <div className="flex min-h-0 flex-col border-r border-line/40 font-mono">
        <div className="flex flex-col border-b border-line/40 p-2 gap-2 bg-black/50">
          <Segmented
            value={sidebarTab}
            onChange={(t) => setSidebarTab(t as 'places' | 'characters' | 'spawners' | 'triggers' | 'objects')}
            options={[
              { value: 'places', label: 'Places' },
              { value: 'characters', label: `Chars (${people.tokens.length})` },
              { value: 'spawners', label: `Spawners (${(mapDraft.spawners ?? []).length})` },
              { value: 'triggers', label: `Triggers (${(draft.triggers ?? []).length})` },
              { value: 'objects', label: `Objects (${mapObjects(mapDraft.layers).length})` }
            ]}
          />
          <div className="flex items-center justify-between text-[11px] px-1">
            <span className="font-bold text-dim uppercase">
              {sidebarTab === 'places'
                ? 'World Places'
                : sidebarTab === 'characters'
                ? 'Map Characters'
                : sidebarTab === 'spawners'
                ? 'Creature Spawners'
                : sidebarTab === 'triggers'
                ? 'Map Triggers'
                : 'Map Props & Objects'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="Configure map layer visibility &amp; flag gating rules"
                onClick={() => setGatingOpen(true)}
                className="flex items-center gap-1 font-mono text-[10.5px] text-cyan hover:text-white"
              >
                <Layers className="h-3 w-3" />
                <span>Gating</span>
              </button>
              <button
                type="button"
                title="Remove this map from this world"
                onClick={() =>
                  confirmDelete(
                    `Remove ${showName(mapDraft.name)} from this world?`,
                    "This world's places drawn on it will be detached; the map itself remains safe in Maps.",
                    () => engine('worlds.dropMap', { id: world, map: source.map }),
                    undefined,
                    'Remove from World'
                  )
                }
                className="flex items-center gap-1 font-mono text-[10.5px] text-alert/70 hover:text-alert border border-alert/20 bg-alert/5 px-1.5 py-0.5 hover:bg-alert/15 transition-colors"
              >
                <Unlink className="h-3 w-3 text-alert" />
                <span>Remove</span>
              </button>
              {sidebarTab === 'places' && (
                <button type="button" title="New place" onClick={addMenu} className="text-accent hover:text-white">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              {sidebarTab === 'characters' && (
                <button
                  type="button"
                  title="Put a character on this map"
                  onClick={() => {
                    const at = {
                      x: Math.round(mapDraft.size.w / 2),
                      y: Math.round(mapDraft.size.h / 2)
                    }
                    people.putHere(at).onSelect?.()
                  }}
                  className="text-accent hover:text-white flex items-center gap-0.5 text-[10px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Character
                </button>
              )}
              {sidebarTab === 'spawners' && (
                <button
                  type="button"
                  title="Place Creature Spawner"
                  onClick={() =>
                    setAddSpawnerAt({
                      x: Math.round(mapDraft.size.w / 2),
                      y: Math.round(mapDraft.size.h / 2)
                    })
                  }
                  className="text-alert hover:text-white flex items-center gap-0.5 text-[10px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Spawner
                </button>
              )}
              {sidebarTab === 'triggers' && (
                <button
                  type="button"
                  title="Place Trigger"
                  onClick={() =>
                    setAddTriggerAt({
                      x: Math.round(mapDraft.size.w / 2),
                      y: Math.round(mapDraft.size.h / 2)
                    })
                  }
                  className="text-accent hover:text-white flex items-center gap-0.5 text-[10px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Trigger
                </button>
              )}
              {sidebarTab === 'objects' && (
                <button
                  type="button"
                  title="Place Predefined Object"
                  onClick={() =>
                    setAddObjectAt({
                      x: Math.round(mapDraft.size.w / 2),
                      y: Math.round(mapDraft.size.h / 2)
                    })
                  }
                  className="text-cyan hover:text-white flex items-center gap-0.5 text-[10px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Object
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {sidebarTab === 'places' && (
            <PlaceTree
              nodes={placeTree(places, draft.shapes)}
              selected={selected}
              onSelect={select}
              onMenu={placeMenu}
            />
          )}

          {sidebarTab === 'characters' && (
            <div className="flex flex-col divide-y divide-line/30">
              {people.tokens.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-dim">
                  No characters or tokens on this map yet. Click &ldquo;+ Character&rdquo; above to place party members or creatures.
                </div>
              ) : (
                people.tokens.map((t) => {
                  const isSel = selectedCharacterSheet === t.visitor.sheet
                  const isPlayer = player === t.visitor.sheet
                  const hp = t.visitor.dnd?.hp ? `${t.visitor.dnd.hp.cur}/${t.visitor.dnd.hp.max} HP` : null

                  return (
                    <button
                      key={t.visitor.sheet}
                      type="button"
                      onClick={() => {
                        setSelected(null)
                        setSelectedTriggerId(null)
                        setSelectedObjectId(null)
                        setSelectedCharacterSheet(t.visitor.sheet)
                      }}
                      className={cn(
                        'flex items-center gap-2 p-2 text-left transition-colors font-mono',
                        isSel
                          ? 'border-l-2 border-l-accent bg-accent/15 text-white'
                          : 'text-dim hover:bg-card/40 hover:text-white'
                      )}
                    >
                      <SheetPortrait
                        image={t.visitor.image}
                        className={cn('h-7 w-7 shrink-0 border', isPlayer ? 'border-accent' : 'border-line/40')}
                      />
                      <div className="flex min-w-0 flex-1 flex-col truncate">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12px] font-bold text-white truncate">
                            {showName(t.visitor.name)}
                          </span>
                          {isPlayer && (
                            <span className="text-[8.5px] font-bold uppercase text-accent border border-accent/40 px-1 shrink-0">
                              Player
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9.5px] text-faint">
                          {hp && <span className="text-dim">{hp}</span>}
                          <span>({t.at.x}, {t.at.y})</span>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {sidebarTab === 'spawners' && (
            <div className="flex flex-col divide-y divide-line/30">
              {(!mapDraft.spawners || mapDraft.spawners.length === 0) ? (
                <div className="p-4 text-center text-[11px] text-dim">
                  No creature spawners on this map. Right-click the map or click &ldquo;+ Spawner&rdquo; to place monster spawners.
                </div>
              ) : (
                mapDraft.spawners.map((s) => {
                  const isSel = selectedSpawnerId === s.id
                  const isHostile = s.disposition === 'hostile'
                  const isNeutral = s.disposition === 'neutral'
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        select(null)
                        setSelectedSpawnerId(s.id)
                      }}
                      className={cn(
                        'flex items-center justify-between p-2 text-left transition-colors font-mono',
                        isSel
                          ? 'border-l-2 border-l-alert bg-alert/15 text-white'
                          : 'text-dim hover:bg-panel hover:text-white'
                      )}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-[12px] font-bold text-white truncate flex items-center gap-1.5">
                          <Skull className={cn('h-3 w-3 shrink-0', isHostile ? 'text-alert' : isNeutral ? 'text-amber-400' : 'text-emerald-400')} />
                          <span>{s.name}</span>
                        </span>
                        <span className="text-[10px] text-faint truncate">
                          {s.monsterId} · ({s.at.x}, {s.at.y})
                        </span>
                      </div>
                      <span
                        className={cn(
                          'text-[9px] uppercase font-bold border px-1 shrink-0',
                          isHostile
                            ? 'border-alert/40 text-alert'
                            : isNeutral
                            ? 'border-amber-400/40 text-amber-400'
                            : 'border-emerald-400/40 text-emerald-400'
                        )}
                      >
                        {s.disposition}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {sidebarTab === 'triggers' && (
            <div className="flex flex-col divide-y divide-line/30">
              {!draft.triggers || draft.triggers.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-dim">
                  No triggers on this map yet. Right-click the map or click &ldquo;+ Trigger&rdquo; to add teleport doors, notes, or action zones.
                </div>
              ) : (
                draft.triggers.map((t) => {
                  const isSel = selectedTriggerId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelected(null)
                        setSelectedObjectId(null)
                        setSelectedTriggerId(t.id)
                      }}
                      className={cn(
                        'flex items-center justify-between p-2 text-left transition-colors font-mono',
                        isSel
                          ? 'border-l-2 border-l-accent bg-accent/15 text-white'
                          : 'text-dim hover:bg-panel hover:text-white'
                      )}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-[12px] font-bold text-white truncate flex items-center gap-1">
                          {t.fires === 'enter' ? <Zap className="h-3 w-3 text-accent shrink-0" /> : <MousePointerClick className="h-3 w-3 text-cyan shrink-0" />}
                          <span>{t.name}</span>
                        </span>
                        <span className="text-[10px] text-faint truncate">{t.type}</span>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-accent border border-accent/40 px-1 shrink-0">
                        {t.fires}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {sidebarTab === 'objects' && (
            <div className="flex flex-col divide-y divide-line/30">
              {mapObjects(mapDraft.layers).length === 0 ? (
                <div className="p-4 text-center text-[11px] text-dim">
                  No objects on this map. Right-click the map or click &ldquo;+ Object&rdquo; to place chests, doors, levers, shrines, or obstacles.
                </div>
              ) : (
                mapObjects(mapDraft.layers).map((o) => {
                  const isSel = selectedObjectId === o.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setSelected(null)
                        setSelectedTriggerId(null)
                        setSelectedObjectId(o.id)
                      }}
                      className={cn(
                        'flex items-center gap-2.5 p-2 text-left transition-colors font-mono',
                        isSel
                          ? 'border-l-2 border-l-cyan bg-cyan/15 text-white'
                          : 'text-dim hover:bg-panel hover:text-white'
                      )}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-line bg-black/60 p-0.5">
                        <img src={o.image} alt={o.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-white truncate">{o.name}</span>
                          <span className="text-[9px] uppercase font-bold text-cyan border border-cyan/40 px-1">
                            {o.collision ?? 'solid'}
                          </span>
                        </div>
                        <span className="text-[10px] text-faint truncate">
                          ({o.offset.x}, {o.offset.y}) · {o.actions ? 'Interactive' : 'Static'}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* MAP CANVAS VIEWPORT */}
      <div className="relative flex min-h-0 flex-col">
        {mapDraft.layers.length ? (
          <div className="relative min-h-0 flex-1">
            <MapCanvas
              map={mapDraft}
              shapes={draft.shapes}
              places={places}
              here={here}
              place={`world.${world}.${mapDraft.id}`}
              selected={selected}
              onPick={(s) => select(s.id)}
              onBlank={
                drawing
                  ? undefined
                  : () => {
                      select(null)
                      setSelectedTriggerId(null)
                      setSelectedObjectId(null)
                      setSelectedSpawnerId(null)
                    }
              }
              onShapeMenu={drawing ? undefined : (e, s) => placeMenu(e, s.id)}
              onBlankMenu={drawing ? undefined : mapMenu}
              onCharacterMenu={characterMenu}
              objects={worldObjectHandlers}
              tokens={people.tokens}
              onToken={people.handlers}
              triggers={draft.triggers ?? []}
              selectedTrigger={selectedTriggerId}
              onPickTrigger={(t) => {
                setSelected(null)
                setSelectedObjectId(null)
                setSelectedSpawnerId(null)
                setSelectedTriggerId(t.id)
              }}
              spawners={mapDraft.spawners ?? []}
              selectedSpawner={selectedSpawnerId}
              onPickSpawner={(s) => {
                setSelected(null)
                setSelectedObjectId(null)
                setSelectedTriggerId(null)
                setSelectedSpawnerId(s.id)
              }}
              onMoveSpawner={(id, at) => {
                changeMap({
                  ...mapDraft,
                  spawners: (mapDraft.spawners ?? []).map((s) => (s.id === id ? { ...s, at } : s))
                })
              }}
              onSpawnerMenu={(spawner, e) => {
                openMenu(e, spawner.name, [
                  {
                    label: 'Inspect Spawner',
                    icon: <Skull className="h-4 w-4 text-alert" />,
                    onSelect: () => {
                      setSelected(null)
                      setSelectedObjectId(null)
                      setSelectedTriggerId(null)
                      setSelectedSpawnerId(spawner.id)
                    }
                  },
                  {
                    label: 'Rotate 90°',
                    icon: <RotateCw className="h-4 w-4" />,
                    onSelect: () => {
                      changeMap({
                        ...mapDraft,
                        spawners: (mapDraft.spawners ?? []).map((s) =>
                          s.id === spawner.id ? { ...s, facing: ((s.facing ?? 0) + 90) % 360 } : s
                        )
                      })
                    }
                  },
                  {
                    label: 'Delete Spawner',
                    icon: <Trash2 className="h-4 w-4 text-alert" />,
                    danger: true,
                    onSelect: () => {
                      changeMap({
                        ...mapDraft,
                        spawners: (mapDraft.spawners ?? []).filter((s) => s.id !== spawner.id)
                      })
                      if (selectedSpawnerId === spawner.id) setSelectedSpawnerId(null)
                    }
                  }
                ])
              }}
              onTriggerMenu={(e, t) => {
                openMenu(e, t.name, [
                  {
                    label: 'Inspect / Configure Trigger',
                    icon: <Zap className="h-4 w-4 text-accent" />,
                    onSelect: () => {
                      setSelected(null)
                      setSelectedObjectId(null)
                      setSelectedTriggerId(t.id)
                    }
                  },
                  {
                    label: 'Delete Trigger',
                    icon: <Trash2 className="h-4 w-4 text-alert" />,
                    danger: true,
                    onSelect: () => {
                      if (selectedTriggerId === t.id) setSelectedTriggerId(null)
                      const triggers = (draft.triggers ?? []).filter((x) => x.id !== t.id)
                      change({ ...draft, triggers })
                    }
                  }
                ])
              }}
              layerGating={draft.layerGating}
              propGating={draft.propGating}
              flags={flags}
              overlay={overlay}
              className="h-full"
            />

            {/* LIVE FLAG SIMULATOR (Top Right of canvas) */}
            {relevantFlags.length > 0 && (
              <div className="absolute right-3 top-2.5 z-10 flex items-center gap-2 border border-line/60 bg-black/90 px-2.5 py-1 font-mono text-[11px] shadow-lg">
                <span className="text-[10px] uppercase tracking-wider text-dim">Flags Preview:</span>
                <div className="flex items-center gap-1.5">
                  {relevantFlags.map((flagKey) => {
                    const active = Boolean(flags[flagKey])
                    return (
                      <button
                        key={flagKey}
                        type="button"
                        onClick={() => engine('worlds.setFlag', { id: world, key: flagKey, value: !active })}
                        className={cn(
                          'flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold uppercase transition-all',
                          active
                            ? 'border-ok/40 bg-ok/10 text-ok'
                            : 'border-line/40 bg-black/40 text-faint hover:text-white'
                        )}
                        title={`Click to toggle world flag "${flagKey}" live`}
                      >
                        {flagKey}: {active ? 'TRUE' : 'FALSE'}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {drawing && selected && (
              <div className="absolute left-1/2 top-2.5 z-10 flex -translate-x-1/2 items-center gap-2 border border-cyan/40 bg-black/90 px-2.5 py-1.5 font-mono text-[11px] text-cyan">
                <span>Shape for {placeName(places, selected)}</span>
                <Segmented
                  value={drawing.kind}
                  options={FORMS}
                  onChange={(kind) => setDrawing({ kind, from: drawing.from })}
                />
                <span className="text-faint">
                  {drawing.kind === 'outline' ? 'click points, double-click to close' : 'drag a box'} · Esc to stop
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
            <EmptyState title="Nothing on this map yet">
              Open it in Maps to add pictures, or place predefined objects and triggers from the context menu.
            </EmptyState>
          </div>
        )}

        {/* RIGHT DRAWER: PLACE CARD */}
        {open && selected && (
          <div className="absolute inset-y-0 right-0 z-20 flex min-h-0 w-[320px] flex-col border-l border-line/60 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.5)]">
            <PlaceCard
              key={selected}
              world={world}
              placeKey={selected}
              places={places}
              changes={changes[selected] ?? {}}
              here={here[selected] ?? []}
              actions={actionsFor(selected)}
              onSelect={select}
            />
          </div>
        )}

        {/* RIGHT DRAWER: TRIGGER INSPECTOR */}
        {selectedTrigger && (
          <div
            className="absolute inset-y-0 right-0 z-20 flex min-h-0 flex-col border-l border-line/60 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.7)]"
            style={{ width: `${activeDrawerWidth}px` }}
          >
            {/* DRAG RESIZE HANDLE ON LEFT EDGE */}
            <div
              onPointerDown={handleDrawerResizeStart}
              onDoubleClick={() => setIsExpanded((prev) => !prev)}
              className="absolute inset-y-0 -left-1.5 w-3 cursor-ew-resize hover:bg-cyan/40 active:bg-cyan z-30 transition-colors group flex items-center justify-center"
              title="Drag left to expand outwards · Double-click to toggle width"
            >
              <div className="h-8 w-0.5 bg-line/60 group-hover:bg-cyan group-active:bg-cyan rounded-full" />
            </div>
            <WorldTriggerInspector
              key={selectedTrigger.id}
              trigger={selectedTrigger}
              world={world}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded((prev) => !prev)}
              onChange={(next) => {
                const triggers = (draft.triggers ?? []).map((t) => (t.id === next.id ? next : t))
                change({ ...draft, triggers })
              }}
              onDelete={() => {
                setSelectedTriggerId(null)
                const triggers = (draft.triggers ?? []).filter((t) => t.id !== selectedTrigger.id)
                change({ ...draft, triggers })
              }}
              onClose={() => setSelectedTriggerId(null)}
            />
          </div>
        )}

        {/* RIGHT DRAWER: MAP OBJECT INSPECTOR */}
        {selectedObject && (
          <div
            className="absolute inset-y-0 right-0 z-20 flex min-h-0 flex-col border-l border-line/60 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.7)]"
            style={{ width: `${activeDrawerWidth}px` }}
          >
            {/* DRAG RESIZE HANDLE ON LEFT EDGE */}
            <div
              onPointerDown={handleDrawerResizeStart}
              onDoubleClick={() => setIsExpanded((prev) => !prev)}
              className="absolute inset-y-0 -left-1.5 w-3 cursor-ew-resize hover:bg-cyan/40 active:bg-cyan z-30 transition-colors group flex items-center justify-center"
              title="Drag left to expand outwards · Double-click to toggle width"
            >
              <div className="h-8 w-0.5 bg-line/60 group-hover:bg-cyan group-active:bg-cyan rounded-full" />
            </div>
            <WorldObjectInspector
              key={selectedObject.id}
              object={selectedObject}
              world={world}
              gating={draft.propGating?.[selectedObject.id]}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded((prev) => !prev)}
              onChange={handleUpdateObject}
              onChangeGating={(gating) => handleUpdatePropGating(selectedObject.id, gating)}
              onBringToFront={() => {
                const layers = moveLayer(mapDraft.layers, selectedObject.id, mapDraft.layers.length - 1)
                changeMap({ ...mapDraft, layers })
              }}
              onSendToBack={() => {
                const layers = moveLayer(mapDraft.layers, selectedObject.id, 0)
                changeMap({ ...mapDraft, layers })
              }}
              onDelete={() => handleDeleteObject(selectedObject.id)}
              onClose={() => setSelectedObjectId(null)}
            />
          </div>
        )}

        {/* RIGHT DRAWER: SPAWNER INSPECTOR */}
        {selectedSpawner && (
          <div
            className="absolute inset-y-0 right-0 z-20 flex min-h-0 flex-col border-l border-line/60 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.7)]"
            style={{ width: `${activeDrawerWidth}px` }}
          >
            {/* DRAG RESIZE HANDLE ON LEFT EDGE */}
            <div
              onPointerDown={handleDrawerResizeStart}
              onDoubleClick={() => setIsExpanded((prev) => !prev)}
              className="absolute inset-y-0 -left-1.5 w-3 cursor-ew-resize hover:bg-alert/40 active:bg-alert z-30 transition-colors group flex items-center justify-center"
              title="Drag left to expand outwards · Double-click to toggle width"
            >
              <div className="h-8 w-0.5 bg-line/60 group-hover:bg-alert group-active:bg-alert rounded-full" />
            </div>
            <SpawnerInspector
              key={selectedSpawner.id}
              spawner={selectedSpawner}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded((prev) => !prev)}
              onChange={(next) => {
                changeMap({
                  ...mapDraft,
                  spawners: (mapDraft.spawners ?? []).map((s) => (s.id === next.id ? next : s))
                })
              }}
              onDelete={() => {
                setSelectedSpawnerId(null)
                changeMap({
                  ...mapDraft,
                  spawners: (mapDraft.spawners ?? []).filter((s) => s.id !== selectedSpawner.id)
                })
              }}
              onClose={() => setSelectedSpawnerId(null)}
            />
          </div>
        )}

        {/* RIGHT DRAWER: CHARACTER INSPECTOR */}
        {selectedToken && (
          <div
            className="absolute inset-y-0 right-0 z-20 flex min-h-0 flex-col border-l border-line/60 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.7)]"
            style={{ width: `${activeDrawerWidth}px` }}
          >
            {/* DRAG RESIZE HANDLE ON LEFT EDGE */}
            <div
              onPointerDown={handleDrawerResizeStart}
              onDoubleClick={() => setIsExpanded((prev) => !prev)}
              className="absolute inset-y-0 -left-1.5 w-3 cursor-ew-resize hover:bg-accent/40 active:bg-accent z-30 transition-colors group flex items-center justify-center"
              title="Drag left to expand outwards · Double-click to toggle width"
            >
              <div className="h-8 w-0.5 bg-line/60 group-hover:bg-accent group-active:bg-accent rounded-full" />
            </div>
            <WorldCharacterInspector
              key={selectedToken.visitor.sheet}
              visitor={selectedToken.visitor}
              world={world}
              places={places}
              isPlayer={player === selectedToken.visitor.sheet}
              standing={draft.stand[selectedToken.visitor.sheet]}
              currentPlaceKey={selectedPlaceKeyForToken}
              isExpanded={isExpanded}
              onToggleExpand={() => setIsExpanded((prev) => !prev)}
              onSetPlayer={() => {
                void engine('worlds.setPlayer', { id: world, sheet: selectedToken.visitor.sheet })
                  .then(() => toast.success('Active Player Set', `${selectedToken.visitor.name} is now active.`))
                  .catch(failed('Could not set player'))
              }}
              onSetFaction={(factionId) => {
                void engine('sheets.setFaction', { id: selectedToken.visitor.sheet, faction: factionId })
                  .then(() => toast.success('Faction Updated', `Assigned to ${factionId ?? 'no faction'}.`))
                  .catch(failed('Could not change faction'))
              }}
              onMoveToPlace={(placeKey) => {
                void setWhere(selectedToken.visitor.sheet, placeKey)
                  .then(() => toast.success('Moved', placeKey ? `Moved to ${placeName(places, placeKey)}` : 'Removed from place'))
                  .catch(failed('Could not move them'))
              }}
              onRemoveFromMap={() => {
                const { [selectedToken.visitor.sheet]: _del, ...rest } = draft.stand
                change({ ...draft, stand: rest })
                setSelectedCharacterSheet(null)
              }}
              onClose={() => setSelectedCharacterSheet(null)}
            />
          </div>
        )}
      </div>

      {/* LAYER GATING MODAL */}
      {gatingOpen && (
        <Modal open={true} title="Layer Visibility &amp; Flag Gating" onClose={() => setGatingOpen(false)} wide>
          <div className="flex flex-col gap-4 font-mono select-none">
            <p className="text-[12px] text-dim">
              Set world flags required to display or hide specific map layers (e.g. secret passages, dynamic bridges, collapsed walls).
            </p>

            <div className="flex flex-col divide-y divide-line/40 border border-line/40 bg-black/50">
              <div className="grid grid-cols-[1fr_160px_160px] gap-3 px-2.5 py-1.5 text-[10px] font-bold uppercase text-dim">
                <span>Layer Name</span>
                <span>Visible If Flag Set</span>
                <span>Hidden If Flag Set</span>
              </div>

              {mapDraft.layers.map((l) => {
                const current = draft.layerGating?.[l.id]
                return (
                  <div key={l.id} className="grid grid-cols-[1fr_160px_160px] items-center gap-3 p-2.5">
                    <div className="flex flex-col">
                      <span className="text-[12.5px] font-bold text-white">{l.name}</span>
                      <span className="text-[10px] uppercase text-faint">{l.kind} layer</span>
                    </div>

                    <FlagSelect
                      world={world}
                      value={current?.needsFlag}
                      placeholder="None"
                      onChange={(f) =>
                        setLayerGating(l.id, {
                          needsFlag: f,
                          hiddenIfFlag: current?.hiddenIfFlag
                        })
                      }
                    />

                    <FlagSelect
                      world={world}
                      value={current?.hiddenIfFlag}
                      placeholder="None"
                      onChange={(f) =>
                        setLayerGating(l.id, {
                          needsFlag: current?.needsFlag,
                          hiddenIfFlag: f
                        })
                      }
                    />
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 border-t border-line/40 pt-3">
              <Button size="sm" variant="primary" onClick={() => setGatingOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* PLACE PREDEFINED OBJECT MODAL */}
      {addObjectAt && (
        <AddPredefinedObjectModal
          world={world}
          map={mapDraft}
          at={addObjectAt}
          onClose={() => setAddObjectAt(null)}
          onPlaced={(newObj, gating) => {
            changeMap({ ...mapDraft, layers: [...mapDraft.layers, newObj] })
            if (gating) {
              handleUpdatePropGating(newObj.id, gating)
            }
            setSelected(null)
            setSelectedTriggerId(null)
            setSelectedObjectId(newObj.id)
          }}
        />
      )}

      {/* PLACE TRIGGER MODAL */}
      {addTriggerAt && (
        <AddTriggerModal
          world={world}
          at={addTriggerAt}
          onClose={() => setAddTriggerAt(null)}
          onPlaced={(newTrigger) => {
            const nextTriggers = [...(draft.triggers ?? []), newTrigger]
            change({ ...draft, triggers: nextTriggers })
            setSelected(null)
            setSelectedObjectId(null)
            setSelectedSpawnerId(null)
            setSelectedTriggerId(newTrigger.id)
          }}
        />
      )}

      {/* PLACE CREATURE SPAWNER MODAL */}
      {addSpawnerAt && (
        <PlaceSpawnerModal
          at={addSpawnerAt}
          onClose={() => setAddSpawnerAt(null)}
          onPlaced={(spawner) => {
            changeMap({
              ...mapDraft,
              spawners: [...(mapDraft.spawners ?? []), spawner]
            })
            setSelected(null)
            setSelectedObjectId(null)
            setSelectedTriggerId(null)
            setSelectedSpawnerId(spawner.id)
            setAddSpawnerAt(null)
          }}
        />
      )}
    </div>
  )
}

export function WorldMapLoad({
  world,
  mapId,
  layer = 'play',
  children
}: {
  world: string
  mapId: string
  layer?: WorldLayer
  children: (map: MapData, use: WorldMapUse, data: PlaceData) => ReactNode
}) {
  const map = useMap(mapId)
  const use = useWorldMaps(world)?.find((u) => u.map === mapId)
  const data = usePlaceData(world, layer)
  const pictures = useMapPictures(map)
  if (map === false) return <EmptyState title="Gone">This map no longer exists.</EmptyState>
  if (!map || !use || !data || pictures.done < pictures.total)
    return (
      <LoadingScreen
        title={map ? showName(map.name) : 'map'}
        steps={[
          { label: 'Map', done: Boolean(map && use) },
          { label: 'Places and who is here', done: Boolean(data) },
          {
            label: 'Pictures',
            done: Boolean(map) && pictures.done >= pictures.total,
            detail: map ? `${pictures.done} / ${pictures.total}` : undefined
          }
        ]}
      />
    )
  return <>{children(map, use, data)}</>
}

export function WorldMapView({
  world,
  mapId,
  onStart
}: {
  world: string
  mapId: string
  onStart: (place: string) => void
}) {
  return (
    <WorldMapLoad world={world} mapId={mapId} layer="template">
      {(map, use, data) => (
        <PlacesOnMap key={`${world}/${mapId}`} world={world} map={map} source={use} data={data} onStart={onStart} />
      )}
    </WorldMapLoad>
  )
}
