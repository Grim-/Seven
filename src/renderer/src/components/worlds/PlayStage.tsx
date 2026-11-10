import { useEffect, useRef } from 'react'
import type { MapData, PlaceVisitor } from '@shared/maps'
import type { Point, ShapeForm } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'
import type { TriggerDef } from '@shared/game/triggers'
import type { GameSave } from '@shared/game/save'
import type { MenuEvent } from '../ui'
import { placeName } from '../maps/placeShapes'
import type { MapObjectHandlers } from '../maps/mapObjects'
import type { MapToken, TokenHandlers } from '../maps/TokenLayer'
import { GameCanvas } from '../../game/react/GameCanvas'
import { useLatest } from '../../game/react/useLatest'
import { ExploreScene, type ExploreData } from '../../game/explore/ExploreScene'
import type { ClockView } from '../../game/explore/WorldClock'
import type { View } from '../../game/engine/Camera'
import { engine as ipc } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useGameCatalog } from '../game/useGameCatalog'

import type { BattleState } from '@shared/game/state/BattleStateMachine'

export interface ClockControls {
  setSpeed: (speed: number) => void
  setPaused: (paused: boolean) => void
}

export interface StageNavigation {
  walkTo: (target: Point, onArrive?: () => void) => boolean
  smartApproach: (target: Point, onReach: () => void, reachDistance?: number) => boolean
  stopWalk: () => void
  centerOn?: (point: Point, zoom?: number) => void
  focusEncounter?: (points: Point[], minZoom?: number, maxZoom?: number) => void
  resetCamera?: () => void
}

interface Props {
  world: string
  map: MapData
  shapes: Record<string, ShapeForm>
  places: Record<string, WorldEntity>
  here: Record<string, PlaceVisitor[]>
  place: string
  tokens: MapToken[]
  mine: string | null
  selected: string | null
  onPlace: (key: string | null) => void
  onBlankMenu: (e: MenuEvent, at: Point) => void
  tokenHandlers: TokenHandlers
  objects: MapObjectHandlers
  save: GameSave | null
  triggers: TriggerDef[]
  onTrigger: (trigger: TriggerDef, sheet: string) => void
  onTime?: (view: ClockView | null) => void
  onClock?: (controls: ClockControls | null) => void
  onNavigation?: (nav: StageNavigation | null) => void
  onTarget?: (target: { sheet: string | null; at: Point; label: string }) => boolean
  onCamera?: (camera: View) => void
  aiming?: boolean
  battle?: BattleState | null
  className?: string
}

export function PlayStage({ world, save, triggers, onTrigger, map, shapes, places, here, place, tokens, mine, selected, onPlace, onBlankMenu, tokenHandlers, objects, onTime, onClock, onNavigation, onTarget, onCamera, aiming = false, battle = null, className }: Props) {
  const catalog = useGameCatalog()
  const data: ExploreData = { map, shapes, names: Object.fromEntries(Object.keys(shapes).map((k) => [k, placeName(places, k)])), tokens, markers: here, mine, selected, catalog, save: save ? { id: save.id, clockId: save.clockId, clock: save.clock } : null, triggers, used: save?.used ?? [], aiming, battle }
  const latest = useLatest({ data, world, onTrigger, onPlace, onBlankMenu, tokenHandlers, objects, onTime, onClock, onNavigation, onTarget, onCamera })
  const scene = useRef<ExploreScene | null>(null)

  useEffect(() => {
    scene.current?.setData(data)
  })

  return (
    <GameCanvas
      place={place}
      className={className}
      onReady={(engine, view) => {
        const s = new ExploreScene(latest.current.data, view)
        const on = s.events
        on.on('place', ({ key, hit }) => {
          if (latest.current.onTarget?.({ sheet: null, at: hit.world, label: 'there' })) return
          latest.current.onPlace(key)
        })
        on.on('blankMenu', ({ hit }) => latest.current.onTarget?.({ sheet: null, at: hit.world, label: 'there' }) || latest.current.onBlankMenu(hit.native, hit.world))
        on.on('token', ({ token, hit }) => latest.current.onTarget?.({ sheet: token.visitor.sheet, at: token.at, label: token.visitor.name }) || latest.current.tokenHandlers.onPick?.(token, hit.native))
        on.on('tokenMenu', ({ token, hit }) => latest.current.tokenHandlers.onMenu?.(token, hit.native))
        on.on('tokenMove', ({ sheet, at }) => latest.current.tokenHandlers.onMove?.(sheet, at))
        on.on('arrive', ({ sheet, at, place }) => {
          latest.current.tokenHandlers.onMove?.(sheet, at)
          latest.current.onPlace(place)
        })
        on.on('object', ({ object, hit }) => latest.current.onTarget?.({ sheet: null, at: hit.world, label: 'the object' }) || latest.current.objects.onPick?.(object, hit.native))
        on.on('objectMenu', ({ object, hit }) => latest.current.objects.onMenu?.(object, hit.native))
        on.on('time', (view) => latest.current.onTime?.(view))
        on.on('camera', (cam) => latest.current.onCamera?.(cam))
        on.on('trigger', ({ id, sheet }) => {
          const found = latest.current.data.triggers.find((t) => t.id === id)
          if (found) latest.current.onTrigger(found, sheet)
        })
        on.on('tick', ({ seconds }) => {
          const sheets = latest.current.data.tokens.filter((t) => t.visitor.game).map((t) => t.visitor.sheet)
          if (sheets.length) void ipc('game.tickCharacters', { sheets, seconds }).catch(failed('Could not move time on for the characters'))
        })
        on.on('clockSave', ({ save, clockId, clock }) => void ipc('saves.writeClock', { id: save, clockId, clock }).catch(failed('Could not save the time')))
        engine.scenes.replace(s)
        scene.current = s
        latest.current.onClock?.({ setSpeed: (n) => s.setSpeed(n), setPaused: (p) => s.setPaused(p) })
        latest.current.onNavigation?.({
          walkTo: (t, cb) => s.walkTo(t, cb),
          smartApproach: (t, cb, d) => s.smartApproach(t, cb, d),
          stopWalk: () => s.stopWalk(),
          centerOn: (pt, zoom) => s.centerOn(pt, zoom),
          focusEncounter: (points, minZoom, maxZoom) => s.focusEncounter(points, minZoom, maxZoom),
          resetCamera: () => s.resetCamera()
        })
        return () => {
          latest.current.onClock?.(null)
          latest.current.onNavigation?.(null)
          scene.current = null
          engine.scenes.clear()
        }
      }}
    />
  )
}
