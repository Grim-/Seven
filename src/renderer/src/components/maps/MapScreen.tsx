import { useState, type MouseEvent, type ReactNode } from 'react'
import { Box, Check, FileUp, FolderPlus, ImagePlus, Trash2 } from 'lucide-react'
import { changeLayer, findLayer, newGroup, type MapData, type MapLayer, type ObjectLayerData } from '@shared/maps'
import type { Point } from '@shared/shapes'
import { showName } from '@shared/ids'
import type { KindScreenProps } from '../../registries/kinds'
import { Button, EmptyState, EntryHeader, Eyebrow, LoadingScreen, SaveState, askText, openMenu, useDraft } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { entryMenuAt } from '../../views/data/entryMenu'
import { MapCanvas } from './MapCanvas'
import { LayerList, removeLayer } from './LayerList'
import { PicturePanel } from './PicturePanel'
import { addImageLayer, addObject } from './addImageLayer'
import { objectItems, objectPlay } from './objectActions'
import { ObjectPanel } from './ObjectPanel'
import { useEscapeLayer } from '../../lib/escape'
import { importMapFile } from './importMapFile'
import { useMapPictures } from './useMapPictures'
import { useMap } from './useMap'

function SidePanel({ children }: { children: ReactNode }) {
  return <div className="absolute inset-y-0 right-0 z-20 flex min-h-0 w-[320px] flex-col border-l border-line/60 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.5)]">{children}</div>
}

function MapEditor({ source }: { source: MapData }) {
  const { draft, change, status, error } = useDraft(source, (map) => engine('maps.save', { map }))
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
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
  const addGroup = () => askText('New layer group', 'Name', '', async (name) => {
      if (name.trim()) change({ ...draft, layers: [...draft.layers, newGroup(name.trim())] })
    })
  const mapMenu = (e: MouseEvent, at: Point) =>
    openMenu(e, showName(draft.name), [
      { label: 'Place an object here', icon: <Box />, onSelect: () => placeObject(at) },
      { label: 'Add a picture layer here', icon: <ImagePlus />, onSelect: () => addPicture(at) },
      { label: 'New layer group', icon: <FolderPlus />, onSelect: addGroup }
    ])
  const importInto = () => void importMapFile(draft.id).catch(failed('Could not import the map'))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <EntryHeader title={showName(draft.name)} kind={usedBy.length ? `Map · used by ${usedBy.join(', ')}` : 'Map · not used by a world yet'} onMenu={(e) => entryMenuAt(e, 'map', draft.id, draft.name)}>
        <SaveState status={status} error={error} />
      </EntryHeader>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)] border border-line/40 bg-black/40">
        <div className="flex min-h-0 flex-col border-r border-line/40">
          <div className="flex items-center gap-2 border-b border-line/40 px-2.5 py-2">
            <Eyebrow>Layers</Eyebrow>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" icon={<ImagePlus />} onClick={() => addPicture()}>
              Picture
            </Button>
            <Button size="sm" variant="ghost" icon={<FolderPlus />} onClick={addGroup}>
              Group
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            <LayerList layers={draft.layers} zoom={zoom} selected={selected} onSelect={setSelected} onChange={(layers) => change({ ...draft, layers })} />
          </div>
        </div>
        {draft.layers.length ? (
          <div className="relative min-h-0">
            <MapCanvas
              map={draft}
              place={`map.${draft.id}`}
              onZoom={setZoom}
              onBlank={() => setSelected(null)}
              onBlankMenu={mapMenu}
              objects={{ selected, onPick: (o) => setSelected(o.id), onMenu: (o, e) => openMenu(e, o.name, itemsOf(o)), onChange: (id, patch) => change({ ...draft, layers: changeLayer(draft.layers, id, (l) => ({ ...l, ...patch }) as MapLayer) }) }}
              className="h-full"
            />
            <span className="pointer-events-none absolute left-2.5 top-2.5 border border-line/40 bg-black/85 px-2 py-0.5 font-mono text-[11px] text-dim">zoom {Math.round(zoom * 100) / 100}×</span>
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
                    { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: () => removeLayer(draft.layers, picture, (layers) => (setSelected(null), change({ ...draft, layers }))) }
                  ]}
                />
              </SidePanel>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-6">
            <EmptyState title="Nothing on this map yet">Add a picture as its first layer, or import a map made in Tiled.</EmptyState>
            <Button size="sm" variant="ghost" icon={<FileUp />} onClick={importInto}>
              Import a map
            </Button>
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
