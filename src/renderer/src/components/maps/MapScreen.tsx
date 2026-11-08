import { useState, useMemo, type MouseEvent, type ReactNode } from 'react'
import { Box, Check, FileUp, FolderPlus, ImagePlus, Sparkles, Trash2 } from 'lucide-react'
import {
  ANY_ZOOM,
  changeLayer,
  findLayer,
  newGroup,
  type MapData,
  type MapLayer,
  type ObjectLayerData,
  type TileLayerData
} from '@shared/maps'
import type { Point, ShapeForm } from '@shared/shapes'
import { boxForm } from '@shared/shapes'
import { showName } from '@shared/ids'
import type { KindScreenProps } from '../../registries/kinds'
import { Button, EmptyState, EntryHeader, LoadingScreen, SaveState, askText, openMenu, useDraft } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { useData } from '../../store/data'
import { entryMenuAt } from '../../views/data/entryMenu'
import { MapCanvas } from './MapCanvas'
import { PicturePanel } from './PicturePanel'
import { addImageLayer, addObject } from './addImageLayer'
import { objectItems, objectPlay } from './objectActions'
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

function SidePanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-y-0 right-0 z-20 flex min-h-0 w-[320px] flex-col border-l border-line bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.7)]">
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

  // Local shapes placed on this map
  const [localShapes, setLocalShapes] = useState<Record<string, ShapeForm>>({})

  const layer = selected ? findLayer(draft.layers, selected) : null
  const object = layer?.kind === 'object' ? layer : null
  const picture = layer?.kind === 'image' ? layer : null
  useEscapeLayer(object !== null || picture !== null, () => setSelected(null))

  const setLayer = (next: MapLayer) => change({ ...draft, layers: changeLayer(draft.layers, next.id, () => next) })
  const setObject = (next: ObjectLayerData) => setLayer(next)
  const playOf = (o: ObjectLayerData) => objectPlay(o, draft.id, null, [], setObject)
  const itemsOf = (o: ObjectLayerData) =>
    objectItems(o, playOf(o), {
      onEdit: () => setSelected(o.id),
      onDelete: () => {
        setSelected((s) => (s === o.id ? null : s))
        change({ ...draft, layers: changeLayer(draft.layers, o.id, () => null) })
      }
    })

  const placeObject = (at: Point) =>
    void addObject(draft, at)
      .then((made) => {
        if (!made) return
        change(made.map)
        setSelected(made.id)
      })
      .catch(failed('Could not place the object'))

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

  const handleAddShape = (start: Point, end: Point) => {
    askText('New Zone / Place', 'Place name', 'New POI', async (name) => {
      if (!name.trim()) return
      const id = crypto.randomUUID()
      const box = boxForm(start, end)
      setLocalShapes((prev) => ({ ...prev, [id]: box }))
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
      { label: 'Add a picture layer here', icon: <ImagePlus />, onSelect: () => addPicture(at) },
      { label: 'New layer group', icon: <FolderPlus />, onSelect: addGroup }
    ])

  const importInto = () => void importMapFile(draft.id).catch(failed('Could not import the map'))

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2">
      {/* Top Header Deck */}
      <EntryHeader
        title={showName(draft.name)}
        kind={usedBy.length ? `Map · used by ${usedBy.join(', ')}` : 'Map · not used by a world yet'}
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
              shapes={localShapes}
              place={`map.${draft.id}`}
              onZoom={setZoom}
              onBlank={() => setSelected(null)}
              onBlankMenu={mapMenu}
              objects={{
                selected,
                onPick: (o) => setSelected(o.id),
                onMenu: (o, e) => openMenu(e, o.name, itemsOf(o)),
                onChange: (id, patch) =>
                  change({ ...draft, layers: changeLayer(draft.layers, id, (l) => ({ ...l, ...patch }) as MapLayer) })
              }}
              overlay={
                <MapInteractionOverlay
                  map={draft}
                  tool={tool}
                  activeTileLayer={activeTileLayer}
                  selectedGid={selectedGid}
                  brushSize={brushSize}
                  zoom={zoom}
                  onPaintTiles={handlePaintTiles}
                  onAddShape={handleAddShape}
                  onPlaceObject={placeObject}
                />
              }
              className="h-full"
            />

            {/* FLOATING OVERLAY COMMAND BAR (Top Center) */}
            <OverlayToolbar
              tool={tool}
              onSelectTool={setTool}
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
              <SidePanel>
                <ObjectPanel key={object.id} object={object} play={playOf(object)} actions={itemsOf(object)} onChange={setObject} />
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

            {/* Status Pill (Bottom Left) */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-3 border border-line bg-black/85 px-2.5 py-1 font-mono text-[11px] text-dim">
              <span>ZOOM: <strong className="text-white">{Math.round(zoom * 100) / 100}×</strong></span>
              <span>TOOL: <strong className="text-accent uppercase">{tool}</strong></span>
              <span>GRID: <strong className="text-cyan">{draft.size.w / 32}×{draft.size.h / 32}</strong></span>
            </div>
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
