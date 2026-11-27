import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useStore } from 'zustand'
import {
  CanvasLayerList,
  CanvasStoreContext,
  createCanvasStore,
  type CanvasLayerState
} from '../canvasEditor'
import {
  ArrowUpToLine,
  Box,
  Cable,
  Layers3,
  Undo2,
  Check,
  ChevronDown,
  ChevronRight,
  Crosshair,
  ExternalLink,
  FolderOpen,
  Layers,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Plus,
  RotateCw,
  Skull,
  Stamp,
  Trash2,
  Unlink,
  Users,
  X,
  Zap
} from 'lucide-react'
import {
  changeLayer,
  forgetMapThing,
  layerOn,
  mapThingKey,
  PLACE_THING,
  PROP_THING,
  REGION_THING,
  SPAWNER_THING,
  TOKEN_THING,
  TRIGGER_THING,
  type MapLink,
  mapArea,
  mapObjects,
  moveLayer,
  placeId,
  placeTree,
  regionTree,
  type ConditionGating,
  type MapData,
  type MapLayer,
  type ObjectLayerData,
  type PlaceNode,
  type PlaceVisitor,
  type WorldMapUse
} from '@shared/maps'
import { formHas, movedForm, shapeBounds, smallestAt, type Point, type ShapeForm, type ShapeKind } from '@shared/shapes'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY, recordKey, type WorldEntity } from '@shared/world'
import { monsterToSheetInput } from '@shared/game/creatures'
import type { WorldNpc } from '@shared/worldNpcs'
import { showName } from '@shared/ids'
import { cleanComponents, type ComponentDef } from '@shared/game/core'
import { emittedEvents } from '@shared/game/components'
import {
  Button,
  EmptyState,
  ListPane,
  LoadingScreen,
  MainPane,
  Modal,
  Segmented,
  Split,
  TokenFilterInput,
  confirmDelete,
  openMenu,
  parseTokenFilter,
  useDraft,
  type MenuItem
} from '../ui'
import { engine } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'
import { entryMenuAt } from '../../views/data/entryMenu'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { MapCanvas } from './MapCanvas'
import { placeName } from './placeShapes'
import { usePlaceData, useRegionRecords, type PlaceData, type WorldLayer } from './usePlaceRecords'
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
import { LinkTextarea } from '../data/LinkTextarea'
import { FlagSelect } from '../game/FlagSelect'
import type { MapObjectHandlers } from './mapObjects'
import { assignFaction } from '../factions/FactionSelect'
import { AtlasInspector, type AtlasTarget } from '../worlds/AtlasInspector'
import { AtlasToolDock, StampPickerPanel, type AtlasCanvasTool, type StampBrush } from './AtlasToolDock'
import { WorldPlacePick } from '../worlds/WorldPlacePick'
import { WorldRegionPick } from '../worlds/WorldRegionPick'
import { LayerTree } from '../worlds/mapLayers/LayerTree'
import { wiringTabs } from '../worlds/mapLayers/ThingWiring'
import { useMapOrganise } from '../worlds/mapLayers/useMapOrganise'
import { layerFlags } from '../worlds/mapLayers/layerOps'
import { dragProps } from '../worlds/mapLayers/thingDrag'
import { linkableThing, type MapThing } from './things'

const FORMS: { value: ShapeKind; label: string }[] = [
  { value: 'box', label: 'Box' },
  { value: 'outline', label: 'Polygon' }
]

interface PendingCreate {
  kind: 'region' | 'place'
  name: string
  parent: string
  region: string
  tempForm: ShapeForm | null
  tempSpawn: Point | null
}

type RailTabId = 'atlas' | 'characters' | 'spawners' | 'triggers' | 'objects' | 'layers'

function matchesFilter(name: string, key: string, q: string): boolean {
  return !q || name.toLowerCase().includes(q) || key.toLowerCase().includes(q)
}

