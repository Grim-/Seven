import { useState, useMemo, useRef, type MouseEvent } from 'react'
import { useStore } from 'zustand'
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileUp,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  Layers,
  Layers3,
  MapPin,
  Plus,
  RotateCw,
  Shield,
  Skull,
  Sparkles,
  Trash2
} from 'lucide-react'
import {
  ANY_ZOOM,
  changeLayer,
  findLayer,
  mapArea,
  mapObjects,
  moveLayer,
  newGroup,
  type MapData,
  type MapLayer,
  type ObjectLayerData,
  type TileLayerData,
  type CreatureSpawner
} from '@shared/maps'
import type { Point, Shape, ShapeKind } from '@shared/shapes'
import { showName } from '@shared/ids'
import type { KindScreenProps } from '../../registries/kinds'
import {
  Button,
  EmptyState,
  EntryHeader,
  LoadingScreen,
  SaveState,
  Segmented,
  askText,
  openMenu,
  useDraft,
  type MenuEvent
} from '../ui'
import {
  CanvasEditorShell,
  CanvasLayerList,
  createCanvasStore,
  type CanvasLayerState
} from '../canvasEditor'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { useViewPlace } from '../../lib/viewPlace'
import { useData } from '../../store/data'
import { entryMenuAt } from '../../views/data/entryMenu'
import { MapCanvas } from './MapCanvas'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { PicturePanel } from './PicturePanel'
import { addImageLayer } from './addImageLayer'
import { ObjectPanel } from './ObjectPanel'
import { useEscapeLayer } from '../../lib/escape'
import { importMapFile } from './importMapFile'
import { useMapPictures } from './useMapPictures'
import { useMap } from './useMap'
import { mapImageContext, useRegisterImageContext } from '../../lib/imagePromptContext'
import { generateDungeon, generateMap, resolveDungeonTiles, resolveOverworldTiles } from 'agent_map_gen'
import type { GenerateConfig } from './GenerateMapModal'
import { OverlayToolbar, type MapTool } from './OverlayToolbar'
import { LayerDeck } from './LayerDeck'
import { GeneratorTray } from './GeneratorTray'
import { TilePaletteBar } from './TilePaletteBar'
import { MapInteractionOverlay } from './MapInteractionOverlay'
import { AddPredefinedObjectModal } from './AddPredefinedObjectModal'
import { PlaceSpawnerModal } from './PlaceSpawnerModal'
import { SpawnerInspector } from './SpawnerInspector'
import { SpawnerLayer } from './SpawnerLayer'

type MapRailTabId = 'layers' | 'zones' | 'props' | 'markers'

function armWindowContextMenuSwallow(): void {
  let done = false
  const swallow = (ev: globalThis.MouseEvent) => {
    if (done) return
    done = true
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
    window.removeEventListener('contextmenu', swallow, true)
  }
  window.addEventListener('contextmenu', swallow, true)
  window.setTimeout(() => {
    if (done) return
    done = true
    window.removeEventListener('contextmenu', swallow, true)
  }, 400)
}

