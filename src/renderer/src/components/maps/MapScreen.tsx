import { useState, useMemo, type MouseEvent, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Box, Check, Copy, FileUp, FolderOpen, FolderPlus, ImagePlus, Plus, RotateCw, Shield, Sparkles, Trash2, Skull } from 'lucide-react'
import {
  ANY_ZOOM,
  changeLayer,
  findLayer,
  mapArea,
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
import { Button, EmptyState, EntryHeader, LoadingScreen, SaveState, Segmented, askText, openMenu, useDraft, type MenuEvent } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
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

function SidePanel({
  children,
  isExpanded,
  onToggleExpand
}: {
  children: ReactNode
  isExpanded?: boolean
  onToggleExpand?: () => void
}) {
  const [drawerWidth, setDrawerWidth] = useState(360)
  const activeWidth = isExpanded ? 680 : drawerWidth

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = activeWidth
    const onMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX
      const next = Math.max(320, Math.min(960, startWidth + delta))
      setDrawerWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="absolute inset-y-0 right-0 z-20 flex min-h-0 flex-col border-l border-line/60 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.7)]"
      style={{ width: `${activeWidth}px` }}
    >
      <div
        onPointerDown={handleResizeStart}
        onDoubleClick={onToggleExpand}
        className="absolute inset-y-0 -left-1.5 w-3 cursor-ew-resize hover:bg-cyan/40 active:bg-cyan z-30 transition-colors group flex items-center justify-center"
        title="Drag left to expand outwards · Double-click to toggle width"
      >
        <div className="h-8 w-0.5 bg-line/60 group-hover:bg-cyan group-active:bg-cyan rounded-full" />
      </div>
      {children}
    </div>
  )
}