function SpatialPlaceSubtree({
  nodes,
  here,
  activeTarget,
  filterText,
  depth,
  onPickPlace,
  onPlaceMenu
}: {
  nodes: PlaceNode[]
  here: Record<string, PlaceVisitor[]>
  activeTarget: AtlasTarget | null
  filterText: string
  depth: number
  onPickPlace: (key: string) => void
  onPlaceMenu: (e: MouseEvent, key: string) => void
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const hasVisible = (node: PlaceNode): boolean =>
    matchesFilter(node.name, node.key, filterText) || node.children.some(hasVisible)

  return (
    <>
      {nodes.filter(hasVisible).map((n) => {
        const isOpen = !closed[n.key]
        const isSelected = activeTarget?.kind === 'place' && activeTarget.key === n.key
        const visitorCount = (here[n.key] ?? []).length
        return (
          <div key={n.key}>
            <div
              onClick={() => onPickPlace(n.key)}
              onContextMenu={(e) => onPlaceMenu(e, n.key)}
              style={{ paddingLeft: `${8 + depth * 13}px` }}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 border-l-2 py-1 pr-2 text-[12px] transition-colors',
                isSelected
                  ? 'border-l-accent bg-accent/12 font-semibold text-ink'
                  : 'border-l-transparent text-dim hover:tone-card-40 hover:text-ink'
              )}
            >
              {n.children.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setClosed((s) => ({ ...s, [n.key]: !s[n.key] }))
                  }}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-faint hover:text-ink cursor-pointer"
                >
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              ) : (
                <MapPin className={cn('h-3 w-3 shrink-0', isSelected ? 'text-accent' : 'text-accent-soft')} />
              )}
              <span className="min-w-0 flex-1 truncate">{n.name}</span>
              {visitorCount > 0 ? (
                <span className="shrink-0 font-data text-[9.5px] text-ok">{visitorCount}</span>
              ) : !n.shaped ? (
                <span className="shrink-0 font-label text-[9px] caps-5 text-warn">Unzoned</span>
              ) : null}
            </div>
            {isOpen && n.children.length > 0 && (
              <SpatialPlaceSubtree
                nodes={n.children}
                here={here}
                activeTarget={activeTarget}
                filterText={filterText}
                depth={depth + 1}
                onPickPlace={onPickPlace}
                onPlaceMenu={onPlaceMenu}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function SpatialRegionSubtree({
  nodes,
  places,
  shapes,
  here,
  activeTarget,
  filterText,
  showRegions,
  showPlaces,
  depth,
  onPickRegion,
  onRegionMenu,
  onPickPlace,
  onPlaceMenu,
  onAddPlaceInRegion
}: {
  nodes: PlaceNode[]
  places: Record<string, WorldEntity>
  shapes: Record<string, ShapeForm>
  here: Record<string, PlaceVisitor[]>
  activeTarget: AtlasTarget | null
  filterText: string
  showRegions: boolean
  showPlaces: boolean
  depth: number
  onPickRegion: (key: string) => void
  onRegionMenu: (e: MouseEvent, key: string) => void
  onPickPlace: (key: string) => void
  onPlaceMenu: (e: MouseEvent, key: string) => void
  onAddPlaceInRegion: (regionKey: string) => void
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({})

  return (
    <>
      {nodes.map((rNode) => {
        const directPlaces = Object.fromEntries(
          Object.entries(places).filter(([, p]) => {
            const inside = typeof p.Inside === 'string' ? p.Inside : ''
            const parentInSameRegion = Boolean(inside && places[inside]?.Region === rNode.key)
            return p.Region === rNode.key && !parentInSameRegion
          })
        )
        const allRegionPlaces = Object.fromEntries(Object.entries(places).filter(([, p]) => p.Region === rNode.key))
        const pNodes = placeTree(allRegionPlaces, shapes).filter((pn) => pn.key in directPlaces || !(places[pn.key]?.Inside as string))
        const matchesSelf = matchesFilter(rNode.name, rNode.key, filterText)
        const hasPlaceMatch = Object.entries(allRegionPlaces).some(([pk, pv]) => matchesFilter(String(pv.Name || pk), pk, filterText))
        if (filterText && !matchesSelf && !hasPlaceMatch && rNode.children.length === 0) return null

        const isOpen = !closed[rNode.key]
        const isSelected = activeTarget?.kind === 'region' && activeTarget.key === rNode.key

        return (
          <div key={rNode.key} className="mb-1">
            {showRegions && (
              <div
                onClick={() => onPickRegion(rNode.key)}
                onContextMenu={(e) => onRegionMenu(e, rNode.key)}
                style={{ paddingLeft: `${8 + depth * 12}px` }}
                className={cn(
                  'group/reg flex cursor-pointer items-center gap-1.5 border-l-2 py-1.5 pr-2 text-[11.5px] transition-colors',
                  isSelected
                    ? 'border-l-secondary-ink bg-secondary/15 font-bold text-secondary-ink'
                    : 'border-l-transparent text-ink/90 hover:tone-card-40'
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setClosed((s) => ({ ...s, [rNode.key]: !s[rNode.key] }))
                  }}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-faint hover:text-ink cursor-pointer"
                >
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                <Layers className="h-3 w-3 shrink-0 text-secondary-ink" />
                <span className="min-w-0 flex-1 truncate caps-5 font-semibold">{rNode.name}</span>
                {!rNode.shaped && <span className="shrink-0 font-label text-[8.5px] caps-5 text-warn">Unzoned</span>}
                <button
                  type="button"
                  title={`New Place inside ${rNode.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddPlaceInRegion(rNode.key)
                  }}
                  className="shrink-0 p-0.5 text-faint opacity-0 group-hover/reg:opacity-100 hover:text-accent cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}

            {isOpen && (
              <>
                {rNode.children.length > 0 && (
                  <SpatialRegionSubtree
                    nodes={rNode.children}
                    places={places}
                    shapes={shapes}
                    here={here}
                    activeTarget={activeTarget}
                    filterText={filterText}
                    showRegions={showRegions}
                    showPlaces={showPlaces}
                    depth={depth + 1}
                    onPickRegion={onPickRegion}
                    onRegionMenu={onRegionMenu}
                    onPickPlace={onPickPlace}
                    onPlaceMenu={onPlaceMenu}
                    onAddPlaceInRegion={onAddPlaceInRegion}
                  />
                )}
                {showPlaces && pNodes.length > 0 && (
                  <SpatialPlaceSubtree
                    nodes={pNodes}
                    here={here}
                    activeTarget={activeTarget}
                    filterText={filterText}
                    depth={showRegions ? depth + 1 : depth}
                    onPickPlace={onPickPlace}
                    onPlaceMenu={onPlaceMenu}
                  />
                )}
              </>
            )}
          </div>
        )
      })}
    </>
  )
}

function PlacesOnMap({
  world,
  map: sourceMap,
  source,
  data,
  mode = 'editor',
  initialTarget = null,
  initialStampNpc = null,
  onConsumeStamp,
  onStart
}: {
  world: string
  map: MapData
  source: WorldMapUse
  data: PlaceData
  mode?: 'player' | 'editor'
  initialTarget?: AtlasTarget | null
  initialStampNpc?: WorldNpc | null
  onConsumeStamp?: () => void
  onStart: (place: string) => void
}) {
  const isPlayerMode = mode === 'player'
  const { places, here } = data
  const regions = useRegionRecords(world)
  const { draft, change } = useDraft(source, (use) => engine('worlds.saveMapUse', { id: world, use }))
  const { draft: mapDraft, change: changeMap } = useDraft(sourceMap, (m) => engine('maps.save', { map: m }))

  // Collapsible & Resizable Left Spatial Tree Pane
  const [treeOpen, setTreeOpen] = useViewPlace<boolean>('worldAtlasTreeOpen', true)
  const [treeWidth, setTreeWidth] = useViewPlace<number>('worldAtlasTreeWidth', 268)
  const [railTab, setRailTab] = useState<RailTabId>('atlas')

  // TokenFilterInput state
  const [filterRaw, setFilterRaw] = useState('')
  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [filterTags, setFilterTags] = useState<string[]>([])

  // Isolated per-world CanvasEditor store (powers CanvasToolbar, CanvasLayerList, and multi-stage tools)
  const canvasStore = useMemo(
    () =>
      createCanvasStore({
        editorId: `world-atlas.${world}`,
        initialLayers: [
          { id: 'tokens', label: 'Tokens', visible: true, locked: false, opacity: 1, order: 7, color: 'var(--color-ok)' },
          { id: 'spawners', label: 'Spawners', visible: true, locked: false, opacity: 1, order: 6, color: 'var(--color-alert)' },
          { id: 'triggers', label: 'Triggers', visible: true, locked: false, opacity: 1, order: 5, color: 'var(--color-accent)' },
          { id: 'props', label: 'Props', visible: true, locked: false, opacity: 1, order: 4, color: 'var(--color-secondary-ink)' },
          { id: 'spawns', label: 'Spawns', visible: true, locked: false, opacity: 1, order: 3 },
          { id: 'places', label: 'Places', visible: true, locked: false, opacity: 1, order: 2, color: 'var(--color-accent-soft)' },
          { id: 'regions', label: 'Regions', visible: true, locked: false, opacity: 1, order: 1, color: '#a855f7' }
        ] satisfies CanvasLayerState[]
      }),
    [world]
  )
  const canvasLayers = useStore(canvasStore, (s) => s.layers)
  const [overlaysExpanded, setOverlaysExpanded] = useViewPlace<boolean>('worldAtlasOverlaysOpen', false)

  const layerStateById = useMemo(() => {
    const map: Record<string, CanvasLayerState> = {}
    for (const l of canvasLayers) map[l.id] = l
    return map
  }, [canvasLayers])

  const layerVis = {
    regions: layerStateById.regions?.visible ?? true,
    places: layerStateById.places?.visible ?? true,
    spawns: layerStateById.spawns?.visible ?? true,
    tokens: layerStateById.tokens?.visible ?? true,
    triggers: layerStateById.triggers?.visible ?? true,
    spawners: layerStateById.spawners?.visible ?? true,
    props: layerStateById.props?.visible ?? true
  }
  const layerLocked = {
    regions: layerStateById.regions?.locked ?? false,
    places: layerStateById.places?.locked ?? false,
    tokens: layerStateById.tokens?.locked ?? false,
    triggers: layerStateById.triggers?.locked ?? false,
    spawners: layerStateById.spawners?.locked ?? false,
    props: layerStateById.props?.locked ?? false
  }

  // Selection & Click-Through Navigation History
  const [history, setHistory] = useState<AtlasTarget[]>(() => (initialTarget ? [initialTarget] : []))
  const [historyIdx, setHistoryIdx] = useState<number>(() => (initialTarget ? 0 : -1))
  const activeTarget = historyIdx >= 0 && historyIdx < history.length ? history[historyIdx] : null

  const selected = activeTarget?.kind === 'place' ? activeTarget.key : null
  const selectedRegion = activeTarget?.kind === 'region' ? activeTarget.key : null

  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null)
  const [selectedSpawnerId, setSelectedSpawnerId] = useState<string | null>(null)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedCharacterSheet, setSelectedCharacterSheet] = useState<string | null>(null)
  const [cameraFocus, setCameraFocus] = useState<{ at: Point; seq: number } | null>(null)
  const panTo = (at: Point) => setCameraFocus((prev) => ({ at, seq: (prev?.seq ?? 0) + 1 }))

  useEffect(() => {
    if (!initialTarget) return
    setHistory([initialTarget])
    setHistoryIdx(0)
  }, [initialTarget?.kind, initialTarget?.key])

  // Resizable & Collapsible Right Inspector Drawer
  const [inspectorOpen, setInspectorOpen] = useViewPlace<boolean>('worldAtlasInspectorOpen', true)
  const [drawerWidth, setDrawerWidth] = useViewPlace<number>('worldDrawerWidth', 420)
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
      finalW = Math.max(320, Math.min(960, startW + (startX - ev.clientX)))
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

  // Creation & Drawing States
  const [addTriggerAt, setAddTriggerAt] = useState<Point | null>(null)
  const [addObjectAt, setAddObjectAt] = useState<Point | null>(null)
  const [addSpawnerAt, setAddSpawnerAt] = useState<Point | null>(null)

  const player = useWorldPlayer(world)
  const [drawing, setDrawing] = useState<{ kind: ShapeKind; from?: Point } | null>(null)
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null)
  const pendingFormRef = useRef<ShapeForm | null>(null)
  const [placingSpawn, setPlacingSpawn] = useState(false)
  const [gatingOpen, setGatingOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<AtlasCanvasTool>(() => (initialStampNpc ? 'stamp' : 'select'))
  const swallowNextContextMenuRef = useRef(false)
  const [stampBrush, setStampBrush] = useState<StampBrush | null>(() =>
    initialStampNpc
      ? {
          source: 'world-npc',
          id: initialStampNpc.id,
          name: showName(initialStampNpc.title),
          count: 1,
          faction: initialStampNpc.faction,
          disposition: initialStampNpc.disposition ?? 'neutral'
        }
      : null
  )
  const [stampingAt, setStampingAt] = useState(false)

  useEffect(() => {
    if (!initialStampNpc || isPlayerMode) return
    setActiveTool('stamp')
    setStampBrush({
      source: 'world-npc',
      id: initialStampNpc.id,
      name: showName(initialStampNpc.title),
      count: 1,
      faction: initialStampNpc.faction,
      disposition: initialStampNpc.disposition ?? 'neutral'
    })
    onConsumeStamp?.()
  }, [initialStampNpc, isPlayerMode])

  const stampAtPoint = async (at: Point, overrideBrush?: StampBrush) => {
    const brush = overrideBrush ?? stampBrush
    if (!brush || stampingAt) return
    setStampingAt(true)
    const placeKey = smallestAt(draft.shapes, at)
    try {
      if (brush.source === 'world-npc') {
        const res = await engine('npcs.stamp', {
          world,
          target: brush.id,
          source: 'world-npc',
          count: brush.count,
          faction: brush.faction,
          disposition: brush.disposition,
          map: source.map,
          at,
          place: placeKey
        })
        toast.success(
          'Stamped on Map',
          `${brush.name} ×${res.actorIds.length}${placeKey ? ` at ${placeName(places, placeKey)}` : ` (${at.x}, ${at.y})`}`
        )
      } else {
        const { entry } = await engine('dnd.get', { kind: 'monster', id: brush.id })
        const sheetInput = monsterToSheetInput({
          monster: entry,
          customName: entry.name,
          factionId: brush.faction
        })
        const tempTpl = await engine('npcs.save', {
          world,
          npc: {
            title: sheetInput.title,
            fields: sheetInput.fields,
            values: sheetInput.values,
            dnd: sheetInput.dnd,
            faction: sheetInput.faction,
            disposition: brush.disposition,
            archetype: true
          }
        })
        const res = await engine('npcs.stamp', {
          world,
          target: tempTpl.id,
          source: 'world-npc',
          count: brush.count,
          name: entry.name,
          faction: brush.faction,
          disposition: brush.disposition,
          map: source.map,
          at,
          place: placeKey
        })
        await engine('npcs.delete', { world, id: tempTpl.id })
        toast.success(
          'Stamped on Map',
          `${entry.name} ×${res.actorIds.length}${placeKey ? ` at ${placeName(places, placeKey)}` : ` (${at.x}, ${at.y})`}`
        )
      }
    } catch (err) {
      failed('Could not stamp on map')(err)
    } finally {
      setStampingAt(false)
    }
  }

  const flags = useLive(() => engine('worlds.flags', { id: world }), 'worlds.changed') ?? {}
  const org = useMapOrganise()
  useEscapeLayer(Boolean(org.linking), () => org.setLinking(null))
  const shape = selected ? draft.shapes[selected] : undefined
  const regionShape = selectedRegion ? (draft.regionShapes ?? {})[selectedRegion] : undefined

  const clearOtherSelections = () => {
    setDrawing(null)
    setPendingCreate(null)
    pendingFormRef.current = null
    setPlacingSpawn(false)
    setSelectedTriggerId(null)
    setSelectedSpawnerId(null)
    setSelectedObjectId(null)
    setSelectedCharacterSheet(null)
  }

  const navigateTarget = (next: AtlasTarget | null) => {
    clearOtherSelections()
    if (!next) {
      setHistoryIdx(-1)
      return
    }
    if (activeTarget && activeTarget.kind === next.kind && activeTarget.key === next.key) return
    const sliced = history.slice(0, historyIdx + 1)
    setHistory([...sliced, next])
    setHistoryIdx(sliced.length)
  }

  const select = (key: string | null) => navigateTarget(key ? { kind: 'place', key } : null)
  const selectRegion = (key: string | null) => navigateTarget(key ? { kind: 'region', key } : null)

  const canBack = historyIdx > 0
  const canForward = historyIdx >= 0 && historyIdx < history.length - 1
  const goBack = canBack ? () => { clearOtherSelections(); setHistoryIdx((i) => i - 1) } : null
  const goForward = canForward ? () => { clearOtherSelections(); setHistoryIdx((i) => i + 1) } : null

  const open = Boolean(selected && places[selected])
  const regionOpen = Boolean(selectedRegion && regions[selectedRegion])

  useEscapeLayer(
    ((open || regionOpen) && !drawing && !placingSpawn) ||
      Boolean(pendingCreate) ||
      placingSpawn ||
      activeTool !== 'select' ||
      Boolean(selectedTriggerId) ||
      Boolean(selectedSpawnerId) ||
      Boolean(selectedObjectId) ||
      Boolean(selectedCharacterSheet),
    () => {
      if (placingSpawn) {
        setPlacingSpawn(false)
        return
      }
      if (pendingCreate) {
        setPendingCreate(null)
        pendingFormRef.current = null
        setDrawing(null)
        setActiveTool('select')
        return
      }
      if (activeTool !== 'select') {
        setActiveTool('select')
        return
      }
      navigateTarget(null)
    }
  )

  const setLayerGating = (layerId: string, gating: ConditionGating | null) => {
    const next = { ...(draft.layerGating ?? {}) }
    if (!gating || (!gating.needsFlag && !gating.hiddenIfFlag)) delete next[layerId]
    else next[layerId] = gating
    change({ ...draft, layerGating: next })
  }

  const setShape = (key: string, form: ShapeForm | null) => {
    const { [key]: _old, ...rest } = draft.shapes
    const spawns = { ...(draft.spawns ?? {}) }
    if (!form) {
      delete spawns[key]
      change({ ...draft, shapes: rest, spawns })
      return
    }
    const b = shapeBounds(form)
    const center = { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }
    if (!spawns[key]) spawns[key] = center
    const existingPlace = places[key]
    if (existingPlace && !existingPlace.Region) {
      const enclosingRegion = Object.entries(draft.regionShapes ?? {}).find(([, rf]) => formHas(rf, center))
      if (enclosingRegion) {
        void engine('worlds.put', {
          id: world,
          type: PLACE_TYPE_KEY,
          key,
          entity: { Region: enclosingRegion[0] }
        }).catch(failed('Could not assign region'))
      }
    }
    change({ ...draft, shapes: { ...rest, [key]: form }, spawns })
  }

  const setRegionShape = (key: string, form: ShapeForm | null) => {
    const { [key]: _old, ...rest } = draft.regionShapes ?? {}
    change({ ...draft, regionShapes: form ? { ...rest, [key]: form } : rest })
  }

  // Inline Interactive Creation on Map (No askText dialog — draw zone + spawn directly on canvas!)
  const startCreateRegion = (parentKey = '', at?: Point) => {
    clearOtherSelections()
    setHistoryIdx(-1)
    setPendingCreate({ kind: 'region', name: '', parent: parentKey, region: '', tempForm: null, tempSpawn: null })
    setDrawing({ kind: 'box', ...(at ? { from: at } : {}) })
  }

  const startCreatePlace = (regionKey = '', insideKey: string | null = null, at?: Point) => {
    const inheritedRegion =
      regionKey ||
      selectedRegion ||
      (insideKey && typeof places[insideKey]?.Region === 'string' ? (places[insideKey].Region as string) : '') ||
      (selected && typeof places[selected]?.Region === 'string' ? (places[selected].Region as string) : '')
    clearOtherSelections()
    setHistoryIdx(-1)
    setPendingCreate({
      kind: 'place',
      name: '',
      parent: insideKey ?? '',
      region: inheritedRegion,
      tempForm: null,
      tempSpawn: null
    })
    setDrawing({ kind: 'box', ...(at ? { from: at } : {}) })
  }

  const commitPendingCreate = () => {
    if (!pendingCreate || !pendingCreate.tempForm) return
    const cleanName = pendingCreate.name.trim()
    const key = recordKey(cleanName)
    if (!key) return
    const p = pendingCreate
    const finalForm = p.tempForm!
    setPendingCreate(null)
    pendingFormRef.current = null
    setDrawing(null)
    setPlacingSpawn(false)

    if (p.kind === 'region') {
      void engine('worlds.put', {
        id: world,
        type: REGION_TYPE_KEY,
        key,
        entity: { Name: cleanName, ...(p.parent ? { Parent: p.parent } : {}) }
      })
        .then(() => {
          setRegionShape(key, finalForm)
          change((u) => org.claim(u, mapThingKey(REGION_THING, key)))
          navigateTarget({ kind: 'region', key })
          toast.success('Region Created', cleanName)
        })
        .catch(failed('Could not create region'))
      return
    }

    const b = shapeBounds(finalForm)
    const spawn = p.tempSpawn ?? { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }
    const autoRegion =
      p.region || Object.entries(draft.regionShapes ?? {}).find(([, rf]) => formHas(rf, spawn))?.[0] || ''
    void engine('worlds.put', {
      id: world,
      type: PLACE_TYPE_KEY,
      key,
      entity: {
        Name: cleanName,
        Inside: p.parent,
        ...(autoRegion ? { Region: autoRegion } : {})
      }
    })
      .then(() => {
        change((u) =>
          org.claim(
            {
              ...u,
              shapes: { ...u.shapes, [key]: finalForm },
              spawns: { ...(u.spawns ?? {}), [key]: spawn }
            },
            mapThingKey(PLACE_THING, key)
          )
        )
        navigateTarget({ kind: 'place', key })
        toast.success('Place Created', cleanName)
      })
      .catch(failed('Could not create place'))
  }

  // Object & Spawner & Trigger Handlers
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
    for (const f of layerFlags(draft)) set.add(f)
    for (const t of draft.triggers ?? []) {
      if (t.needsFlag) set.add(t.needsFlag)
      if (t.hiddenIfFlag) set.add(t.hiddenIfFlag)
    }
    return [...set]
  }, [draft.layerGating, draft.propGating, draft.triggers, draft.layers])

  const handleUpdateObject = (next: ObjectLayerData) => {
    changeMap({ ...mapDraft, layers: changeLayer(mapDraft.layers, next.id, () => next) })
  }

  const handleDeleteObject = (id: string) => {
    if (selectedObjectId === id) setSelectedObjectId(null)
    changeMap({ ...mapDraft, layers: changeLayer(mapDraft.layers, id, () => null) })
    change((u) => forgetMapThing(u, mapThingKey(PROP_THING, id)))
  }

  const handleUpdatePropGating = (id: string, gating: ConditionGating | null) => {
    const next = { ...(draft.propGating ?? {}) }
    if (!gating || (!gating.needsFlag && !gating.hiddenIfFlag)) delete next[id]
    else next[id] = gating
    change({ ...draft, propGating: next })
  }

  const worldObjectHandlers = useMemo<MapObjectHandlers>(
    () => ({
      selected: selectedObjectId ?? undefined,
      onPick: (o) => {
        navigateTarget(null)
        setSelectedObjectId(o.id)
      },
      onMenu: (o, e) => {
        openMenu(e, o.name, [
          {
            label: 'Inspect / Configure Object',
            icon: <Box className="h-4 w-4 text-secondary-ink" />,
            onSelect: () => {
              navigateTarget(null)
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
          linkMenuItem(mapThingKey(PROP_THING, o.id)),
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

  const actionsFor = (key: string): MenuItem[] =>
    placeItems({
      world,
      placeKey: key,
      places,
      here: here[key] ?? [],
      shaped: Boolean(draft.shapes[key]),
      player,
      onStart: player ? () => onStart(key) : null,
      onNewInside: () => startCreatePlace('', key),
      onDraw: () => {
        select(key)
        setDrawing({ kind: 'box' })
      },
      onRemoveShape: () => undefined,
      onDeleted: () => {
        if (selected === key) navigateTarget(null)
      }
    })

  const placeMenu = (e: MouseEvent, key: string) =>
    entryMenuAt(e, 'place', placeId(world, key), placeName(places, key), [
      { label: 'Inspect Place', icon: <FolderOpen />, onSelect: () => select(key) },
      {
        label: 'Set Spawn Point on Map',
        icon: <Crosshair />,
        onSelect: () => {
          select(key)
          setPlacingSpawn(true)
        }
      },
      ...actionsFor(key)
    ])

  const regionMenu = (e: MouseEvent, key: string) => {
    const label = placeName(regions, key)
    const hasZone = Boolean((draft.regionShapes ?? {})[key])
    entryMenuAt(e, 'world', `${world}/region/${key}`, label, [
      { label: 'Inspect Region', icon: <FolderOpen />, onSelect: () => selectRegion(key) },
      {
        label: hasZone ? 'Redraw Region Zone' : 'Draw Region Zone',
        icon: <PenLine />,
        onSelect: () => {
          selectRegion(key)
          setDrawing({ kind: 'box' })
        }
      },
      { label: `New Subregion inside ${label}`, icon: <Layers />, onSelect: () => startCreateRegion(key) },
      { label: `New Place in ${label}`, icon: <MapPin />, onSelect: () => startCreatePlace(key, null) },
      {
        label: 'Delete Region',
        icon: <Trash2 />,
        danger: true,
        onSelect: () =>
          confirmDelete(`Delete region "${label}"?`, 'Subregions and places inside it move up, and its zone comes off maps.', () =>
            engine('worlds.remove', { id: world, type: REGION_TYPE_KEY, key }).then(() => {
              if (selectedRegion === key) navigateTarget(null)
            })
          )
      }
    ])
  }

  const characterMenu = (e: MouseEvent, v: PlaceVisitor, at: string) =>
    openMenu(e, v.name, characterItems(v, places, at, world))

  const people = useMapTokens({
    world,
    use: draft,
    places,
    player,
    editing: true,
    save: (next) => change(Object.keys(draft.stand).filter((k) => !(k in next.stand)).reduce((u, k) => forgetMapThing(u, mapThingKey(TOKEN_THING, k)), next)),
    onSelect: (sheet) => {
      navigateTarget(null)
      setSelectedCharacterSheet(sheet)
      const st = draft.stand[sheet]
      if (st?.at) panTo(st.at)
    }
  })

  const selectedToken = useMemo(
    () => people.tokens.find((t) => t.visitor.sheet === selectedCharacterSheet) ?? null,
    [people.tokens, selectedCharacterSheet]
  )

  const thingNames = useMemo(() => {
    const names: Record<string, { label: string }> = {}
    for (const k of Object.keys(draft.shapes)) names[mapThingKey(PLACE_THING, k)] = { label: placeName(places, k) }
    for (const k of Object.keys(draft.regionShapes ?? {})) names[mapThingKey(REGION_THING, k)] = { label: placeName(regions, k) }
    for (const t of draft.triggers ?? []) names[mapThingKey(TRIGGER_THING, t.id)] = { label: t.name }
    for (const s of mapDraft.spawners ?? []) names[mapThingKey(SPAWNER_THING, s.id)] = { label: s.name }
    for (const o of mapObjects(mapDraft.layers)) names[mapThingKey(PROP_THING, o.id)] = { label: o.name }
    for (const t of people.tokens) names[mapThingKey(TOKEN_THING, t.visitor.token)] = { label: showName(t.visitor.name) }
    return names
  }, [draft.shapes, draft.regionShapes, draft.triggers, mapDraft.spawners, mapDraft.layers, people.tokens, places, regions])
  const nameOf = (key: string) => thingNames[key]?.label ?? key
  const pieceSources = useMemo(
    () =>
      new Map<string, ComponentDef[]>([
        ...mapObjects(mapDraft.layers).map((o): [string, ComponentDef[]] => [mapThingKey(PROP_THING, o.id), o.comps ?? []]),
        ...(draft.triggers ?? []).map((t): [string, ComponentDef[]] => [mapThingKey(TRIGGER_THING, t.id), [...t.comps, ...cleanComponents(t.values.effects)]])
      ]),
    [mapDraft.layers, draft.triggers]
  )
  const piecesOf = (key: string) => pieceSources.get(key) ?? []
  const linkFocus = [...org.selection, ...(selectedObjectId ? [mapThingKey(PROP_THING, selectedObjectId)] : []), ...(selectedTriggerId ? [mapThingKey(TRIGGER_THING, selectedTriggerId)] : [])]
  const linkTo = (from: string) => org.setLinking(from)
  const linkMenuItem = (key: string): MenuItem => ({ label: 'Link to…', icon: <Cable className="h-4 w-4 text-accent" />, onSelect: () => linkTo(key) })
  const interceptLink =
    org.linking || activeTool === 'link'
      ? (thing: MapThing) => {
          if (!linkableThing(thing.key)) {
            toast.info("Can't link that", 'Links join props and triggers.')
            return true
          }
          // Stage 1 -> Stage 2: Pick Source
          if (!org.linking) {
            org.setLinking(thing.key)
            return true
          }
          // Stage 2 -> Complete Link
          const from = org.linking
          if (from === thing.key) {
            toast.info('Pick a different target', 'Choose another prop or trigger to link to.')
            return true
          }
          change((u) => org.linked(u, from, thing.key))
          org.setLinking(null)
          return true
        }
      : undefined
  const selectionMenu = (e: MouseEvent, keys: string[]) =>
    openMenu(e, `${keys.length} selected`, [
      ...(keys.length === 2 && keys.every(linkableThing) ? [{ label: `Link ${nameOf(keys[0])} → ${nameOf(keys[1])}`, icon: <Cable />, onSelect: () => change((u) => org.linked(u, keys[0], keys[1])) }] : []),
      ...(keys.some((k) => draft.layerOf?.[k])
        ? [{ label: 'Remove from layer', icon: <Undo2 />, onSelect: () => change((u) => ({ ...u, layerOf: Object.fromEntries(Object.entries(u.layerOf ?? {}).filter(([k]) => !keys.includes(k))) })) }]
        : []),
      { label: 'Clear selection', icon: <X />, onSelect: () => org.setSelection([]) }
    ])
  const linkMenu = (e: MouseEvent, link: MapLink) =>
    openMenu(e, `${nameOf(link.from)} → ${nameOf(link.to)}`, [{ label: 'Remove link', icon: <Trash2 />, danger: true, onSelect: () => change((u) => org.unlinked(u, link.id)) }])
  const wiring = (key: string, comps: ComponentDef[], onComps: (next: ComponentDef[]) => void) =>
    wiringTabs({
      thing: key,
      links: draft.links ?? [],
      name: nameOf,
      piecesOf,
      comps,
      onComps,
      onStartLink: () => linkTo(key),
      onUnlink: (id) => change((u) => org.unlinked(u, id))
    })

  const selectedPlaceKeyForToken = useMemo(() => {
    if (!selectedToken) return null
    return smallestAt(draft.shapes, selectedToken.at)
  }, [selectedToken, draft.shapes])

  const selectedRegionKeyForToken = useMemo(() => {
    if (!selectedToken || selectedPlaceKeyForToken) return null
    return smallestAt(draft.regionShapes ?? {}, selectedToken.at)
  }, [selectedToken, selectedPlaceKeyForToken, draft.regionShapes])

  const tokenLocationLabel = (at: Point): { text: string; tone: 'place' | 'region' | 'wilderness' } => {
    const pKey = smallestAt(draft.shapes, at)
    if (pKey) return { text: placeName(places, pKey), tone: 'place' }
    const rKey = smallestAt(draft.regionShapes ?? {}, at)
    if (rKey) return { text: placeName(regions, rKey), tone: 'region' }
    return { text: 'Wilderness', tone: 'wilderness' }
  }

  const mapMenu = (e: MouseEvent, at: Point) =>
    openMenu(e, showName(mapDraft.name), [
      {
        label: 'Stamp NPC / Creature here…',
        icon: <Stamp className="h-4 w-4 text-accent" />,
        inlineTitle: `Stamp at (${Math.round(at.x)}, ${Math.round(at.y)})`,
        inlinePanel: (close) => (
          <StampPickerPanel
            worldId={world}
            value={stampBrush}
            onPick={(brush) => {
              setStampBrush(brush)
              void stampAtPoint(at, brush)
              close()
            }}
            actionHint="Click any entry to stamp immediately here"
          />
        )
      },
      {
        label: 'Draw Zone',
        icon: <Layers className="h-4 w-4 text-accent-soft" />,
        children: [
          { label: 'New Region / Area here…', icon: <Layers />, onSelect: () => startCreateRegion('', at) },
          { label: 'New Place here…', icon: <MapPin />, onSelect: () => startCreatePlace('', null, at) },
          ...(selected
            ? [{ label: `New Room inside ${placeName(places, selected)}…`, icon: <Plus />, onSelect: () => startCreatePlace('', selected, at) }]
            : [])
        ]
      },
      {
        label: 'Place on Map',
        icon: <Plus className="h-4 w-4 text-secondary-ink" />,
        children: [
          people.putHere(at),
          people.spawnCreatureHere(at),
          { label: '', separator: true },
          { label: 'Prop / Predefined Object…', icon: <Box className="h-4 w-4 text-secondary-ink" />, onSelect: () => setAddObjectAt(at) },
          { label: 'Trigger Zone…', icon: <Zap className="h-4 w-4 text-accent" />, onSelect: () => setAddTriggerAt(at) },
          { label: 'Creature Spawner…', icon: <Skull className="h-4 w-4 text-alert" />, onSelect: () => setAddSpawnerAt(at) }
        ]
      },
      { label: '', separator: true },
      {
        label: 'Map',
        icon: <FolderOpen className="h-4 w-4 text-dim" />,
        children: [
          { label: 'Open in Map Blueprint Editor', icon: <ExternalLink className="h-4 w-4" />, onSelect: () => openEntry('map', source.map) },
          { label: '', separator: true },
          {
            label: `Remove ${showName(mapDraft.name)} from World`,
            icon: <Unlink className="h-4 w-4 text-alert" />,
            danger: true,
            onSelect: () =>
              confirmDelete(
                `Remove ${showName(mapDraft.name)} from this world?`,
                "This world's zones drawn on it will be detached; the map itself remains safe in Maps.",
                () => engine('worlds.dropMap', { id: world, map: source.map }),
                undefined,
                'Remove from World'
              )
          }
        ]
      }
    ])

  const pendingKey = pendingCreate ? recordKey(pendingCreate.name.trim() || `new_${pendingCreate.kind}`) || `new_${pendingCreate.kind}` : null
  const activeShapeKey = pendingKey ?? selectedRegion ?? selected
  const activeShapeForm = pendingCreate ? pendingCreate.tempForm : selectedRegion ? regionShape : shape
  const selectedLabel = pendingCreate
    ? pendingCreate.kind === 'region'
      ? `Region · ${pendingCreate.name.trim() || 'New Region'}`
      : pendingCreate.name.trim() || 'New Place'
    : selectedRegion
      ? `Region · ${placeName(regions, selectedRegion)}`
      : selected
        ? placeName(places, selected)
        : ''
  const selectedSpawn = pendingCreate
    ? pendingCreate.tempSpawn
    : selected
      ? (draft.spawns?.[selected] ?? (shape ? { x: Math.round(shapeBounds(shape).x + shapeBounds(shape).w / 2), y: Math.round(shapeBounds(shape).y + shapeBounds(shape).h / 2) } : null))
      : null

  const area = mapArea(mapDraft)

  const canvasClickToolActive =
    !isPlayerMode &&
    !drawing &&
    !placingSpawn &&
    !pendingCreate &&
    ((activeTool === 'stamp' && Boolean(stampBrush)) ||
      activeTool === 'character' ||
      activeTool === 'spawner' ||
      activeTool === 'trigger' ||
      activeTool === 'prop')

  const armSwallowContextMenu = () => {
    swallowNextContextMenuRef.current = true
    let done = false
    const swallow = (ev: globalThis.MouseEvent) => {
      if (done) return
      done = true
      swallowNextContextMenuRef.current = false
      ev.preventDefault()
      ev.stopPropagation()
      ev.stopImmediatePropagation()
      window.removeEventListener('contextmenu', swallow, true)
    }
    window.addEventListener('contextmenu', swallow, true)
    window.setTimeout(() => {
      if (done) return
      done = true
      swallowNextContextMenuRef.current = false
      window.removeEventListener('contextmenu', swallow, true)
    }, 400)
  }

  const hasActiveCanvasMode =
    placingSpawn || Boolean(org.linking) || Boolean(drawing) || Boolean(pendingCreate) || activeTool !== 'select'

  const cancelActiveCanvasMode = () => {
    if (placingSpawn) {
      setPlacingSpawn(false)
      return
    }
    if (org.linking) {
      org.setLinking(null)
      return
    }
    if (drawing || pendingCreate) {
      setDrawing(null)
      setPendingCreate(null)
      pendingFormRef.current = null
      return
    }
    if (activeTool !== 'select') {
      setActiveTool('select')
    }
  }

  const handleCanvasToolPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      e.preventDefault()
      e.stopPropagation()
      armSwallowContextMenu()
      setActiveTool('select')
      return
    }
    if (e.button !== 0) return
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width / Math.max(1, area.w)
    const at: Point = {
      x: Math.round((e.clientX - rect.left) / scale),
      y: Math.round((e.clientY - rect.top) / scale)
    }
    if (activeTool === 'stamp') {
      void stampAtPoint(at)
      return
    }
    if (activeTool === 'character') {
      people.putHere(at).onSelect?.()
      setActiveTool('select')
      return
    }
    if (activeTool === 'spawner') {
      setAddSpawnerAt(at)
      setActiveTool('select')
      return
    }
    if (activeTool === 'trigger') {
      setAddTriggerAt(at)
      setActiveTool('select')
      return
    }
    if (activeTool === 'prop') {
      setAddObjectAt(at)
      setActiveTool('select')
    }
  }

  const handleSelectCanvasTool = (tool: AtlasCanvasTool) => {
    if (tool === 'region') {
      setActiveTool('select')
      startCreateRegion()
      return
    }
    if (tool === 'place') {
      setActiveTool('select')
      startCreatePlace()
      return
    }
    if (tool === activeTool && tool !== 'select') {
      setActiveTool('select')
      return
    }
    setActiveTool(tool)
  }

  const shapeOverlay =
    activeShapeKey && (activeShapeForm || drawing) ? (
      <ShapeEditor
        size={area}
        shapes={
          pendingCreate
            ? pendingCreate.tempForm && !drawing
              ? [{ id: activeShapeKey, label: selectedLabel, form: pendingCreate.tempForm }]
              : []
            : activeShapeForm && !drawing
              ? [{ id: activeShapeKey, label: selectedLabel, form: activeShapeForm }]
              : []
        }
        onChange={(list) => {
          const latest = list[list.length - 1]
          if (pendingCreate) {
            pendingFormRef.current = latest?.form ?? null
            if (latest?.form) {
              const b = shapeBounds(latest.form)
              const center = { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }
              const autoReg =
                pendingCreate.kind === 'place' && !pendingCreate.region
                  ? Object.entries(draft.regionShapes ?? {}).find(([, rf]) => formHas(rf, center))?.[0] ?? ''
                  : pendingCreate.region
              setPendingCreate((prev) =>
                prev
                  ? {
                      ...prev,
                      tempForm: latest.form,
                      tempSpawn: prev.kind === 'place' ? (prev.tempSpawn ?? center) : null,
                      region: autoReg
                    }
                  : null
              )
            }
            return
          }
          if (!latest) return
          if (selectedRegion) setRegionShape(selectedRegion, latest.form)
          else if (selected) setShape(selected, latest.form)
        }}
        selected={activeShapeKey}
        onSelect={() => undefined}
        drawing={drawing?.kind ?? null}
        from={drawing?.from}
        onDrawn={(drawnId) => {
          if (pendingCreate) {
            const finalForm = pendingFormRef.current ?? pendingCreate.tempForm
            pendingFormRef.current = null
            if (drawnId && finalForm) {
              const b = shapeBounds(finalForm)
              const center = { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }
              setPendingCreate((prev) =>
                prev
                  ? {
                      ...prev,
                      tempForm: finalForm,
                      tempSpawn: prev.kind === 'place' ? (prev.tempSpawn ?? center) : null
                    }
                  : null
              )
            }
            setDrawing(null)
            return
          }
          setDrawing(null)
        }}
        newLabel={selectedLabel}
        newId={() => activeShapeKey}
        passThrough={!drawing && !placingSpawn}
        onMenu={pendingCreate ? undefined : selectedRegion ? regionMenu : placeMenu}
        marks={() => (
          <>
            {layerVis.spawns &&
              ((pendingCreate?.kind === 'place' && pendingCreate.tempSpawn) || (selected && !selectedRegion && selectedSpawn)) && (
                <div
                  style={{ left: selectedSpawn!.x, top: selectedSpawn!.y }}
                  title={`Spawn point (${selectedSpawn!.x}, ${selectedSpawn!.y})`}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 border border-ok tone-well-90 px-1.5 py-0.5 font-label text-[9px] font-bold caps-5 text-ok shadow"
                >
                  <Crosshair className="h-3 w-3" />
                  <span>
                    {selectedSpawn!.x},{selectedSpawn!.y}
                  </span>
                </div>
              )}
            {selected && !selectedRegion && !pendingCreate && here[selected]?.length ? (
              <PresenceMarkers visitors={here[selected]} onMenu={(e, v) => characterMenu(e, v, selected)} />
            ) : null}
          </>
        )}
        className="absolute left-0 top-0"
      >
        <div
          style={{ width: area.w, height: area.h }}
          onPointerDown={
            placingSpawn && (pendingCreate?.kind === 'place' || (selected && !selectedRegion))
              ? (e) => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const scale = rect.width / Math.max(1, area.w)
                  const x = Math.round((e.clientX - rect.left) / scale)
                  const y = Math.round((e.clientY - rect.top) / scale)
                  if (pendingCreate) {
                    setPendingCreate((prev) => (prev ? { ...prev, tempSpawn: { x, y } } : null))
                  } else if (selected) {
                    change({ ...draft, spawns: { ...(draft.spawns ?? {}), [selected]: { x, y } } })
                    toast.success('Spawn Point Set', `${placeName(places, selected)} (${x}, ${y})`)
                  }
                  setPlacingSpawn(false)
                }
              : undefined
          }
          className={placingSpawn ? 'relative z-[20] pointer-events-auto cursor-crosshair' : undefined}
        />
      </ShapeEditor>
    ) : undefined

  const overlay = (
    <>
      {shapeOverlay}
      {canvasClickToolActive && (
        <div
          style={{ width: area.w, height: area.h }}
          onPointerDown={handleCanvasToolPointerDown}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setActiveTool('select')
          }}
          className="absolute left-0 top-0 z-[25] cursor-crosshair"
        />
      )}
    </>
  )

  const parsedFilter = useMemo(() => parseTokenFilter(filterRaw), [filterRaw])
  const effectiveTypes = [...new Set([...filterTypes, ...parsedFilter.types])]
  const showRegionsInTree = effectiveTypes.length === 0 || effectiveTypes.includes('region')
  const showPlacesInTree = effectiveTypes.length === 0 || effectiveTypes.includes('place')

  const unassignedPlaces = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(places).filter(([, p]) => {
          const r = typeof p.Region === 'string' ? p.Region : ''
          return !r || !(r in regions)
        })
      ),
    [places, regions]
  )

  const allRailTabs: { id: RailTabId; label: string; heading: string; icon: typeof Layers; count: number }[] = [
    {
      id: 'atlas',
      label: 'Atlas',
      heading: 'Regions & Places',
      icon: MapPin,
      count: Object.keys(regions).length + Object.keys(places).length
    },
    { id: 'characters', label: 'Tokens', heading: 'Map Characters', icon: Users, count: people.tokens.length },
    { id: 'spawners', label: 'Spawners', heading: 'Creature Spawners', icon: Skull, count: (mapDraft.spawners ?? []).length },
    { id: 'triggers', label: 'Triggers', heading: 'Map Triggers', icon: Zap, count: (draft.triggers ?? []).length },
    { id: 'objects', label: 'Props', heading: 'Map Props & Objects', icon: Box, count: mapObjects(mapDraft.layers).length },
    { id: 'layers', label: 'Layers', heading: 'World Layers', icon: Layers3, count: (draft.layers ?? []).length }
  ]
  const railTabs = isPlayerMode ? allRailTabs.filter((t) => t.id === 'atlas' || t.id === 'characters') : allRailTabs
  const activeRail = railTabs.find((t) => t.id === railTab) ?? railTabs[0]

  const canConfirmCreate = Boolean(
    pendingCreate && pendingCreate.name.trim() && recordKey(pendingCreate.name.trim()) && pendingCreate.tempForm
  )

  return (
    <CanvasStoreContext.Provider value={canvasStore}>
    <div className="flex min-h-0 flex-1 overflow-hidden tone-panel-40">
      {!treeOpen && (
        <button
          type="button"
          onClick={() => setTreeOpen(true)}
          title="Expand Atlas left panel"
          className="flex w-7 shrink-0 flex-col items-center border-r border-line/60 tone-sidebar-95 pt-2.5 text-dim transition-colors hover:bg-accent/10 hover:text-accent cursor-pointer"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      )}

      <Split className="min-h-0 min-w-0 flex-1">
        {/* SINGLE COLLAPSIBLE & RESIZABLE SPATIAL HIERARCHY RAIL */}
        <ListPane
          id="world-atlas-tree"
          open={treeOpen}
          width={treeWidth}
          min={220}
          max={440}
          reset={268}
          onWidth={setTreeWidth}
          onClose={() => setTreeOpen(false)}
        >
          <div className="flex h-full min-h-0 flex-col tone-sidebar-60 font-ui select-none">
            <div className="flex flex-col gap-2 border-b border-line/40 tone-panel-50 p-2">
              <div className="flex items-center gap-1">
                <div className={cn('grid flex-1 border border-line/50 tone-well-40', isPlayerMode ? 'grid-cols-2' : 'grid-cols-6')}>
                  {railTabs.map((t) => {
                    const Icon = t.icon
                    const active = railTab === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        title={`${t.label} (${t.count})`}
                        onClick={() => setRailTab(t.id)}
                        className={cn(
                          'flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors cursor-pointer',
                          active ? 'bg-accent/15 text-ink shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-dim hover:bg-ink/[0.04] hover:text-ink'
                        )}
                      >
                        <Icon className={cn('h-3.5 w-3.5', active ? 'text-accent' : 'text-faint')} />
                        <span className="font-data text-[9.5px] leading-none">{t.count}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setTreeOpen(false)}
                  title="Collapse left panel"
                  className="flex h-8 w-7 shrink-0 items-center justify-center border border-line/50 tone-well-40 text-dim transition-colors hover:border-accent hover:text-accent cursor-pointer"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-1 px-1 text-[11px]">
                <span className="truncate font-bold caps text-dim">{activeRail.heading}</span>
                {!isPlayerMode && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      title="Open this map in the Map Editor"
                      onClick={() => openEntry('map', source.map)}
                      className="p-0.5 text-dim hover:text-accent cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Configure map layer visibility &amp; flag gating rules"
                      onClick={() => setGatingOpen(true)}
                      className="flex items-center gap-1 font-ui text-[10.5px] text-secondary-ink hover:text-ink cursor-pointer"
                    >
                      <Layers className="h-3 w-3" />
                      <span>Gating</span>
                    </button>
                  </div>
                )}
              </div>

              {railTab === 'atlas' && (
                <>
                  <TokenFilterInput
                    compact
                    value={filterRaw}
                    onChange={setFilterRaw}
                    types={filterTypes}
                    onTypesChange={setFilterTypes}
                    tags={filterTags}
                    onTagsChange={setFilterTags}
                    typeOptions={[
                      { id: 'region', count: Object.keys(regions).length },
                      { id: 'place', count: Object.keys(places).length }
                    ]}
                    placeholder="Filter regions &amp; places…"
                  />
                  {!isPlayerMode && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button size="sm" variant="secondary" icon={<Layers />} onClick={() => startCreateRegion()} className="justify-center">
                        + Region
                      </Button>
                      <Button size="sm" variant="primary" icon={<MapPin />} onClick={() => startCreatePlace()} className="justify-center">
                        + Place
                      </Button>
                    </div>
                  )}
                </>
              )}

              {!isPlayerMode && railTab === 'characters' && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus />}
                  onClick={() => setActiveTool('character')}
                  className="justify-center"
                >
                  Click Map to Place Actor
                </Button>
              )}
              {!isPlayerMode && railTab === 'spawners' && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus />}
                  onClick={() => setActiveTool('spawner')}
                  className="justify-center"
                >
                  Click Map to Place Spawner
                </Button>
              )}
              {!isPlayerMode && railTab === 'triggers' && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus />}
                  onClick={() => setActiveTool('trigger')}
                  className="justify-center"
                >
                  Click Map to Place Trigger
                </Button>
              )}
              {!isPlayerMode && railTab === 'objects' && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus />}
                  onClick={() => setActiveTool('prop')}
                  className="justify-center"
                >
                  Click Map to Place Prop
                </Button>
              )}
            </div>

            {/* RAIL SCROLLABLE LIST */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1">
              {railTab === 'layers' && (
                <LayerTree
                  world={world}
                  use={draft}
                  names={thingNames}
                  flags={flags}
                  active={org.active}
                  onActive={org.setActive}
                  onChange={(patch) => change((u) => ({ ...u, ...patch }))}
                  selection={org.selection}
                  onSelection={org.setSelection}
                />
              )}
              {railTab === 'atlas' && (
                <>
                  {Object.keys(regions).length === 0 && Object.keys(places).length === 0 ? (
                    <div className="p-3 text-[11.5px] text-faint">
                      Click + Region to divide this map into areas, then + Place to draw places and their character spawn points inside them.
                    </div>
                  ) : (
                    <>
                      <SpatialRegionSubtree
                        nodes={regionTree(regions, draft.regionShapes ?? {})}
                        places={places}
                        shapes={draft.shapes}
                        here={here}
                        activeTarget={activeTarget}
                        filterText={parsedFilter.text}
                        showRegions={showRegionsInTree}
                        showPlaces={showPlacesInTree}
                        depth={0}
                        onPickRegion={selectRegion}
                        onRegionMenu={regionMenu}
                        onPickPlace={select}
                        onPlaceMenu={placeMenu}
                        onAddPlaceInRegion={(rKey) => startCreatePlace(rKey, null)}
                      />

                      {showPlacesInTree && Object.keys(unassignedPlaces).length > 0 && (
                        <div className="mt-1 border-t border-line/30 pt-1">
                          {Object.keys(regions).length > 0 && (
                            <div className="px-2.5 py-1 font-label text-[9.5px] font-bold caps-8 text-faint">Unassigned Places</div>
                          )}
                          <SpatialPlaceSubtree
                            nodes={placeTree(unassignedPlaces, draft.shapes)}
                            here={here}
                            activeTarget={activeTarget}
                            filterText={parsedFilter.text}
                            depth={0}
                            onPickPlace={select}
                            onPlaceMenu={placeMenu}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {railTab === 'characters' && (
                <div className="flex flex-col divide-y divide-line/30">
                  {people.tokens.length === 0 ? (
                    <div className="p-4 text-center text-[11px] text-dim">No characters stationed on this map yet.</div>
                  ) : (
                    people.tokens.map((t) => {
                      const isSel = selectedCharacterSheet === t.visitor.sheet
                      const isPlayer = player === t.visitor.sheet
                      const hp = t.visitor.dnd?.hp ? `${t.visitor.dnd.hp.cur}/${t.visitor.dnd.hp.max} HP` : null
                      const loc = tokenLocationLabel(t.at)
                      return (
                        <button
                          key={t.visitor.sheet}
                          type="button"
                          {...dragProps({ things: [mapThingKey(TOKEN_THING, t.visitor.token)] })}
                          onClick={() => {
                            navigateTarget(null)
                            setSelectedCharacterSheet(t.visitor.sheet)
                            panTo(t.at)
                          }}
                          className={cn(
                            'flex items-center gap-2 p-2 text-left transition-colors font-ui cursor-pointer',
                            isSel ? 'border-l-2 border-l-accent bg-accent/15 text-ink' : 'text-dim hover:tone-card-40 hover:text-ink'
                          )}
                        >
                          <SheetPortrait image={t.visitor.image} className={cn('h-7 w-7 shrink-0 border', isPlayer ? 'border-accent' : 'border-line/40')} />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[12px] font-semibold text-ink">{t.visitor.name}</span>
                            <span className="truncate text-[10px] text-faint">
                              <span
                                className={cn(
                                  loc.tone === 'place'
                                    ? 'text-accent-soft'
                                    : loc.tone === 'region'
                                      ? 'text-purple-300'
                                      : 'text-dim'
                                )}
                              >
                                {loc.text}
                              </span>
                              {hp ? ` · ${hp}` : ''}
                            </span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {railTab === 'spawners' && (
                <div className="flex flex-col divide-y divide-line/30">
                  {(mapDraft.spawners ?? []).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      {...dragProps({ things: [mapThingKey(SPAWNER_THING, s.id)] })}
                      onClick={() => {
                        navigateTarget(null)
                        setSelectedSpawnerId(s.id)
                      }}
                      className={cn(
                        'flex flex-col gap-0.5 p-2 text-left transition-colors cursor-pointer',
                        selectedSpawnerId === s.id ? 'border-l-2 border-l-alert bg-alert/10 text-ink' : 'text-dim hover:tone-card-40 hover:text-ink'
                      )}
                    >
                      <span className="truncate text-[12px] font-semibold text-ink">{s.name}</span>
                      <span className="truncate text-[10px] text-faint">{s.monsterId} · ({s.at.x}, {s.at.y})</span>
                    </button>
                  ))}
                </div>
              )}

              {railTab === 'triggers' && (
                <div className="flex flex-col divide-y divide-line/30">
                  {(draft.triggers ?? []).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      {...dragProps({ things: [mapThingKey(TRIGGER_THING, t.id)] })}
                      onClick={() => {
                        navigateTarget(null)
                        setSelectedTriggerId(t.id)
                      }}
                      className={cn(
                        'flex flex-col gap-0.5 p-2 text-left transition-colors cursor-pointer',
                        selectedTriggerId === t.id ? 'border-l-2 border-l-accent bg-accent/15 text-ink' : 'text-dim hover:tone-card-40 hover:text-ink'
                      )}
                    >
                      <span className="truncate text-[12px] font-semibold text-ink">{t.name}</span>
                      <span className="truncate text-[10px] caps text-faint">{t.type} · {t.fires}</span>
                    </button>
                  ))}
                </div>
              )}

              {railTab === 'objects' && (
                <div className="flex flex-col divide-y divide-line/30">
                  {mapObjects(mapDraft.layers).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      {...dragProps({ things: [mapThingKey(PROP_THING, o.id)] })}
                      onClick={() => {
                        navigateTarget(null)
                        setSelectedObjectId(o.id)
                      }}
                      className={cn(
                        'flex flex-col gap-0.5 p-2 text-left transition-colors cursor-pointer',
                        selectedObjectId === o.id ? 'border-l-2 border-l-secondary-ink bg-secondary/15 text-ink' : 'text-dim hover:tone-card-40 hover:text-ink'
                      )}
                    >
                      <span className="truncate text-[12px] font-semibold text-ink">{o.name}</span>
                      <span className="truncate text-[10px] text-faint">({o.offset.x}, {o.offset.y}) · {o.collision}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* COLLAPSIBLE OVERLAY VISIBILITY & LOCK STACK (CanvasLayerList) */}
            <div className="border-t border-line/40 tone-well-50">
              <button
                type="button"
                onClick={() => setOverlaysExpanded(!overlaysExpanded)}
                className="flex w-full items-center justify-between px-2.5 py-1.5 text-left font-label text-[9.5px] font-bold caps-8 text-dim hover:text-ink cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-accent-soft" />
                  <span>Overlays &amp; Locks</span>
                </span>
                {overlaysExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {overlaysExpanded ? (
                <div className="max-h-48 overflow-y-auto border-t border-line/30">
                  <CanvasLayerList reorderable={false} />
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 px-2 pb-2">
                  {canvasLayers.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      title={`${l.label}: click to ${l.visible ? 'hide' : 'show'}${l.locked ? ' (Locked)' : ''}`}
                      onClick={() => canvasStore.getState().toggleLayerVisible(l.id)}
                      className={cn(
                        'border px-1.5 py-0.5 font-label text-[9px] font-bold caps-5 transition-colors cursor-pointer',
                        l.locked
                          ? 'border-warn/60 bg-warn/10 text-warn'
                          : l.visible
                            ? 'border-accent/60 bg-accent/12 text-accent'
                            : 'border-line/30 text-faint hover:text-dim'
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ListPane>

        {/* FULL-HEIGHT MAP VIEWPORT + INDEPENDENT RIGHT DRAWER */}
        <MainPane id="world-atlas-canvas" className="relative flex min-h-0 min-w-0 flex-1 !flex-row overflow-hidden">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* INLINE CREATION HUD BAR ABOVE MAP CANVAS */}
            {pendingCreate && (
              <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-accent/70 tone-panel-95 px-3 py-2 font-ui">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-accent bg-accent/15 px-2 py-0.5 font-label text-[10px] font-bold caps-8 text-accent">
                    {pendingCreate.kind === 'region' ? 'New Region' : 'New Place'}
                  </span>
                  <div className="w-48">
                    <LinkTextarea
                      autoFocus
                      rolls={false}
                      rows={1}
                      value={pendingCreate.name}
                      onValue={(name) => setPendingCreate((prev) => (prev ? { ...prev, name } : null))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && canConfirmCreate) {
                          e.preventDefault()
                          commitPendingCreate()
                        }
                      }}
                      placeholder={pendingCreate.kind === 'region' ? 'Region name…' : 'Place name…'}
                      className="min-h-0 resize-none"
                    />
                  </div>

                  {drawing ? (
                    <Segmented
                      value={drawing.kind}
                      options={FORMS}
                      onChange={(kind) => setDrawing({ kind, from: drawing.from })}
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<PenLine />}
                      onClick={() => {
                        setPendingCreate((prev) => (prev ? { ...prev, tempForm: null } : null))
                        setDrawing({ kind: 'box' })
                      }}
                    >
                      Redraw Zone
                    </Button>
                  )}

                  {pendingCreate.kind === 'region' ? (
                    <div className="w-40">
                      <WorldRegionPick
                        world={world}
                        value={pendingCreate.parent || null}
                        placeholder="Top-level region"
                        onChange={(parent) => setPendingCreate((prev) => (prev ? { ...prev, parent: parent ?? '' } : null))}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="w-40">
                        <WorldRegionPick
                          world={world}
                          value={pendingCreate.region || null}
                          placeholder="Auto / Region…"
                          onChange={(region) => setPendingCreate((prev) => (prev ? { ...prev, region: region ?? '' } : null))}
                        />
                      </div>
                      <div className="w-40">
                        <WorldPlacePick
                          world={world}
                          value={pendingCreate.parent || null}
                          placeholder="Inside place…"
                          onChange={(parent) => setPendingCreate((prev) => (prev ? { ...prev, parent: parent ?? '' } : null))}
                        />
                      </div>
                      {pendingCreate.tempForm && (
                        <Button
                          size="sm"
                          variant={placingSpawn ? 'primary' : 'secondary'}
                          icon={<Crosshair />}
                          onClick={() => setPlacingSpawn((v) => !v)}
                        >
                          {placingSpawn ? 'Click Map…' : 'Move Spawn'}
                        </Button>
                      )}
                    </>
                  )}

                  {!pendingCreate.tempForm && (
                    <span className="text-[11px] text-secondary-ink">
                      {drawing?.kind === 'outline' ? 'Click points on map, double-click to close' : 'Drag on map to define required zone'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Check />}
                    disabled={!canConfirmCreate}
                    onClick={commitPendingCreate}
                    title={!pendingCreate.name.trim() ? 'Enter a name' : !pendingCreate.tempForm ? 'Draw the zone on the map first' : undefined}
                  >
                    Create
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<X />}
                    onClick={() => {
                      setPendingCreate(null)
                      pendingFormRef.current = null
                      setDrawing(null)
                      setPlacingSpawn(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {mapDraft.layers.length ? (
              <div
                onContextMenuCapture={(e) => {
                  if (swallowNextContextMenuRef.current) {
                    swallowNextContextMenuRef.current = false
                    e.preventDefault()
                    e.stopPropagation()
                    return
                  }
                  if (hasActiveCanvasMode) {
                    e.preventDefault()
                    e.stopPropagation()
                    cancelActiveCanvasMode()
                  }
                }}
                className="relative min-h-0 flex-1"
              >
                <MapCanvas
                  map={mapDraft}
                  shapes={layerVis.places ? draft.shapes : {}}
                  regionShapes={layerVis.regions ? (draft.regionShapes ?? {}) : {}}
                  places={places}
                  regions={regions}
                  here={here}
                  place={`world.${world}.${mapDraft.id}`}
                  focus={cameraFocus}
                  suspendHits={Boolean(drawing || placingSpawn || pendingCreate || canvasClickToolActive)}
                  selected={selected}
                  selectedRegion={selectedRegion}
                  onPick={layerLocked.places ? undefined : (s) => select(s.id)}
                  onPickRegion={layerLocked.regions ? undefined : (s) => selectRegion(s.id)}
                  onBlank={
                    drawing || pendingCreate
                      ? undefined
                      : () => {
                          navigateTarget(null)
                        }
                  }
                  onShapeMenu={hasActiveCanvasMode || layerLocked.places ? undefined : (e, s) => placeMenu(e, s.id)}
                  onRegionMenu={hasActiveCanvasMode || layerLocked.regions ? undefined : (e, s) => regionMenu(e, s.id)}
                  onBlankMenu={hasActiveCanvasMode ? undefined : mapMenu}
                  onCharacterMenu={hasActiveCanvasMode || layerLocked.tokens ? undefined : characterMenu}
                  objects={layerLocked.props ? undefined : worldObjectHandlers}
                  tokens={layerVis.tokens ? people.tokens : []}
                  onToken={layerLocked.tokens ? undefined : people.handlers}
                  triggers={layerVis.triggers ? (draft.triggers ?? []) : []}
                  selectedTrigger={selectedTriggerId}
                  onPickTrigger={
                    layerLocked.triggers
                      ? undefined
                      : (t) => {
                          navigateTarget(null)
                          setSelectedTriggerId(t.id)
                        }
                  }
                  onMoveTrigger={
                    isPlayerMode || layerLocked.triggers
                      ? undefined
                      : (id, delta) => {
                          if (!delta.x && !delta.y) return
                          change((u) => ({
                            ...u,
                            triggers: (u.triggers ?? []).map((t) =>
                              t.id === id ? { ...t, shape: movedForm(t.shape, delta.x, delta.y, area) } : t
                            )
                          }))
                        }
                  }
                  onResizeTrigger={
                    isPlayerMode || layerLocked.triggers
                      ? undefined
                      : (id, w, h) => {
                          change((u) => ({
                            ...u,
                            triggers: (u.triggers ?? []).map((t) =>
                              t.id === id && t.shape.kind === 'box'
                                ? { ...t, shape: { ...t.shape, w, h } }
                                : t
                            )
                          }))
                        }
                  }
                  spawners={layerVis.spawners ? (mapDraft.spawners ?? []) : []}
                  selectedSpawner={selectedSpawnerId}
                  onPickSpawner={
                    layerLocked.spawners
                      ? undefined
                      : (s) => {
                          navigateTarget(null)
                          setSelectedSpawnerId(s.id)
                        }
                  }
                  onMoveSpawner={
                    layerLocked.spawners
                      ? undefined
                      : (id, at) => {
                          changeMap({
                            ...mapDraft,
                            spawners: (mapDraft.spawners ?? []).map((s) => (s.id === id ? { ...s, at } : s))
                          })
                        }
                  }
                  onSpawnerMenu={(spawner, e) => {
                    openMenu(e, spawner.name, [
                      {
                        label: 'Inspect Spawner',
                        icon: <Skull className="h-4 w-4 text-alert" />,
                        onSelect: () => {
                          navigateTarget(null)
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
                          change((u) => forgetMapThing(u, mapThingKey(SPAWNER_THING, spawner.id)))
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
                          navigateTarget(null)
                          setSelectedTriggerId(t.id)
                        }
                      },
                      linkMenuItem(mapThingKey(TRIGGER_THING, t.id)),
                      {
                        label: 'Delete Trigger',
                        icon: <Trash2 className="h-4 w-4 text-alert" />,
                        danger: true,
                        onSelect: () => {
                          if (selectedTriggerId === t.id) setSelectedTriggerId(null)
                          change((u) => forgetMapThing({ ...u, triggers: (u.triggers ?? []).filter((x) => x.id !== t.id) }, mapThingKey(TRIGGER_THING, t.id)))
                        }
                      }
                    ])
                  }}
                  layerGating={draft.layerGating}
                  propGating={draft.propGating}
                  flags={flags}
                  selection={org.selection}
                  onSelection={org.setSelection}
                  onSelectionMenu={selectionMenu}
                  intercept={interceptLink}
                  links={draft.links ?? []}
                  linkFocus={linkFocus}
                  linkLabel={(link) => emittedEvents(piecesOf(link.from)).join(', ')}
                  onLinkMenu={linkMenu}
                  isOff={draft.layers?.length ? (key) => !layerOn(draft, key, flags) : undefined}
                  overlay={overlay}
                  className="h-full"
                />

                {!isPlayerMode && !pendingCreate && (
                  <AtlasToolDock
                    worldId={world}
                    activeTool={activeTool}
                    linkingSourceLabel={org.linking ? nameOf(org.linking) : null}
                    onSelectTool={handleSelectCanvasTool}
                    onCancelLink={() => org.setLinking(null)}
                    stampBrush={stampBrush}
                    onStampBrushChange={setStampBrush}
                  />
                )}

                {canvasClickToolActive && activeTool !== 'stamp' && (
                  <div className="absolute left-1/2 top-12 z-20 flex -translate-x-1/2 items-center gap-2 border border-accent/70 tone-panel-95 px-3 py-1 font-ui text-[11px] text-accent shadow-panel">
                    <span>
                      {activeTool === 'character'
                        ? 'Click map to place a character · Right-click or Esc to cancel'
                        : activeTool === 'spawner'
                          ? 'Click map to place a Spawner · Right-click or Esc to cancel'
                          : activeTool === 'trigger'
                            ? 'Click map to place a Trigger · Right-click or Esc to cancel'
                            : 'Click map to place a Prop · Right-click or Esc to cancel'}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setActiveTool('select')}>
                      Done
                    </Button>
                  </div>
                )}

                {!isPlayerMode && relevantFlags.length > 0 && (
                  <div className="absolute right-3 top-2.5 z-10 flex items-center gap-2 border border-line/60 tone-panel-90 px-2.5 py-1 font-ui text-[11px] shadow-panel">
                    <span className="text-[10px] caps-5 text-dim">Flags Preview:</span>
                    <div className="flex items-center gap-1.5">
                      {relevantFlags.map((flagKey) => {
                        const active = Boolean(flags[flagKey])
                        return (
                          <button
                            key={flagKey}
                            type="button"
                            onClick={() => void engine('worlds.setFlag', { id: world, key: flagKey, value: !active }).catch(failed('Could not toggle flag'))}
                            className={cn(
                              'flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold caps transition-all cursor-pointer',
                              active ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line/40 tone-well-40 text-faint hover:text-ink'
                            )}
                          >
                            {flagKey}: {active ? 'TRUE' : 'FALSE'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {drawing && !pendingCreate && activeShapeKey && (
                  <div className="absolute left-1/2 top-2.5 z-20 flex -translate-x-1/2 items-center gap-2 border border-secondary-ink/50 tone-panel-95 px-2.5 py-1.5 font-ui text-[11px] text-secondary-ink">
                    <span>Redrawing zone for {selectedLabel}</span>
                    <Segmented value={drawing.kind} options={FORMS} onChange={(kind) => setDrawing({ kind, from: drawing.from })} />
                    <Button size="sm" variant="ghost" onClick={() => setDrawing(null)}>
                      Cancel
                    </Button>
                  </div>
                )}

                {placingSpawn && !pendingCreate && selected && (
                  <div className="absolute left-1/2 top-2.5 z-20 flex -translate-x-1/2 items-center gap-2 border border-ok/60 tone-panel-95 px-3 py-1.5 font-ui text-[11px] text-ok">
                    <Crosshair className="h-3.5 w-3.5" />
                    <span>Click on the map to set where characters spawn at {placeName(places, selected)} · Esc to cancel</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-row items-center justify-center gap-3 p-6">
                <EmptyState title="Nothing on this map yet">
                  Open it in Map Editor to add tiles or pictures, then draw Regions and Places directly onto it.
                </EmptyState>
              </div>
            )}
          </div>

          {/* COLLAPSIBLE RIGHT INSPECTOR WRAPPER */}
          {(() => {
            const hasInspector = Boolean(
              (activeTarget && (open || regionOpen) && !pendingCreate) ||
                selectedTrigger ||
                selectedObject ||
                selectedSpawner ||
                selectedToken
            )
            if (!hasInspector) return null
            if (!inspectorOpen) {
              return (
                <button
                  type="button"
                  onClick={() => setInspectorOpen(true)}
                  title="Expand Inspector panel"
                  className="flex w-7 shrink-0 flex-col items-center justify-center gap-2 border-l border-line/60 tone-sidebar-70 text-dim transition-colors hover:bg-accent/10 hover:text-accent cursor-pointer"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              )
            }
            return (
              <div className="relative flex min-h-0 shrink-0">
                <button
                  type="button"
                  onClick={() => setInspectorOpen(false)}
                  title="Collapse Inspector panel"
                  className="absolute -left-6 top-2 z-30 flex h-7 w-6 items-center justify-center border border-r-0 border-line/60 tone-panel-90 text-dim transition-colors hover:border-accent hover:text-accent cursor-pointer"
                >
                  <PanelRightClose className="h-3.5 w-3.5" />
                </button>

          {/* INDEPENDENTLY SCROLLING DRAG-RESIZABLE ATLAS INSPECTOR */}
          {activeTarget && (open || regionOpen) && !pendingCreate && (
            <AtlasInspector
              world={world}
              target={activeTarget}
              places={places}
              regions={regions}
              here={here}
              player={player}
              use={draft}
              width={activeDrawerWidth}
              expanded={isExpanded}
              onToggleExpand={() => setIsExpanded((v) => !v)}
              onResizeStart={handleDrawerResizeStart}
              back={goBack}
              forward={goForward}
              placingSpawn={placingSpawn}
              onTogglePlaceSpawn={() => setPlacingSpawn((v) => !v)}
              onUpdateSpawn={(at) => {
                if (!selected) return
                change({ ...draft, spawns: { ...(draft.spawns ?? {}), [selected]: at } })
              }}
              onRedrawZone={() => setDrawing({ kind: 'box' })}
              onNavigate={navigateTarget}
              onStartCreateRegion={(parentKey) => startCreateRegion(parentKey)}
              onStartCreatePlace={(regionKey, insideKey) => startCreatePlace(regionKey, insideKey)}
              onClose={() => navigateTarget(null)}
            />
          )}

          {/* TRIGGER INSPECTOR */}
          {selectedTrigger && (
            <div
              className="relative z-20 flex min-h-0 shrink-0 flex-col border-l border-line/60 tone-panel-95 shadow-panel"
              style={{ width: `${activeDrawerWidth}px` }}
            >
              <div
                onPointerDown={handleDrawerResizeStart}
                onDoubleClick={() => setIsExpanded((prev) => !prev)}
                className="group absolute inset-y-0 -left-1.5 z-30 flex w-3 cursor-ew-resize items-center justify-center hover:bg-secondary-ink/30"
              >
                <div className="h-8 w-0.5 bg-line/60 group-hover:bg-secondary-ink" />
              </div>
              <WorldTriggerInspector
                key={selectedTrigger.id}
                trigger={selectedTrigger}
                world={world}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded((prev) => !prev)}
                onChange={(next) => change({ ...draft, triggers: (draft.triggers ?? []).map((t) => (t.id === next.id ? next : t)) })}
                onDelete={() => {
                  setSelectedTriggerId(null)
                  change((u) => forgetMapThing({ ...u, triggers: (u.triggers ?? []).filter((t) => t.id !== selectedTrigger.id) }, mapThingKey(TRIGGER_THING, selectedTrigger.id)))
                }}
                onClose={() => setSelectedTriggerId(null)}
                extraTabs={wiring(mapThingKey(TRIGGER_THING, selectedTrigger.id), selectedTrigger.comps, (comps) =>
                  change((u) => ({ ...u, triggers: (u.triggers ?? []).map((t) => (t.id === selectedTrigger.id ? { ...t, comps } : t)) }))
                )}
              />
            </div>
          )}

          {/* MAP OBJECT INSPECTOR */}
          {selectedObject && (
            <div
              className="relative z-20 flex min-h-0 shrink-0 flex-col border-l border-line/60 tone-panel-95 shadow-panel"
              style={{ width: `${activeDrawerWidth}px` }}
            >
              <div
                onPointerDown={handleDrawerResizeStart}
                onDoubleClick={() => setIsExpanded((prev) => !prev)}
                className="group absolute inset-y-0 -left-1.5 z-30 flex w-3 cursor-ew-resize items-center justify-center hover:bg-secondary-ink/30"
              >
                <div className="h-8 w-0.5 bg-line/60 group-hover:bg-secondary-ink" />
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
                onBringToFront={() => changeMap({ ...mapDraft, layers: moveLayer(mapDraft.layers, selectedObject.id, mapDraft.layers.length - 1) })}
                onSendToBack={() => changeMap({ ...mapDraft, layers: moveLayer(mapDraft.layers, selectedObject.id, 0) })}
                onDelete={() => handleDeleteObject(selectedObject.id)}
                onClose={() => setSelectedObjectId(null)}
                extraTabs={wiring(mapThingKey(PROP_THING, selectedObject.id), selectedObject.comps ?? [], (comps) => handleUpdateObject({ ...selectedObject, comps }))}
              />
            </div>
          )}

          {/* SPAWNER INSPECTOR */}
          {selectedSpawner && (
            <div
              className="relative z-20 flex min-h-0 shrink-0 flex-col border-l border-line/60 tone-panel-95 shadow-panel"
              style={{ width: `${activeDrawerWidth}px` }}
            >
              <div
                onPointerDown={handleDrawerResizeStart}
                onDoubleClick={() => setIsExpanded((prev) => !prev)}
                className="group absolute inset-y-0 -left-1.5 z-30 flex w-3 cursor-ew-resize items-center justify-center hover:bg-alert/30"
              >
                <div className="h-8 w-0.5 bg-line/60 group-hover:bg-alert" />
              </div>
              <SpawnerInspector
                key={selectedSpawner.id}
                spawner={selectedSpawner}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded((prev) => !prev)}
                onChange={(next) => changeMap({ ...mapDraft, spawners: (mapDraft.spawners ?? []).map((s) => (s.id === next.id ? next : s)) })}
                onDelete={() => {
                  setSelectedSpawnerId(null)
                  changeMap({ ...mapDraft, spawners: (mapDraft.spawners ?? []).filter((s) => s.id !== selectedSpawner.id) })
                  change((u) => forgetMapThing(u, mapThingKey(SPAWNER_THING, selectedSpawner.id)))
                }}
                onClose={() => setSelectedSpawnerId(null)}
              />
            </div>
          )}

          {/* CHARACTER INSPECTOR */}
          {selectedToken && (
            <div
              className="relative z-20 flex min-h-0 shrink-0 flex-col border-l border-line/60 tone-panel-95 shadow-panel"
              style={{ width: `${activeDrawerWidth}px` }}
            >
              <div
                onPointerDown={handleDrawerResizeStart}
                onDoubleClick={() => setIsExpanded((prev) => !prev)}
                className="group absolute inset-y-0 -left-1.5 z-30 flex w-3 cursor-ew-resize items-center justify-center hover:bg-accent/30"
              >
                <div className="h-8 w-0.5 bg-line/60 group-hover:bg-accent" />
              </div>
              <WorldCharacterInspector
                key={selectedToken.visitor.sheet}
                visitor={selectedToken.visitor}
                world={world}
                places={places}
                regions={regions}
                isPlayer={player === selectedToken.visitor.sheet}
                standing={draft.stand[selectedToken.visitor.sheet]}
                currentPlaceKey={selectedPlaceKeyForToken}
                currentRegionKey={selectedRegionKeyForToken}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded((prev) => !prev)}
                onFocusToken={() => panTo(selectedToken.at)}
                onSetPlayer={() => {
                  void engine('worlds.setPlayer', { id: world, sheet: selectedToken.visitor.sheet })
                    .then(() => toast.success('Active Player Set', `${selectedToken.visitor.name} is now active.`))
                    .catch(failed('Could not set player'))
                }}
                onSetFaction={(factionId) => void assignFaction(selectedToken.visitor.sheet, factionId)}
                onMoveToPlace={(placeKey) => {
                  void setWhere(selectedToken.visitor.sheet, placeKey, world)
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
            )
          })()}
        </MainPane>
      </Split>

      {/* MODALS */}
      {gatingOpen && (
        <Modal open={true} title="Layer Visibility &amp; Flag Gating" onClose={() => setGatingOpen(false)} wide>
          <div className="flex flex-col gap-4 font-ui select-none">
            <div className="flex flex-col divide-y divide-line/40 border border-line/40 tone-panel-50">
              <div className="grid grid-cols-[1fr_160px_160px] gap-3 px-2.5 py-1.5 text-[10px] font-bold caps text-dim">
                <span>Layer Name</span>
                <span>Visible If Flag Set</span>
                <span>Hidden If Flag Set</span>
              </div>
              {mapDraft.layers.map((l) => {
                const current = draft.layerGating?.[l.id]
                return (
                  <div key={l.id} className="grid grid-cols-[1fr_160px_160px] items-center gap-3 p-2.5">
                    <div className="flex flex-col">
                      <span className="text-[12.5px] font-bold text-ink">{l.name}</span>
                      <span className="text-[10px] caps text-faint">{l.kind} layer</span>
                    </div>
                    <FlagSelect
                      world={world}
                      value={current?.needsFlag}
                      placeholder="None"
                      onChange={(f) => setLayerGating(l.id, { needsFlag: f, hiddenIfFlag: current?.hiddenIfFlag })}
                    />
                    <FlagSelect
                      world={world}
                      value={current?.hiddenIfFlag}
                      placeholder="None"
                      onChange={(f) => setLayerGating(l.id, { needsFlag: current?.needsFlag, hiddenIfFlag: f })}
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

      {addObjectAt && (
        <AddPredefinedObjectModal
          world={world}
          map={mapDraft}
          at={addObjectAt}
          onClose={() => setAddObjectAt(null)}
          onPlaced={(newObj, gating) => {
            changeMap({ ...mapDraft, layers: [...mapDraft.layers, newObj] })
            if (gating) handleUpdatePropGating(newObj.id, gating)
            change((u) => org.claim(u, mapThingKey(PROP_THING, newObj.id)))
            navigateTarget(null)
            setSelectedObjectId(newObj.id)
          }}
        />
      )}

      {addTriggerAt && (
        <AddTriggerModal
          world={world}
          at={addTriggerAt}
          onClose={() => setAddTriggerAt(null)}
          onPlaced={(newTrigger) => {
            change((u) => org.claim({ ...u, triggers: [...(u.triggers ?? []), newTrigger] }, mapThingKey(TRIGGER_THING, newTrigger.id)))
            navigateTarget(null)
            setSelectedTriggerId(newTrigger.id)
          }}
        />
      )}

      {addSpawnerAt && (
        <PlaceSpawnerModal
          at={addSpawnerAt}
          world={world}
          onClose={() => setAddSpawnerAt(null)}
          onPlaced={(spawner) => {
            changeMap({ ...mapDraft, spawners: [...(mapDraft.spawners ?? []), spawner] })
            change((u) => org.claim(u, mapThingKey(SPAWNER_THING, spawner.id)))
            navigateTarget(null)
            setSelectedSpawnerId(spawner.id)
            setAddSpawnerAt(null)
          }}
        />
      )}
    </div>
    </CanvasStoreContext.Provider>
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
  mode = 'editor',
  initialTarget = null,
  initialStampNpc = null,
  onConsumeStamp,
  onStart
}: {
  world: string
  mapId: string
  mode?: 'player' | 'editor'
  initialTarget?: AtlasTarget | null
  initialStampNpc?: WorldNpc | null
  onConsumeStamp?: () => void
  onStart: (place: string) => void
}) {
  return (
    <WorldMapLoad world={world} mapId={mapId} layer={mode === 'player' ? 'play' : 'template'}>
      {(map, use, data) => (
        <PlacesOnMap
          key={`${world}/${mapId}`}
          world={world}
          map={map}
          source={use}
          data={data}
          mode={mode}
          initialTarget={initialTarget}
          initialStampNpc={initialStampNpc}
          onConsumeStamp={onConsumeStamp}
          onStart={onStart}
        />
      )}
    </WorldMapLoad>
  )
}