function MapEditor({ source }: { source: MapData }) {
  const { draft, change, status, error } = useDraft(source, (map) => engine('maps.save', { map }))
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [railTab, setRailTab] = useState<MapRailTabId>('layers')
  const [overlaysExpanded, setOverlaysExpanded] = useViewPlace<boolean>('mapTemplateOverlaysOpen', false)

  // Isolated per-map CanvasEditor store matching World Atlas 1:1
  const canvasStore = useMemo(
    () =>
      createCanvasStore({
        editorId: `map-template.${source.id}`,
        initialLayers: [
          { id: 'markers', label: 'Spawner Markers', visible: true, locked: false, opacity: 1, order: 3, color: 'var(--color-alert)' },
          { id: 'props', label: 'Prop Templates', visible: true, locked: false, opacity: 1, order: 2, color: 'var(--color-secondary-ink)' },
          { id: 'zones', label: 'Zone Designators', visible: true, locked: false, opacity: 1, order: 1, color: 'var(--color-accent-soft)' }
        ] satisfies CanvasLayerState[]
      }),
    [source.id]
  )
  const overlayLayers = useStore(canvasStore, (s) => s.layers)
  const overlayById = useMemo(() => {
    const map: Record<string, CanvasLayerState> = {}
    for (const l of overlayLayers) map[l.id] = l
    return map
  }, [overlayLayers])

  const showZones = overlayById.zones?.visible ?? true
  const lockZones = overlayById.zones?.locked ?? false
  const showProps = overlayById.props?.visible ?? true
  const lockProps = overlayById.props?.locked ?? false
  const showMarkers = overlayById.markers?.visible ?? true
  const lockMarkers = overlayById.markers?.locked ?? false

  // Tool & modal states
  const [tool, setTool] = useState<MapTool>('select')
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [selectedGid, setSelectedGid] = useState(1)
  const [brushSize, setBrushSize] = useState(1)
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false)
  const [addObjectAt, setAddObjectAt] = useState<Point | null>(null)
  const [addSpawnerAt, setAddSpawnerAt] = useState<Point | null>(null)
  const [selectedSpawnerId, setSelectedSpawnerId] = useState<string | null>(null)

  // Template zone designators placed on this map blueprint
  const [drawingShape, setDrawingShape] = useState<{ kind: ShapeKind; from?: Point } | null>(null)
  const [drawingTempShape, setDrawingTempShape] = useState<Shape | null>(null)
  const drawingTempShapeRef = useRef<Shape | null>(null)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)

  const layer = selected ? findLayer(draft.layers, selected) : null
  const object = layer?.kind === 'object' ? layer : null
  const picture = layer?.kind === 'image' ? layer : null
  const selectedSpawner = draft.spawners?.find((s) => s.id === selectedSpawnerId) ?? null
  const selectedShapeForm = selectedShapeId ? draft.shapes?.[selectedShapeId] ?? null : null
  const propList = useMemo(() => mapObjects(draft.layers), [draft.layers])
  const zoneEntries = useMemo(() => Object.entries(draft.shapes ?? {}), [draft.shapes])
  const markerList = draft.spawners ?? []

  const mapContext = useMemo(() => {
    const zoneNames = Object.keys(draft.shapes ?? {})
    const layerNames = draft.layers.map((l) => l.name).filter(Boolean)
    const fields: { label: string; text: string }[] = [
      { label: 'Map size', text: `${draft.size.w}×${draft.size.h} px` }
    ]
    if (zoneNames.length) fields.push({ label: 'Zone Designators', text: zoneNames.slice(0, 12).join(', ') })
    if (layerNames.length) fields.push({ label: 'Layers', text: layerNames.slice(0, 10).join(', ') })
    if (object) {
      fields.push({ label: 'Prop Template', text: object.name || 'Map Prop' })
    }
    return mapImageContext(showName(draft.name) || 'Map Blueprint', fields)
  }, [draft.name, draft.size.w, draft.size.h, draft.shapes, draft.layers, object])
  useRegisterImageContext(mapContext)

  const hasActiveCanvasMode = tool !== 'select' || Boolean(drawingShape)

  const cancelActiveMode = (swallowMenu = false) => {
    if (swallowMenu) armWindowContextMenuSwallow()
    if (drawingShape) {
      setDrawingShape(null)
      setDrawingTempShape(null)
      return
    }
    if (tool !== 'select') {
      setTool('select')
    }
  }

  useEscapeLayer(
    hasActiveCanvasMode || object !== null || picture !== null || selectedSpawner !== null || selectedShapeId !== null,
    () => {
      if (hasActiveCanvasMode) {
        cancelActiveMode(false)
        return
      }
      setSelected(null)
      setSelectedSpawnerId(null)
      setSelectedShapeId(null)
    }
  )

  const handleSelectTool = (nextTool: MapTool) => {
    setTool(nextTool)
    if (nextTool !== 'shape' && nextTool !== 'select') {
      setSelectedShapeId(null)
      setDrawingShape(null)
      setDrawingTempShape(null)
    }
    if (nextTool === 'shape' && !selectedShapeId && Object.keys(draft.shapes ?? {}).length === 0) {
      setDrawingShape({ kind: 'box' })
    }
  }

  const shapeMenu = (e: MouseEvent, id: string) => {
    openMenu(e, id, [
      {
        label: 'Rename Zone Designator',
        icon: <FolderOpen className="h-4 w-4 text-secondary-ink" />,
        onSelect: () => {
          askText('Rename Zone Designator', 'Name', id, async (newName) => {
            const trimmed = newName.trim()
            if (!trimmed || trimmed === id) return
            const form = draft.shapes?.[id]
            if (form) {
              const next = { ...(draft.shapes ?? {}) }
              delete next[id]
              next[trimmed] = form
              change({ ...draft, shapes: next })
              if (selectedShapeId === id) setSelectedShapeId(trimmed)
            }
          })
        }
      },
      {
        label: 'Delete Zone Designator',
        icon: <Trash2 className="h-4 w-4 text-alert" />,
        danger: true,
        onSelect: () => {
          const next = { ...(draft.shapes ?? {}) }
          delete next[id]
          change({ ...draft, shapes: next })
          if (selectedShapeId === id) setSelectedShapeId(null)
        }
      }
    ])
  }

  const handlePlaceSpawner = (at: Point) => setAddSpawnerAt(at)
  const handleUpdateSpawner = (next: CreatureSpawner) =>
    change({ ...draft, spawners: (draft.spawners ?? []).map((s) => (s.id === next.id ? next : s)) })
  const handleDeleteSpawner = (id: string) => {
    setSelectedSpawnerId(null)
    change({ ...draft, spawners: (draft.spawners ?? []).filter((s) => s.id !== id) })
  }
  const handleMoveSpawner = (id: string, at: Point) =>
    change({ ...draft, spawners: (draft.spawners ?? []).map((s) => (s.id === id ? { ...s, at } : s)) })

  const setLayer = (next: MapLayer) => change({ ...draft, layers: changeLayer(draft.layers, next.id, () => next) })
  const setObject = (next: ObjectLayerData) => setLayer(next)

  const deleteObject = (id: string) => {
    setSelected((s) => (s === id ? null : s))
    change({ ...draft, layers: changeLayer(draft.layers, id, () => null) })
  }

  const duplicateObject = (o: ObjectLayerData) => {
    const clone: ObjectLayerData = {
      ...o,
      id: crypto.randomUUID(),
      name: `${o.name || 'Prop Template'} (Copy)`,
      offset: { x: o.offset.x + 32, y: o.offset.y + 32 }
    }
    change({ ...draft, layers: [...draft.layers, clone] })
    setSelected(clone.id)
  }

  const propMenu = (o: ObjectLayerData, e: MenuEvent) => {
    openMenu(e, o.name || 'Prop Template', [
      {
        label: 'Rotate 90°',
        icon: <RotateCw className="h-4 w-4" />,
        onSelect: () => setObject({ ...o, rotation: (o.rotation + 90) % 360 })
      },
      {
        label: 'Bring to Front',
        icon: <ArrowUpToLine className="h-4 w-4" />,
        onSelect: () => change({ ...draft, layers: moveLayer(draft.layers, o.id, draft.layers.length - 1) })
      },
      {
        label: 'Send to Back',
        icon: <ArrowDownToLine className="h-4 w-4" />,
        onSelect: () => change({ ...draft, layers: moveLayer(draft.layers, o.id, 0) })
      },
      {
        label: o.collision === 'passable' ? 'Set as Solid (Blocks Movement)' : 'Set as Passable (Walkable)',
        icon: <Shield className="h-4 w-4 text-secondary-ink" />,
        onSelect: () => setObject({ ...o, collision: o.collision === 'passable' ? 'solid' : 'passable' })
      },
      {
        label: 'Duplicate Template',
        icon: <Copy className="h-4 w-4" />,
        onSelect: () => duplicateObject(o)
      },
      {
        label: 'Delete Prop Template',
        icon: <Trash2 className="h-4 w-4 text-alert" />,
        danger: true,
        onSelect: () => deleteObject(o.id)
      }
    ])
  }

  const placeObject = (at: Point) => setAddObjectAt(at)

  const usedBy = useLive(() => engine('maps.list'), 'worlds.changed')?.find((m) => m.id === source.id)?.usedBy ?? []

  const addPicture = (at?: Point) =>
    void addImageLayer(draft, at)
      .then((next) => next && change(next))
      .catch(failed('Could not add the picture'))

  const addGroup = () =>
    askText('New layer group', 'Name', '', async (name) => {
      if (name.trim()) change({ ...draft, layers: [...draft.layers, newGroup(name.trim())] })
    })

  const addTileLayer = () => {
    const tileW = draft.tile.w || 32
    const tileH = draft.tile.h || 32
    const cols = Math.floor(draft.size.w / tileW) || 64
    const rows = Math.floor(draft.size.h / tileH) || 64
    const newLayer: TileLayerData = {
      id: crypto.randomUUID(),
      kind: 'tiles',
      name: `Tile Layer ${draft.layers.filter((l) => l.kind === 'tiles').length + 1}`,
      visible: true,
      opacity: 1,
      offset: { x: 0, y: 0 },
      zoom: ANY_ZOOM,
      columns: cols,
      rows: rows,
      tiles: new Array(cols * rows).fill(0)
    }
    change({ ...draft, layers: [newLayer, ...draft.layers] })
    setActiveLayerId(newLayer.id)
  }

  const activeTileLayer = useMemo(() => {
    if (activeLayerId) {
      const found = findLayer(draft.layers, activeLayerId)
      if (found && found.kind === 'tiles') return found as TileLayerData
    }
    const first = draft.layers.find((l): l is TileLayerData => l.kind === 'tiles' && l.visible)
    return first ?? null
  }, [draft.layers, activeLayerId])

  const handlePaintTiles = (layerId: string, tiles: number[]) => {
    change({
      ...draft,
      layers: changeLayer(draft.layers, layerId, (l) => ({ ...l, tiles }) as TileLayerData)
    })
  }

  const handleGenerate = async (config: GenerateConfig) => {
    try {
      const result =
        config.type === 'dungeon'
          ? await generateDungeon({
              kind: config.kind,
              width: config.width,
              height: config.height,
              seed: config.seed,
              config: config.config
            })
          : await generateMap({
              shaper: config.kind,
              width: config.width,
              height: config.height,
              seed: config.seed,
              config: config.config
            })
      const width = result.width
      const height = result.height
      const resolved =
        config.type === 'dungeon'
          ? resolveDungeonTiles(result as any, { firstGid: 1 })
          : resolveOverworldTiles(result as any, { firstGid: 1 })
      const bundled = await engine('maps.ensureDefaultTileset')
      if (bundled) {
        useData.getState().onAsset(bundled.asset.id, bundled.asset)
      }
      let terrainTileset = bundled ? draft.tilesets.find((t) => t.name === bundled.name) : undefined
      if (!terrainTileset && bundled) {
        terrainTileset = {
          id: crypto.randomUUID(),
          name: bundled.name,
          image: bundled.asset.id,
          first: 1,
          tile: bundled.tile,
          columns: bundled.columns,
          count: bundled.count,
          margin: bundled.margin,
          spacing: bundled.spacing
        }
      }
      const groundLayer: TileLayerData = {
        id: crypto.randomUUID(),
        kind: 'tiles',
        name: `${config.kind.charAt(0).toUpperCase() + config.kind.slice(1)} Ground`,
        visible: true,
        opacity: 1,
        offset: { x: 0, y: 0 },
        zoom: ANY_ZOOM,
        columns: width,
        rows: height,
        tiles: resolved.groundTiles
      }
      const collisionLayer: TileLayerData = {
        id: crypto.randomUUID(),
        kind: 'tiles',
        name: `${config.kind.charAt(0).toUpperCase() + config.kind.slice(1)} Collision`,
        visible: false,
        opacity: 0.5,
        offset: { x: 0, y: 0 },
        zoom: ANY_ZOOM,
        columns: width,
        rows: height,
        tiles: resolved.collisionTiles
      }
      const nextTilesets =
        terrainTileset && !draft.tilesets.some((t) => t.id === terrainTileset.id)
          ? [...draft.tilesets, terrainTileset]
          : draft.tilesets

      const existingLayers = draft.layers.filter(
        (l) => !(l.kind === 'tiles' && l.name.startsWith('Tile Layer') && l.tiles.every((t) => t === 0))
      )

      change({
        ...draft,
        size: { w: width * 32, h: height * 32 },
        tile: { w: 32, h: 32 },
        tilesets: nextTilesets,
        layers: [groundLayer, collisionLayer, ...existingLayers]
      })
      setActiveLayerId(groundLayer.id)
    } catch (err) {
      failed('Could not generate the map')(err)
    }
  }

  const mapMenu = (e: MouseEvent, at: Point) =>
    openMenu(e, `${showName(draft.name)} (Blueprint)`, [
      { label: 'Generate template terrain…', icon: <Sparkles />, onSelect: () => setGeneratorOpen(true) },
      { label: 'Draw Zone Designator here', icon: <MapPin className="text-accent" />, onSelect: () => { setTool('shape'); setDrawingShape({ kind: 'box', from: at }) } },
      { label: 'Place Prop Template here', icon: <Box />, onSelect: () => placeObject(at) },
      { label: 'Place Spawner Marker here', icon: <Skull className="text-alert" />, onSelect: () => handlePlaceSpawner(at) },
      { separator: true, label: '' },
      { label: 'Add picture layer here', icon: <ImagePlus />, onSelect: () => addPicture(at) },
      { label: 'New layer group', icon: <FolderPlus />, onSelect: addGroup }
    ])

  const importInto = () => void importMapFile(draft.id).catch(failed('Could not import the map'))

  // Left Rail Tabs — mirrors World Atlas 1:1
  const railTabs: { id: MapRailTabId; label: string; heading: string; icon: typeof Layers; count: number }[] = [
    { id: 'layers', label: 'Layers', heading: 'Blueprint Layers', icon: Layers3, count: draft.layers.length },
    { id: 'zones', label: 'Zones', heading: 'Zone Designators', icon: MapPin, count: zoneEntries.length },
    { id: 'props', label: 'Props', heading: 'Prop Templates', icon: Box, count: propList.length },
    { id: 'markers', label: 'Markers', heading: 'Spawner Markers', icon: Skull, count: markerList.length }
  ]
  const activeRail = railTabs.find((t) => t.id === railTab) ?? railTabs[0]

  const leftPanel = (
    <div className="flex h-full min-h-0 flex-col select-none">
      {/* Blueprint framing banner */}
      <div className="border-b border-line/40 bg-accent/[0.06] px-2.5 py-1.5 text-[10.5px] text-dim">
        <strong className="font-label text-[9.5px] caps-8 text-accent">Blueprint Mode</strong> · Everything placed here is a reusable template marker imported into Worlds as an independent copy.
      </div>

      {/* Icon + Count Rail Tabs (exact World Atlas pattern) */}
      <div className="flex flex-col gap-2 border-b border-line/40 tone-panel-50 p-2">
        <div className="grid grid-cols-4 border border-line/50 tone-well-40">
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

        <div className="flex items-center justify-between gap-1 px-1 text-[11px]">
          <span className="truncate font-bold caps text-dim">{activeRail.heading}</span>
          {railTab === 'zones' && (
            <button
              type="button"
              onClick={() => {
                setTool('shape')
                setSelectedShapeId(null)
                setDrawingShape({ kind: 'box' })
              }}
              className="flex items-center gap-0.5 font-label text-[9.5px] font-bold caps-5 text-accent hover:text-ink cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Zone
            </button>
          )}
          {railTab === 'props' && (
            <button
              type="button"
              onClick={() => setTool('object')}
              className="flex items-center gap-0.5 font-label text-[9.5px] font-bold caps-5 text-secondary-ink hover:text-ink cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Prop
            </button>
          )}
          {railTab === 'markers' && (
            <button
              type="button"
              onClick={() => setTool('spawner')}
              className="flex items-center gap-0.5 font-label text-[9.5px] font-bold caps-5 text-alert hover:text-ink cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Marker
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Active Rail Tab Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {railTab === 'layers' && (
          <LayerDeck
            open
            embedded
            onClose={() => undefined}
            layers={draft.layers}
            activeLayerId={activeTileLayer?.id ?? null}
            onSelectActiveLayer={(id) => {
              setActiveLayerId(id)
              const picked = findLayer(draft.layers, id)
              if (picked && (picked.kind === 'object' || picked.kind === 'image')) {
                setSelected(id)
                setSelectedShapeId(null)
                setSelectedSpawnerId(null)
              }
            }}
            onChangeLayers={(layers) => change({ ...draft, layers })}
            onAddTileLayer={addTileLayer}
            onAddImageLayer={() => addPicture()}
            onAddObject={() => setAddObjectAt({ x: Math.round(draft.size.w / 2), y: Math.round(draft.size.h / 2) })}
            onAddSpawner={() => handlePlaceSpawner({ x: Math.round(draft.size.w / 2), y: Math.round(draft.size.h / 2) })}
            onAddGroup={addGroup}
          />
        )}

        {railTab === 'zones' && (
          <div className="flex flex-col divide-y divide-line/25">
            {zoneEntries.length === 0 ? (
              <div className="p-3 text-[11px] text-faint">
                No zone designators yet. Draw suggested rooms or areas here—Worlds inherit them as ready-made Places when importing this map.
              </div>
            ) : (
              zoneEntries.map(([name, form]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSelected(null)
                    setSelectedSpawnerId(null)
                    setSelectedShapeId(name)
                  }}
                  onContextMenu={(e) => shapeMenu(e, name)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors cursor-pointer',
                    selectedShapeId === name
                      ? 'border-l-2 border-l-accent bg-accent/15 text-ink'
                      : 'text-dim hover:tone-card-40 hover:text-ink'
                  )}
                >
                  <span className="truncate text-[12px] font-semibold text-ink">{name}</span>
                  <span className="shrink-0 font-data text-[9.5px] caps text-faint">{form.kind}</span>
                </button>
              ))
            )}
          </div>
        )}

        {railTab === 'props' && (
          <div className="flex flex-col divide-y divide-line/25">
            {propList.length === 0 ? (
              <div className="p-3 text-[11px] text-faint">
                No prop templates placed yet. Place doors, chests, levers, or furniture templates onto the blueprint.
              </div>
            ) : (
              propList.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setSelected(o.id)
                    setSelectedShapeId(null)
                    setSelectedSpawnerId(null)
                  }}
                  onContextMenu={(e) => propMenu(o, e)}
                  className={cn(
                    'flex flex-col gap-0.5 px-2.5 py-2 text-left transition-colors cursor-pointer',
                    selected === o.id
                      ? 'border-l-2 border-l-secondary-ink bg-secondary/15 text-ink'
                      : 'text-dim hover:tone-card-40 hover:text-ink'
                  )}
                >
                  <span className="truncate text-[12px] font-semibold text-ink">{o.name || 'Prop Template'}</span>
                  <span className="truncate font-data text-[10px] text-faint">
                    ({Math.round(o.offset.x)}, {Math.round(o.offset.y)}) · {o.collision}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {railTab === 'markers' && (
          <div className="flex flex-col divide-y divide-line/25">
            {markerList.length === 0 ? (
              <div className="p-3 text-[11px] text-faint">
                No spawner markers yet. Markers designate recommended creature spawns when this blueprint is added to a World.
              </div>
            ) : (
              markerList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelected(null)
                    setSelectedShapeId(null)
                    setSelectedSpawnerId(s.id)
                  }}
                  className={cn(
                    'flex flex-col gap-0.5 px-2.5 py-2 text-left transition-colors cursor-pointer',
                    selectedSpawnerId === s.id
                      ? 'border-l-2 border-l-alert bg-alert/10 text-ink'
                      : 'text-dim hover:tone-card-40 hover:text-ink'
                  )}
                >
                  <span className="truncate text-[12px] font-semibold text-ink">{s.name}</span>
                  <span className="truncate font-data text-[10px] text-faint">
                    {s.monsterId} · ({Math.round(s.at.x)}, {Math.round(s.at.y)})
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Collapsible Overlays & Locks Stack (identical to World Atlas!) */}
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
          <div className="max-h-40 overflow-y-auto border-t border-line/30">
            <CanvasLayerList reorderable={false} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {overlayLayers.map((l) => (
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
  )

  const rightTitle = object
    ? `Prop Template · ${object.name || 'Unnamed'}`
    : picture
      ? `Image Layer · ${picture.name || 'Picture'}`
      : selectedSpawner
        ? `Spawner Marker · ${selectedSpawner.name}`
        : selectedShapeId
          ? `Zone Designator · ${selectedShapeId}`
          : 'Blueprint Inspector'

  const rightPanel = object ? (
    <ObjectPanel
      key={object.id}
      object={object}
      isExpanded={isDrawerExpanded}
      onToggleExpand={() => setIsDrawerExpanded((prev) => !prev)}
      onChange={setObject}
      onClose={() => setSelected(null)}
      onDuplicate={() => duplicateObject(object)}
      onDelete={() => deleteObject(object.id)}
      onBringToFront={() => change({ ...draft, layers: moveLayer(draft.layers, object.id, draft.layers.length - 1) })}
      onSendToBack={() => change({ ...draft, layers: moveLayer(draft.layers, object.id, 0) })}
    />
  ) : picture ? (
    <PicturePanel
      key={picture.id}
      layer={picture}
      onChange={setLayer}
      actions={[
        { label: 'Done', icon: <Check />, onSelect: () => setSelected(null) },
        {
          label: 'Remove',
          icon: <Trash2 />,
          danger: true,
          onSelect: () =>
            change({
              ...draft,
              layers: changeLayer(draft.layers, picture.id, () => null)
            })
        }
      ]}
    />
  ) : selectedSpawner ? (
    <SpawnerInspector
      key={selectedSpawner.id}
      spawner={selectedSpawner}
      isExpanded={isDrawerExpanded}
      onToggleExpand={() => setIsDrawerExpanded((prev) => !prev)}
      onChange={handleUpdateSpawner}
      onDelete={() => handleDeleteSpawner(selectedSpawner.id)}
      onClose={() => setSelectedSpawnerId(null)}
    />
  ) : selectedShapeId && selectedShapeForm ? (
    <div className="flex flex-col gap-3 p-3 text-[12px]">
      <div className="flex items-center justify-between border-b border-line/40 pb-2">
        <div>
          <div className="font-label text-[10px] font-bold caps-8 text-accent">Zone Designator</div>
          <div className="text-[14px] font-bold text-ink">{selectedShapeId}</div>
        </div>
        <span className="border border-line/50 tone-well-40 px-1.5 py-0.5 font-data text-[10px] caps text-dim">
          {selectedShapeForm.kind}
        </span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-dim">
        Template zone designator. Drag on the canvas to reposition or drag its corner handles to resize. When this map is pulled into a World, this zone is ready to become a live Place.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            askText('Rename Zone Designator', 'Name', selectedShapeId, async (newName) => {
              const trimmed = newName.trim()
              if (!trimmed || trimmed === selectedShapeId) return
              const form = draft.shapes?.[selectedShapeId]
              if (form) {
                const next = { ...(draft.shapes ?? {}) }
                delete next[selectedShapeId]
                next[trimmed] = form
                change({ ...draft, shapes: next })
                setSelectedShapeId(trimmed)
              }
            })
          }}
        >
          Rename
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="h-3 w-3" />}
          onClick={() => {
            setSelectedShapeId(null)
            setDrawingShape({ kind: 'box' })
          }}
        >
          Draw Another Zone
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-alert hover:bg-alert/15"
          onClick={() => {
            const next = { ...(draft.shapes ?? {}) }
            delete next[selectedShapeId]
            change({ ...draft, shapes: next })
            setSelectedShapeId(null)
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-3 p-3.5 text-[12px]">
      <div className="border border-accent/40 bg-accent/[0.06] p-3">
        <div className="font-label text-[10px] font-bold caps-8 text-accent">Reusable Map Blueprint</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-dim">
          Nothing lives here permanently. Tiles, zone designators, prop templates, and spawner markers come pre-setup when you pull this map into a World — and once in a World, they become yours to customize independently.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 font-data text-[11px]">
        <div className="border border-line/50 tone-well-40 p-2">
          <div className="font-label text-[9.5px] caps-8 text-faint">Dimensions</div>
          <div className="mt-0.5 text-ink">
            {Math.round(draft.size.w / (draft.tile.w || 32))}×{Math.round(draft.size.h / (draft.tile.h || 32))} tiles
          </div>
        </div>
        <div className="border border-line/50 tone-well-40 p-2">
          <div className="font-label text-[9.5px] caps-8 text-faint">Layers</div>
          <div className="mt-0.5 text-ink">{draft.layers.length}</div>
        </div>
        <div className="border border-line/50 tone-well-40 p-2">
          <div className="font-label text-[9.5px] caps-8 text-faint">Zone Designators</div>
          <div className="mt-0.5 text-ink">{zoneEntries.length}</div>
        </div>
        <div className="border border-line/50 tone-well-40 p-2">
          <div className="font-label text-[9.5px] caps-8 text-faint">Templates &amp; Markers</div>
          <div className="mt-0.5 text-ink">
            {propList.length} props · {markerList.length} spawners
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button size="sm" variant="secondary" icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => setGeneratorOpen(true)}>
          Procedural Generator
        </Button>
        <Button size="sm" variant="ghost" icon={<FileUp className="h-3.5 w-3.5" />} onClick={importInto}>
          Import Tiled Map
        </Button>
      </div>
    </div>
  )

  const zoneToolbarOptions =
    tool === 'shape' || drawingShape ? (
      <div className="flex items-center gap-1.5">
        <Segmented
          value={drawingShape?.kind ?? 'box'}
          options={[
            { value: 'box', label: 'Box' },
            { value: 'outline', label: 'Outline' }
          ]}
          onChange={(k) => setDrawingShape({ kind: k as ShapeKind })}
        />
        {!drawingShape && (
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="h-3 w-3" />}
            onClick={() => {
              setSelectedShapeId(null)
              setDrawingShape({ kind: 'box' })
            }}
          >
            Draw Zone
          </Button>
        )}
      </div>
    ) : undefined

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      {/* Top Header Deck */}
      <EntryHeader
        title={showName(draft.name)}
        kind={
          usedBy.length
            ? `Map Blueprint · imported by ${usedBy.join(', ')}`
            : 'Map Blueprint · template ready for any World'
        }
        onMenu={(e) => entryMenuAt(e, 'map', draft.id, draft.name)}
      >
        <SaveState status={status} error={error} />
      </EntryHeader>

      {/* Unified CanvasEditorShell — identical Left Rail / Center Canvas / Right Inspector to World Atlas */}
      <div className="relative min-h-0 flex-1 overflow-hidden border border-line bg-panel">
        <CanvasEditorShell
          editorId={`map-template.${source.id}`}
          store={canvasStore}
          leftTitle="Blueprint"
          leftPanel={leftPanel}
          defaultLeftWidth={276}
          rightTitle={rightTitle}
          rightPanel={rightPanel}
          defaultRightWidth={380}
        >
          {draft.layers.length > 0 ? (
            <div
              onContextMenuCapture={(e) => {
                if (hasActiveCanvasMode) {
                  e.preventDefault()
                  e.stopPropagation()
                  cancelActiveMode(false)
                }
              }}
              className="relative h-full w-full overflow-hidden"
            >
              <MapCanvas
                map={draft}
                shapes={showZones ? (draft.shapes ?? {}) : {}}
                place={`map.${draft.id}`}
                suspendHits={Boolean(drawingShape || tool !== 'select')}
                selected={selectedShapeId}
                onPick={
                  lockZones
                    ? undefined
                    : (s) => {
                        setSelected(null)
                        setSelectedSpawnerId(null)
                        setSelectedShapeId(s.id)
                      }
                }
                onShapeMenu={hasActiveCanvasMode || lockZones ? undefined : (e, s) => shapeMenu(e, s.id)}
                onZoom={setZoom}
                onBlank={
                  drawingShape
                    ? undefined
                    : () => {
                        setSelected(null)
                        setSelectedShapeId(null)
                        setSelectedSpawnerId(null)
                      }
                }
                onBlankMenu={hasActiveCanvasMode ? undefined : mapMenu}
                objects={
                  !showProps || lockProps
                    ? undefined
                    : {
                        selected,
                        onPick: (o) => {
                          setSelected(o.id)
                          setSelectedShapeId(null)
                          setSelectedSpawnerId(null)
                        },
                        onMenu: (o, e) => propMenu(o, e),
                        onChange: (id, patch) =>
                          change({
                            ...draft,
                            layers: changeLayer(draft.layers, id, (l) => ({ ...l, ...patch }) as MapLayer)
                          })
                      }
                }
                overlay={
                  <>
                    {showZones && (selectedShapeForm || drawingShape) && (
                      <ShapeEditor
                        size={mapArea(draft)}
                        shapes={
                          drawingShape
                            ? drawingTempShape
                              ? [drawingTempShape]
                              : []
                            : selectedShapeId && selectedShapeForm
                              ? [{ id: selectedShapeId, label: selectedShapeId, form: selectedShapeForm }]
                              : []
                        }
                        onChange={(list) => {
                          if (drawingShape) {
                            const latest = list[list.length - 1] ?? null
                            drawingTempShapeRef.current = latest
                            setDrawingTempShape(latest)
                          } else if (selectedShapeId && list[0]) {
                            change({
                              ...draft,
                              shapes: {
                                ...(draft.shapes ?? {}),
                                [selectedShapeId]: list[0].form
                              }
                            })
                          }
                        }}
                        selected={selectedShapeId}
                        onSelect={(id) => setSelectedShapeId(id)}
                        drawing={drawingShape?.kind ?? null}
                        from={drawingShape?.from}
                        onDrawn={(newId) => {
                          const finished = drawingTempShapeRef.current ?? drawingTempShape
                          drawingTempShapeRef.current = null
                          if (!newId || !finished) {
                            setDrawingTempShape(null)
                            setDrawingShape(null)
                            return
                          }
                          const form = finished.form
                          setDrawingTempShape(null)
                          setDrawingShape(null)
                          askText(
                            'New Zone Designator',
                            'Name',
                            `Zone ${Object.keys(draft.shapes ?? {}).length + 1}`,
                            async (name) => {
                              const trimmed = name.trim() || `Zone ${Object.keys(draft.shapes ?? {}).length + 1}`
                              change({
                                ...draft,
                                shapes: {
                                  ...(draft.shapes ?? {}),
                                  [trimmed]: form
                                }
                              })
                              setSelectedShapeId(trimmed)
                            }
                          )
                        }}
                        newLabel="New Zone"
                        passThrough
                        onMenu={lockZones ? undefined : (e, id) => shapeMenu(e, id)}
                        className="absolute left-0 top-0"
                      >
                        <div style={{ width: mapArea(draft).w, height: mapArea(draft).h }} />
                      </ShapeEditor>
                    )}

                    {(tool === 'paint' || tool === 'erase' || tool === 'object' || tool === 'spawner') && (
                      <MapInteractionOverlay
                        map={draft}
                        tool={tool}
                        activeTileLayer={activeTileLayer}
                        selectedGid={selectedGid}
                        brushSize={brushSize}
                        zoom={zoom}
                        onPaintTiles={handlePaintTiles}
                        onPlaceObject={placeObject}
                        onPlaceSpawner={handlePlaceSpawner}
                        onCancelTool={() => cancelActiveMode(true)}
                      />
                    )}

                    {showMarkers && (
                      <SpawnerLayer
                        spawners={draft.spawners ?? []}
                        selectedId={selectedSpawnerId}
                        onSelect={
                          lockMarkers
                            ? () => undefined
                            : (spawner) => {
                                setSelected(null)
                                setSelectedShapeId(null)
                                setSelectedSpawnerId(spawner.id)
                              }
                        }
                        onMove={lockMarkers ? () => undefined : handleMoveSpawner}
                        onMenu={
                          lockMarkers
                            ? undefined
                            : (spawner, e) => {
                                openMenu(e, `${spawner.name} (Marker)`, [
                                  {
                                    label: 'Rotate 90°',
                                    icon: <RotateCw />,
                                    onSelect: () =>
                                      handleUpdateSpawner({
                                        ...spawner,
                                        facing: ((spawner.facing ?? 0) + 90) % 360
                                      })
                                  },
                                  {
                                    label: 'Delete Spawner Marker',
                                    icon: <Trash2 />,
                                    danger: true,
                                    onSelect: () => handleDeleteSpawner(spawner.id)
                                  }
                                ])
                              }
                        }
                      />
                    )}
                  </>
                }
                className="h-full"
              />

              {/* MOVABLE, LOCKABLE, HOVER-REVEAL HORIZONTAL TOOLBAR (same as World Atlas!) */}
              <OverlayToolbar
                tool={tool}
                onSelectTool={handleSelectTool}
                onAddImage={() => addPicture()}
                onToggleGenerator={() => setGeneratorOpen((v) => !v)}
                generatorOpen={generatorOpen}
                optionsBar={zoneToolbarOptions}
              />

              {/* IN-CANVAS PROCEDURAL GENERATOR TRAY */}
              <GeneratorTray
                open={generatorOpen}
                onClose={() => setGeneratorOpen(false)}
                onGenerate={handleGenerate}
              />

              {/* TILE PALETTE & BRUSH PICKER (Bottom Center in Paint/Erase mode) */}
              {(tool === 'paint' || tool === 'erase') && (
                <TilePaletteBar
                  selectedGid={selectedGid}
                  onSelectGid={setSelectedGid}
                  brushSize={brushSize}
                  onSetBrushSize={setBrushSize}
                  activeLayerName={activeTileLayer?.name ?? 'Ground'}
                />
              )}

              {/* Compact Bottom-Left Status HUD */}
              <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-3 border border-line/70 tone-panel-90 px-2.5 py-1 font-data text-[10.5px] text-dim shadow-panel">
                <span>
                  ZOOM: <strong className="text-ink">{Math.round(zoom * 100)}%</strong>
                </span>
                <span>
                  TOOL: <strong className="text-accent caps">{tool}</strong>
                </span>
                <span>
                  GRID:{' '}
                  <strong className="text-secondary-ink">
                    {Math.round(draft.size.w / (draft.tile.w || 32))}×{Math.round(draft.size.h / (draft.tile.h || 32))}
                  </strong>
                </span>
              </div>
            </div>
          ) : (
            <div className="relative flex h-full flex-col items-center justify-center gap-3 p-6">
              <EmptyState title="Empty Map Blueprint">
                Generate a procedural terrain blueprint, import a Tiled map, or add a picture layer. Zones, props, and spawner markers you design here come pre-wired when imported into any World.
              </EmptyState>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" icon={<Sparkles />} onClick={() => setGeneratorOpen(true)}>
                  Open Map Generator
                </Button>
                <Button size="sm" variant="ghost" icon={<FileUp />} onClick={importInto}>
                  Import a map
                </Button>
              </div>
              {generatorOpen && (
                <GeneratorTray
                  open={generatorOpen}
                  onClose={() => setGeneratorOpen(false)}
                  onGenerate={handleGenerate}
                />
              )}
            </div>
          )}
        </CanvasEditorShell>
      </div>

      {/* PLACE PROP TEMPLATE MODAL */}
      {addObjectAt && (
        <AddPredefinedObjectModal
          map={draft}
          at={addObjectAt}
          onClose={() => setAddObjectAt(null)}
          onPlaced={(newObj) => {
            const layers = [...draft.layers, newObj]
            change({ ...draft, layers })
            setSelected(newObj.id)
            setTool('select')
          }}
        />
      )}

      {/* PLACE SPAWNER MARKER MODAL */}
      {addSpawnerAt && (
        <PlaceSpawnerModal
          at={addSpawnerAt}
          onClose={() => setAddSpawnerAt(null)}
          onPlaced={(spawner) => {
            change({ ...draft, spawners: [...(draft.spawners ?? []), spawner] })
            setSelectedSpawnerId(spawner.id)
            setTool('select')
          }}
        />
      )}
    </div>
  )
}

export function MapScreen({ id }: KindScreenProps) {
  const map = useMap(id ?? '')
  const pictures = useMapPictures(map)
  if (!id) return null
  if (map === false) return <EmptyState title="Gone">This map no longer exists.</EmptyState>
  if (!map || pictures.done < pictures.total)
    return (
      <LoadingScreen
        title={map ? showName(map.name) : 'map'}
        steps={[
          { label: 'Map Blueprint', done: Boolean(map) },
          {
            label: 'Pictures',
            done: Boolean(map) && pictures.done >= pictures.total,
            detail: map ? `${pictures.done} / ${pictures.total}` : undefined
          }
        ]}
      />
    )
  return <MapEditor key={id} source={map} />
}