function MapEditor({ source }: { source: MapData }) {
  const { draft, change, status, error } = useDraft(source, (map) => engine('maps.save', { map }))
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  // Floating HUD states
  const [tool, setTool] = useState<MapTool>('select')
  const [layersOpen, setLayersOpen] = useState(true)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [selectedGid, setSelectedGid] = useState(1)
  const [brushSize, setBrushSize] = useState(1)
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [isDrawerExpanded, setIsDrawerExpanded] = useState(false)
  const [addObjectAt, setAddObjectAt] = useState<Point | null>(null)
  const [addSpawnerAt, setAddSpawnerAt] = useState<Point | null>(null)
  const [selectedSpawnerId, setSelectedSpawnerId] = useState<string | null>(null)

  // Template shapes / zones placed on this map
  const [drawingShape, setDrawingShape] = useState<{ kind: ShapeKind; from?: Point } | null>(null)
  const [drawingTempShape, setDrawingTempShape] = useState<Shape | null>(null)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)

  const layer = selected ? findLayer(draft.layers, selected) : null
  const object = layer?.kind === 'object' ? layer : null
  const picture = layer?.kind === 'image' ? layer : null
  const selectedSpawner = draft.spawners?.find((s) => s.id === selectedSpawnerId) ?? null
  const selectedShapeForm = selectedShapeId ? draft.shapes?.[selectedShapeId] ?? null : null

  useEscapeLayer(object !== null || picture !== null || selectedSpawner !== null || selectedShapeId !== null || drawingShape !== null, () => {
    setSelected(null)
    setSelectedSpawnerId(null)
    setSelectedShapeId(null)
    setDrawingShape(null)
    setDrawingTempShape(null)
  })

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
        label: 'Rename Zone',
        icon: <FolderOpen className="h-4 w-4 text-cyan" />,
        onSelect: () => {
          askText('Rename Zone', 'Name', id, async (newName) => {
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
        label: 'Delete Zone',
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
      name: `${o.name || 'Prop'} (Copy)`,
      offset: { x: o.offset.x + 32, y: o.offset.y + 32 }
    }
    change({ ...draft, layers: [...draft.layers, clone] })
    setSelected(clone.id)
  }

  const propMenu = (o: ObjectLayerData, e: MenuEvent) => {
    openMenu(e, o.name || 'Map Prop', [
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
        icon: <Shield className="h-4 w-4 text-cyan" />,
        onSelect: () => setObject({ ...o, collision: o.collision === 'passable' ? 'solid' : 'passable' })
      },
      {
        label: 'Duplicate',
        icon: <Copy className="h-4 w-4" />,
        onSelect: () => duplicateObject(o)
      },
      {
        label: 'Delete Prop',
        icon: <Trash2 className="h-4 w-4 text-alert" />,
        danger: true,
        onSelect: () => deleteObject(o.id)
      }
    ])
  }

  const placeObject = (at: Point) => {
    setAddObjectAt(at)
  }

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

  // Resolve active tile layer for painting
  const activeTileLayer = useMemo(() => {
    if (activeLayerId) {
      const found = findLayer(draft.layers, activeLayerId)
      if (found && found.kind === 'tiles') return found as TileLayerData
    }
    // Fallback to first visible tile layer
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
      const assets = await engine('data.assets.list')
      let asset = assets.find((a) => a.name.includes('terrain-map-v7'))
      if (!asset) {
        const imported = await engine('data.assets.import', { paths: ['O:\\GitHub\\seven\\terrain-map-v7.png'] })
        asset = imported[0]
      }
      if (asset) {
        useData.getState().onAsset(asset.id, asset)
      }
      let terrainTileset = draft.tilesets.find((t) => t.name === 'terrain-map-v7')
      if (!terrainTileset && asset) {
        terrainTileset = {
          id: crypto.randomUUID(),
          name: 'terrain-map-v7',
          image: asset.id,
          first: 1,
          tile: { w: 32, h: 32 },
          columns: 124,
          count: 20956,
          margin: 0,
          spacing: 0
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

      // Filter out unpainted placeholder layers if any exist
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
    openMenu(e, showName(draft.name), [
      { label: 'Generate map here', icon: <Sparkles />, onSelect: () => setGeneratorOpen(true) },
      { label: 'Place an object here', icon: <Box />, onSelect: () => placeObject(at) },
      { label: 'Place creature spawner here', icon: <Skull className="text-alert" />, onSelect: () => handlePlaceSpawner(at) },
      { label: 'Add a picture layer here', icon: <ImagePlus />, onSelect: () => addPicture(at) },
      { label: 'New layer group', icon: <FolderPlus />, onSelect: addGroup }
    ])

  const importInto = () => void importMapFile(draft.id).catch(failed('Could not import the map'))

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      {/* Top Header Deck */}
      <EntryHeader
        title={showName(draft.name)}
        kind={usedBy.length ? `Map Editor · used by ${usedBy.join(', ')}` : 'Map Editor · not used by a world yet'}
        onMenu={(e) => entryMenuAt(e, 'map', draft.id, draft.name)}
      >
        <SaveState status={status} error={error} />
      </EntryHeader>

      {/* Main Full-Bleed Canvas Viewport with Floating Overlays */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden border border-line bg-black">
        {draft.layers.length > 0 ? (
          <>
            <MapCanvas
              map={draft}
              shapes={draft.shapes ?? {}}
              place={`map.${draft.id}`}
              selected={selectedShapeId}
              onPick={(s) => {
                setSelected(null)
                setSelectedSpawnerId(null)
                setSelectedShapeId(s.id)
              }}
              onShapeMenu={drawingShape ? undefined : (e, s) => shapeMenu(e, s.id)}
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
              onBlankMenu={drawingShape ? undefined : mapMenu}
              objects={{
                selected,
                onPick: (o) => {
                  setSelected(o.id)
                  setSelectedShapeId(null)
                  setSelectedSpawnerId(null)
                },
                onMenu: (o, e) => propMenu(o, e),
                onChange: (id, patch) =>
                  change({ ...draft, layers: changeLayer(draft.layers, id, (l) => ({ ...l, ...patch }) as MapLayer) })
              }}
              overlay={
                <>
                  {(selectedShapeForm || drawingShape) && (
                    <ShapeEditor
                      size={mapArea(draft)}
                      shapes={
                        drawingShape
                          ? (drawingTempShape ? [drawingTempShape] : [])
                          : (selectedShapeId && selectedShapeForm
                              ? [{ id: selectedShapeId, label: selectedShapeId, form: selectedShapeForm }]
                              : [])
                      }
                      onChange={(list) => {
                        if (drawingShape) {
                          setDrawingTempShape(list[list.length - 1] ?? null)
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
                        if (!newId || !drawingTempShape) {
                          setDrawingTempShape(null)
                          setDrawingShape(null)
                          return
                        }
                        const form = drawingTempShape.form
                        setDrawingTempShape(null)
                        setDrawingShape(null)
                        askText('New Template Zone', 'Name', `Zone ${Object.keys(draft.shapes ?? {}).length + 1}`, async (name) => {
                          const trimmed = name.trim() || `Zone ${Object.keys(draft.shapes ?? {}).length + 1}`
                          change({
                            ...draft,
                            shapes: {
                              ...(draft.shapes ?? {}),
                              [trimmed]: form
                            }
                          })
                          setSelectedShapeId(trimmed)
                        })
                      }}
                      newLabel="New Zone"
                      passThrough
                      onMenu={(e, id) => shapeMenu(e, id)}
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
                    />
                  )}

                  <SpawnerLayer
                    spawners={draft.spawners ?? []}
                    selectedId={selectedSpawnerId}
                    onSelect={(spawner) => {
                      setSelected(null)
                      setSelectedShapeId(null)
                      setSelectedSpawnerId(spawner.id)
                    }}
                    onMove={handleMoveSpawner}
                    onMenu={(spawner, e) => {
                      openMenu(e, spawner.name, [
                        { label: 'Rotate 90°', icon: <RotateCw />, onSelect: () => handleUpdateSpawner({ ...spawner, facing: ((spawner.facing ?? 0) + 90) % 360 }) },
                        { label: 'Delete Spawner', icon: <Trash2 />, danger: true, onSelect: () => handleDeleteSpawner(spawner.id) }
                      ])
                    }}
                  />
                </>
              }
              className="h-full"
            />

            {/* TEMPLATE ZONE SHAPE BANNER */}
            {(tool === 'shape' || selectedShapeId !== null || drawingShape !== null) && (
              <div className="absolute left-1/2 top-14 z-30 flex -translate-x-1/2 items-center gap-2.5 border border-cyan/50 bg-black/95 px-3 py-1.5 font-mono text-[11px] text-cyan shadow-xl backdrop-blur-md">
                {drawingShape ? (
                  <>
                    <span className="font-bold uppercase tracking-wider text-white">
                      Drawing {drawingShape.kind === 'outline' ? 'Outline' : 'Box'} Zone
                    </span>
                    <Segmented
                      value={drawingShape.kind}
                      options={[
                        { value: 'box', label: 'Box' },
                        { value: 'outline', label: 'Outline' }
                      ]}
                      onChange={(k) => setDrawingShape({ kind: k as ShapeKind })}
                    />
                    <span className="text-dim text-[10.5px]">
                      {drawingShape.kind === 'outline' ? 'Click points, double-click to close' : 'Click & drag on map'} · Esc to cancel
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => { setDrawingShape(null); setDrawingTempShape(null) }}>
                      Cancel
                    </Button>
                  </>
                ) : selectedShapeId && selectedShapeForm ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-dim">Zone:</span>
                      <span className="font-bold text-white text-[12px]">{selectedShapeId}</span>
                      <span className="rounded bg-cyan/10 px-1 py-0.5 text-[9.5px] uppercase text-cyan/80">
                        {selectedShapeForm.kind}
                      </span>
                    </div>

                    <span className="text-faint text-[10px]">
                      Drag to move · Drag corner handle to resize · Right-click for menu
                    </span>

                    <div className="flex items-center gap-1 border-l border-line/40 pl-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          askText('Rename Zone', 'Name', selectedShapeId, async (newName) => {
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
                        variant="ghost"
                        onClick={() => {
                          const next = { ...(draft.shapes ?? {}) }
                          delete next[selectedShapeId]
                          change({ ...draft, shapes: next })
                          setSelectedShapeId(null)
                        }}
                        className="text-alert hover:bg-alert/15"
                      >
                        Delete
                      </Button>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedShapeId(null)
                          setDrawingShape({ kind: 'box' })
                        }}
                        icon={<Plus className="h-3 w-3" />}
                      >
                        Draw New Zone
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedShapeId(null)}
                      >
                        Done
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-white">
                      Template Zones ({Object.keys(draft.shapes ?? {}).length})
                    </span>
                    <span className="text-dim text-[10.5px]">
                      Click any zone to move/resize, or draw a new zone:
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setDrawingShape({ kind: 'box' })}
                        icon={<Plus className="h-3 w-3" />}
                      >
                        Draw Box
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDrawingShape({ kind: 'outline' })}
                        icon={<Plus className="h-3 w-3" />}
                      >
                        Draw Outline
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* FLOATING OVERLAY COMMAND BAR (Top Center) */}
            <OverlayToolbar
              tool={tool}
              onSelectTool={handleSelectTool}
              onAddImage={() => addPicture()}
              onToggleGenerator={() => setGeneratorOpen(!generatorOpen)}
              generatorOpen={generatorOpen}
              onToggleLayers={() => setLayersOpen(!layersOpen)}
              layersOpen={layersOpen}
              layerCount={draft.layers.length}
            />

            {/* TACTILE FLOATING LAYER DECK (Top Left) */}
            <LayerDeck
              open={layersOpen}
              onClose={() => setLayersOpen(false)}
              layers={draft.layers}
              activeLayerId={activeTileLayer?.id ?? null}
              onSelectActiveLayer={(id) => setActiveLayerId(id)}
              onChangeLayers={(layers) => change({ ...draft, layers })}
              onAddTileLayer={addTileLayer}
              onAddImageLayer={() => addPicture()}
              onAddObject={() => setAddObjectAt({ x: Math.round(draft.size.w / 2), y: Math.round(draft.size.h / 2) })}
              onAddSpawner={() => handlePlaceSpawner({ x: Math.round(draft.size.w / 2), y: Math.round(draft.size.h / 2) })}
              onAddGroup={addGroup}
            />

            {/* TACTILE IN-CANVAS GENERATOR TRAY (Top Right) */}
            <GeneratorTray
              open={generatorOpen}
              onClose={() => setGeneratorOpen(false)}
              onGenerate={handleGenerate}
            />

            {/* TACTILE TILE PALETTE & BRUSH PICKER (Bottom Center when in Paint mode) */}
            {(tool === 'paint' || tool === 'erase') && (
              <TilePaletteBar
                selectedGid={selectedGid}
                onSelectGid={setSelectedGid}
                brushSize={brushSize}
                onSetBrushSize={setBrushSize}
                activeLayerName={activeTileLayer?.name ?? 'Ground'}
              />
            )}

            {/* Side Panel for Object / Picture details */}
            {object && (
              <SidePanel isExpanded={isDrawerExpanded} onToggleExpand={() => setIsDrawerExpanded((prev) => !prev)}>
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
              </SidePanel>
            )}
            {picture && (
              <SidePanel>
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
              </SidePanel>
            )}

            {selectedSpawner && (
              <SidePanel isExpanded={isDrawerExpanded} onToggleExpand={() => setIsDrawerExpanded((prev) => !prev)}>
                <SpawnerInspector
                  key={selectedSpawner.id}
                  spawner={selectedSpawner}
                  isExpanded={isDrawerExpanded}
                  onToggleExpand={() => setIsDrawerExpanded((prev) => !prev)}
                  onChange={handleUpdateSpawner}
                  onDelete={() => handleDeleteSpawner(selectedSpawner.id)}
                  onClose={() => setSelectedSpawnerId(null)}
                />
              </SidePanel>
            )}

            {/* Status Pill (Bottom Left) */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-3 border border-line bg-black/85 px-2.5 py-1 font-mono text-[11px] text-dim">
              <span>ZOOM: <strong className="text-white">{Math.round(zoom * 100) / 100}×</strong></span>
              <span>TOOL: <strong className="text-accent uppercase">{tool}</strong></span>
              <span>GRID: <strong className="text-cyan">{draft.size.w / 32}×{draft.size.h / 32}</strong></span>
            </div>

            {/* PLACE PREDEFINED OBJECT MODAL */}
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

            {/* PLACE CREATURE SPAWNER MODAL */}
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
          </>
        ) : (
          /* Empty Map State */
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <EmptyState title="Nothing on this map yet">
              Generate a procedural overworld or dungeon map, import a map made in Tiled, or add a picture layer.
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
      </div>
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
          { label: 'Map', done: Boolean(map) },
          { label: 'Pictures', done: Boolean(map) && pictures.done >= pictures.total, detail: map ? `${pictures.done} / ${pictures.total}` : undefined }
        ]}
      />
    )
  return <MapEditor key={id} source={map} />
}
