import { useState, type MouseEvent, type ReactNode } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { mapArea, placeId, placeTree, type MapData, type PlaceVisitor, type WorldMapUse } from '@shared/maps'
import type { Point, ShapeForm, ShapeKind } from '@shared/shapes'
import { PLACE_TYPE_KEY, recordKey } from '@shared/world'
import { showName } from '@shared/ids'
import { EmptyState, Eyebrow, LoadingScreen, Segmented, askText, openMenu, useDraft, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { entryMenuAt } from '../../views/data/entryMenu'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { MapCanvas } from './MapCanvas'
import { PlaceTree } from './PlaceTree'
import { PlaceCard } from './PlaceCard'
import { placeName } from './placeShapes'
import { usePlaceData, type PlaceData } from './usePlaceRecords'
import { useMapPictures } from './useMapPictures'
import { characterItems, placeItems } from './placeActions'
import { objectHandlers } from './objectActions'
import { useMapTokens } from './useMapTokens'
import { PresenceMarkers } from './PresenceMarkers'
import { useEscapeLayer } from '../../lib/escape'
import { useMap, useWorldMaps } from './useMap'
import { useWorldPlayer } from '../play/useWorldPlayer'

const FORMS: { value: ShapeKind; label: string }[] = [
  { value: 'outline', label: 'Outline' },
  { value: 'box', label: 'Box' }
]

function PlacesOnMap({ world, map, source, data, onStart }: { world: string; map: MapData; source: WorldMapUse; data: PlaceData; onStart: (place: string) => void }) {
  const { places, changes, here } = data
  const { draft, change } = useDraft(source, (use) => engine('worlds.saveMapUse', { id: world, use }))
  const [selected, setSelected] = useState<string | null>(null)
  const player = useWorldPlayer(world)
  const [drawing, setDrawing] = useState<{ kind: ShapeKind; from?: Point } | null>(null)
  const shape = selected ? draft.shapes[selected] : undefined

  const setShape = (key: string, form: ShapeForm | null) => {
    const { [key]: _old, ...rest } = draft.shapes
    change({ ...draft, shapes: form ? { ...rest, [key]: form } : rest })
  }
  const select = (key: string | null) => {
    setDrawing(null)
    setSelected(key)
  }
  const open = Boolean(selected && places[selected])
  useEscapeLayer(open && !drawing, () => select(null))
  const newPlace = (inside: string | null, at?: Point) =>
    askText(inside ? `New place inside ${placeName(places, inside)}` : 'New place', 'Name', '', async (name) => {
      const key = recordKey(name)
      if (!key) return
      if (!places[key]) await engine('worlds.put', { id: world, type: PLACE_TYPE_KEY, key, entity: { Name: name.trim(), Inside: inside ?? '' } })
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
  const placeMenu = (e: MouseEvent, key: string) => entryMenuAt(e, 'place', placeId(world, key), placeName(places, key), [{ label: 'Open', icon: <FolderOpen />, onSelect: () => select(key) }, ...actionsFor(key)])
  const characterMenu = (e: MouseEvent, v: PlaceVisitor, at: string) => openMenu(e, v.name, characterItems(v, places, at))
  const people = useMapTokens({ world, use: draft, places, player, editing: true, save: change })
  const mapMenu = (e: MouseEvent, at: Point) =>
    openMenu(e, showName(map.name), [
      { label: 'New place here', icon: <Plus />, onSelect: () => newPlace(null, at) },
      people.putHere(at),
      ...(selected ? [{ label: `New place inside ${placeName(places, selected)} here`, icon: <Plus />, onSelect: () => newPlace(selected, at) }] : [])
    ])
  const addMenu = (e: MouseEvent) =>
    selected
      ? openMenu(e, 'New place', [
          { label: 'New place', onSelect: () => newPlace(null) },
          { label: `New place inside ${placeName(places, selected)}`, onSelect: () => newPlace(selected) }
        ])
      : newPlace(null)

  const area = mapArea(map)
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
        marks={() => (here[selected]?.length ? <PresenceMarkers visitors={here[selected]} onMenu={(e, v) => characterMenu(e, v, selected)} /> : null)}
        className="absolute left-0 top-0"
      >
        <div style={{ width: area.w, height: area.h }} />
      </ShapeEditor>
    ) : undefined

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)] border border-line/40 bg-black/40">
      <div className="flex min-h-0 flex-col border-r border-line/40">
        <div className="flex items-center gap-2 border-b border-line/40 px-2.5 py-2">
          <Eyebrow>Places</Eyebrow>
          <span className="flex-1" />
          <button type="button" title="New place" onClick={addMenu} className="text-accent hover:text-white">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          <PlaceTree nodes={placeTree(places, draft.shapes)} selected={selected} onSelect={select} onMenu={placeMenu} />
        </div>
      </div>
      <div className="relative flex min-h-0 flex-col">
        {map.layers.length ? (
          <div className="relative min-h-0 flex-1">
            <MapCanvas map={map} shapes={draft.shapes} places={places} here={here} place={`world.${world}.${map.id}`} selected={selected} onPick={(s) => select(s.id)} onBlank={drawing ? undefined : () => select(null)} onShapeMenu={drawing ? undefined : (e, s) => placeMenu(e, s.id)} onBlankMenu={drawing ? undefined : mapMenu} onCharacterMenu={characterMenu} objects={objectHandlers(world, map.id, player)} tokens={people.tokens} onToken={people.handlers} overlay={overlay} className="h-full" />
            {drawing && selected && (
              <div className="absolute left-1/2 top-2.5 z-10 flex -translate-x-1/2 items-center gap-2 border border-cyan/40 bg-black/90 px-2.5 py-1.5 font-mono text-[11px] text-cyan">
                <span>Shape for {placeName(places, selected)}</span>
                <Segmented value={drawing.kind} options={FORMS} onChange={(kind) => setDrawing({ kind, from: drawing.from })} />
                <span className="text-faint">{drawing.kind === 'outline' ? 'click points, double-click to close' : 'drag a box'} · Esc to stop</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
            <EmptyState title="Nothing on this map yet">Open it in Maps to add pictures or import a map made in Tiled.</EmptyState>
          </div>
        )}
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
      </div>
    </div>
  )
}

export function WorldMapLoad({ world, mapId, children }: { world: string; mapId: string; children: (map: MapData, use: WorldMapUse, data: PlaceData) => ReactNode }) {
  const map = useMap(mapId)
  const use = useWorldMaps(world)?.find((u) => u.map === mapId)
  const data = usePlaceData(world)
  const pictures = useMapPictures(map)
  if (map === false) return <EmptyState title="Gone">This map no longer exists.</EmptyState>
  if (!map || !use || !data || pictures.done < pictures.total)
    return (
      <LoadingScreen
        title={map ? showName(map.name) : 'map'}
        steps={[
          { label: 'Map', done: Boolean(map && use) },
          { label: 'Places and who is here', done: Boolean(data) },
          { label: 'Pictures', done: Boolean(map) && pictures.done >= pictures.total, detail: map ? `${pictures.done} / ${pictures.total}` : undefined }
        ]}
      />
    )
  return <>{children(map, use, data)}</>
}

export function WorldMapView({ world, mapId, onStart }: { world: string; mapId: string; onStart: (place: string) => void }) {
  return (
    <WorldMapLoad world={world} mapId={mapId}>
      {(map, use, data) => <PlacesOnMap key={`${world}/${mapId}`} world={world} map={map} source={use} data={data} onStart={onStart} />}
    </WorldMapLoad>
  )
}
