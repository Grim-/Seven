import type { MouseEvent, ReactNode } from 'react'
import { mapArea, type ConditionGating, type PlaceVisitor, type MapData, type CreatureSpawner } from '@shared/maps'
import type { WorldEntity } from '@shared/world'
import type { Point, Shape, ShapeForm } from '@shared/shapes'
import type { TriggerDef } from '@shared/game/triggers'
import { Viewport } from '../space/Viewport'
import { ShapeOverlay } from '../shapes/ShapeOverlay'
import { TriggerOverlay } from './TriggerOverlay'
import { SpawnerLayer } from './SpawnerLayer'
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
  triggers?: TriggerDef[]
  selectedTrigger?: string | null
  onPickTrigger?: (trigger: TriggerDef) => void
  onTriggerMenu?: (e: MouseEvent, trigger: TriggerDef) => void
  spawners?: CreatureSpawner[]
  selectedSpawner?: string | null
  onPickSpawner?: (spawner: CreatureSpawner) => void
  onMoveSpawner?: (id: string, at: Point) => void
  onSpawnerMenu?: (spawner: CreatureSpawner, e: MouseEvent) => void
  layerGating?: Record<string, ConditionGating>
  propGating?: Record<string, ConditionGating>
  flags?: Record<string, string | number | boolean>
  overlay?: ReactNode
  className?: string
}

export function MapCanvas({
  map,
  shapes = {},
  places = {},
  here = {},
  place,
  still,
  selected,
  onPick,
  onBlank,
  onShapeMenu,
  onBlankMenu,
  onCharacterMenu,
  onZoom,
  objects = NO_OBJECTS,
  tokens = [],
  onToken = {},
  triggers = [],
  selectedTrigger,
  onPickTrigger,
  onTriggerMenu,
  spawners,
  selectedSpawner,
  onPickSpawner,
  onMoveSpawner,
  onSpawnerMenu,
  layerGating,
  propGating,
  flags,
  overlay,
  className
}: Props) {
  const activeSpawners = spawners ?? map.spawners ?? []
  const standing = new Set(tokens.map((t) => t.visitor.sheet))
  const marked = (place: string) => (here[place] ?? []).filter((v) => !standing.has(v.sheet))
  const area = mapArea(map)
  return (
    <Viewport size={area} place={place} still={still} onBlank={onBlank} onBlankMenu={onBlankMenu} onZoom={onZoom} className={className}>
      <MapObjects.Provider value={objects}>
        <LayerStack map={map} gating={layerGating} propGating={propGating} flags={flags} />
      </MapObjects.Provider>
      <ShapeOverlay
        size={area}
        shapes={placeShapes(shapes, places).filter((s) => !overlay || s.id !== selected)}
        selected={selected}
        onPick={onPick}
        onMenu={onShapeMenu}
        marks={(s) => (marked(s.id).length ? <PresenceMarkers visitors={marked(s.id)} onMenu={onCharacterMenu && ((e, v) => onCharacterMenu(e, v, s.id))} /> : null)}
      />
      {triggers.length > 0 && (
        <TriggerOverlay
          size={area}
          triggers={triggers}
          selected={selectedTrigger}
          onPick={onPickTrigger}
          onMenu={onTriggerMenu}
        />
      )}
      {activeSpawners.length > 0 && (
        <SpawnerLayer
          spawners={activeSpawners}
          selectedId={selectedSpawner ?? null}
          onSelect={onPickSpawner ?? (() => {})}
          onMove={onMoveSpawner ?? (() => {})}
          onMenu={onSpawnerMenu}
        />
      )}
      {tokens.length > 0 && <TokenLayer tokens={tokens} handlers={onToken} mapSize={map.tile.w * 2} />}
      {overlay}
    </Viewport>
  )
}
