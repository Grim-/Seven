import type { MouseEvent, ReactNode } from 'react'
import { mapArea, type PlaceVisitor, type MapData } from '@shared/maps'
import type { WorldEntity } from '@shared/world'
import type { Point, Shape, ShapeForm } from '@shared/shapes'
import { Viewport } from '../space/Viewport'
import { ShapeOverlay } from '../shapes/ShapeOverlay'
import { LayerStack } from './LayerStack'
import { placeShapes } from './placeShapes'
import { PresenceMarkers } from './PresenceMarkers'
import { MapObjects, type MapObjectHandlers } from './mapObjects'
import { TokenLayer, type MapToken, type TokenHandlers } from './TokenLayer'

const NO_OBJECTS: MapObjectHandlers = {}

interface Props {
  map: MapData
  shapes?: Record<string, ShapeForm>
  places?: Record<string, WorldEntity>
  here?: Record<string, PlaceVisitor[]>
  place?: string
  still?: boolean
  selected?: string | null
  onPick?: (shape: Shape) => void
  onBlank?: (at: Point) => void
  onShapeMenu?: (e: MouseEvent, shape: Shape) => void
  onBlankMenu?: (e: MouseEvent, at: Point) => void
  onCharacterMenu?: (e: MouseEvent, visitor: PlaceVisitor, place: string) => void
  onZoom?: (scale: number) => void
  objects?: MapObjectHandlers
  tokens?: MapToken[]
  onToken?: TokenHandlers
  overlay?: ReactNode
  className?: string
}

export function MapCanvas({ map, shapes = {}, places = {}, here = {}, place, still, selected, onPick, onBlank, onShapeMenu, onBlankMenu, onCharacterMenu, onZoom, objects = NO_OBJECTS, tokens = [], onToken = {}, overlay, className }: Props) {
  const standing = new Set(tokens.map((t) => t.visitor.sheet))
  const marked = (place: string) => (here[place] ?? []).filter((v) => !standing.has(v.sheet))
  const area = mapArea(map)
  return (
    <Viewport size={area} place={place} still={still} onBlank={onBlank} onBlankMenu={onBlankMenu} onZoom={onZoom} className={className}>
      <MapObjects.Provider value={objects}>
        <LayerStack map={map} />
      </MapObjects.Provider>
      <ShapeOverlay size={area} shapes={placeShapes(shapes, places).filter((s) => !overlay || s.id !== selected)} selected={selected} onPick={onPick} onMenu={onShapeMenu} marks={(s) => (marked(s.id).length ? <PresenceMarkers visitors={marked(s.id)} onMenu={onCharacterMenu && ((e, v) => onCharacterMenu(e, v, s.id))} /> : null)} />
      {tokens.length > 0 && <TokenLayer tokens={tokens} handlers={onToken} mapSize={map.tile.w * 2} />}
      {overlay}
    </Viewport>
  )
}
