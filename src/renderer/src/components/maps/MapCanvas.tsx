import { useState, type MouseEvent, type ReactNode } from 'react'
import { mapArea, type ConditionGating, type MapLink, type PlaceVisitor, type MapData, type CreatureSpawner } from '@shared/maps'
import type { WorldEntity } from '@shared/world'
import type { Point, Shape, ShapeForm } from '@shared/shapes'
import type { TriggerDef } from '@shared/game/triggers'
import { Viewport } from '../space/Viewport'
import { ShapeOverlay } from '../shapes/ShapeOverlay'
import { TriggerOverlay } from './TriggerOverlay'
import { SpawnerLayer } from './SpawnerLayer'
import { LayerStack } from './LayerStack'
import { placeShapes, regionShapesOf } from './placeShapes'
import { PresenceMarkers } from './PresenceMarkers'
import { MapObjects, type MapObjectHandlers } from './mapObjects'
import { TokenLayer, type MapToken, type TokenHandlers } from './TokenLayer'
import { collectThings, thingsIn, useThingPicking, LinkLines, OffMarks, PickChip, SelectionRings, type MapThing } from './things'

const NO_OBJECTS: MapObjectHandlers = {}
const NONE: string[] = []

export interface MapCanvasProps {
  map: MapData
  shapes?: Record<string, ShapeForm>
  regionShapes?: Record<string, ShapeForm>
  places?: Record<string, WorldEntity>
  regions?: Record<string, WorldEntity>
  here?: Record<string, PlaceVisitor[]>
  place?: string
  still?: boolean
  focus?: { at: Point; seq: number } | null
  suspendHits?: boolean
  selected?: string | null
  selectedRegion?: string | null
  onPick?: (shape: Shape) => void
  onPickRegion?: (shape: Shape) => void
  onBlank?: (at: Point) => void
  onShapeMenu?: (e: MouseEvent, shape: Shape) => void
  onRegionMenu?: (e: MouseEvent, shape: Shape) => void
  onBlankMenu?: (e: MouseEvent, at: Point) => void
  onCharacterMenu?: (e: MouseEvent, visitor: PlaceVisitor, place: string) => void
  onZoom?: (scale: number) => void
  objects?: MapObjectHandlers
  tokens?: MapToken[]
  onToken?: TokenHandlers
  triggers?: TriggerDef[]
  selectedTrigger?: string | null
  onPickTrigger?: (trigger: TriggerDef) => void
  onMoveTrigger?: (id: string, delta: Point) => void
  onResizeTrigger?: (id: string, w: number, h: number) => void
  onTriggerMenu?: (e: MouseEvent, trigger: TriggerDef) => void
  spawners?: CreatureSpawner[]
  selectedSpawner?: string | null
  onPickSpawner?: (spawner: CreatureSpawner) => void
  onMoveSpawner?: (id: string, at: Point) => void
  onSpawnerMenu?: (spawner: CreatureSpawner, e: MouseEvent) => void
  layerGating?: Record<string, ConditionGating>
  propGating?: Record<string, ConditionGating>
  flags?: Record<string, string | number | boolean>
  selection?: string[]
  onSelection?: (keys: string[]) => void
  onSelectionMenu?: (e: MouseEvent, keys: string[]) => void
  intercept?: (thing: MapThing) => boolean
  links?: MapLink[]
  linkFocus?: string[]
  linkLabel?: (link: MapLink) => string
  onLinkMenu?: (e: MouseEvent, link: MapLink) => void
  isOff?: (key: string) => boolean
  underlay?: ReactNode
  overlay?: ReactNode
  className?: string
}

export function MapCanvas(props: MapCanvasProps) {
  const {
    map,
    shapes = {},
    regionShapes = {},
    places = {},
    regions = {},
    here = {},
    place,
    still,
    focus,
    suspendHits = false,
    selected,
    selectedRegion,
    onBlank,
    onBlankMenu,
    onCharacterMenu,
    onZoom,
    objects = NO_OBJECTS,
    tokens = [],
    onToken = {},
    triggers = [],
    selectedTrigger,
    onPickTrigger,
    onMoveTrigger,
    onResizeTrigger,
    onTriggerMenu,
    spawners,
    selectedSpawner,
    onPickSpawner,
    onMoveSpawner,
    onSpawnerMenu,
    layerGating,
    propGating,
    flags,
    selection = NONE,
    onSelection,
    onSelectionMenu,
    intercept,
    links = [],
    linkFocus = NONE,
    linkLabel,
    onLinkMenu,
    isOff,
    underlay,
    overlay,
    className
  } = props
  const [zoom, setZoom] = useState(1)
  const activeSpawners = spawners ?? map.spawners ?? []
  const standing = new Set(tokens.map((t) => t.visitor.sheet))
  const marked = (placeKey: string) => (here[placeKey] ?? []).filter((v) => !standing.has(v.sheet))
  const area = mapArea(map)
  const things = () => collectThings({ props, zoom })
  const picking = useThingPicking({ area, enabled: !suspendHits, things, selection, onSelection, onSelectionMenu, intercept })
  const shownLinks = links.filter((l) => linkFocus.includes(l.from) || linkFocus.includes(l.to))
  const needThings = selection.length > 1 || shownLinks.length > 0 || Boolean(isOff)
  const all = needThings ? things() : []
  const rings = selection.length > 1 ? all.filter((t) => selection.includes(t.key)) : []
  const off = isOff ? all.filter((t) => isOff(t.key)) : []

  const blank = (at: Point) => {
    picking.clearChip()
    if (selection.length) onSelection?.([])
    onBlank?.(at)
  }
  const boxSelect = (a: Point, b: Point, add: boolean) => {
    const keys = thingsIn(things(), a, b).map((t) => t.key)
    onSelection?.(add ? [...new Set([...selection, ...keys])] : keys)
  }

  return (
    <Viewport
      size={area}
      place={place}
      still={still}
      focus={focus}
      onBlank={onBlank || onSelection ? blank : undefined}
      onBlankMenu={onBlankMenu}
      onBoxSelect={onSelection && !suspendHits ? boxSelect : undefined}
      onZoom={(scale) => {
        setZoom(scale)
        onZoom?.(scale)
      }}
      className={className}
    >
      <div style={{ width: area.w, height: area.h }} className="absolute left-0 top-0" {...picking.handlers}>
        <MapObjects.Provider value={objects}>
          <LayerStack map={map} gating={layerGating} propGating={propGating} flags={flags} />
        </MapObjects.Provider>
        {underlay}
        <ShapeOverlay size={area} variant="region" shapes={regionShapesOf(regionShapes, regions).filter((s) => !overlay || s.id !== selectedRegion)} selected={selectedRegion} routed className="z-[2] opacity-85" />
        <ShapeOverlay
          size={area}
          variant="place"
          shapes={placeShapes(shapes, places).filter((s) => !overlay || s.id !== selected)}
          selected={selected}
          routed
          marks={(s) => (marked(s.id).length ? <PresenceMarkers visitors={marked(s.id)} onMenu={onCharacterMenu && ((e, v) => onCharacterMenu(e, v, s.id))} /> : null)}
        />
        {triggers.length > 0 && (
          <TriggerOverlay
            size={area}
            triggers={triggers}
            selected={selectedTrigger}
            onPick={onPickTrigger}
            onMove={suspendHits ? undefined : onMoveTrigger}
            onResize={suspendHits ? undefined : onResizeTrigger}
            onMenu={onTriggerMenu}
            routed
          />
        )}
        {activeSpawners.length > 0 && (
          <SpawnerLayer spawners={activeSpawners} selectedId={selectedSpawner ?? null} onSelect={onPickSpawner ?? (() => {})} onMove={onMoveSpawner ?? (() => {})} onMenu={onSpawnerMenu} />
        )}
        {tokens.length > 0 && <TokenLayer tokens={tokens} handlers={onToken} mapSize={map.tile.w * 2} />}
        {off.length > 0 && <OffMarks things={off} />}
        {shownLinks.length > 0 && <LinkLines size={area} links={shownLinks} things={all} label={linkLabel} onMenu={onLinkMenu} />}
        {rings.length > 0 && <SelectionRings things={rings} />}
        {picking.chip && <PickChip chip={picking.chip} />}
      </div>
      {overlay}
    </Viewport>
  )
}
