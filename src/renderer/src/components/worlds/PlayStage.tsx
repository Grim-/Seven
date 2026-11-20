import { useEffect, useMemo, useRef } from 'react'
import type { MapData, PlaceVisitor } from '@shared/maps'
import type { Point, ShapeForm } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'
import type { TriggerDef } from '@shared/game/triggers'
import { getFactionStance, type StoredFaction } from '@shared/game/factions'
import type { GameSave } from '@shared/game/save'
import type { MenuEvent } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { placeName } from '../maps/placeShapes'
import type { MapObjectHandlers } from '../maps/mapObjects'
import type { MapToken, TokenHandlers } from '../maps/TokenLayer'
import { GameCanvas } from '../../game/react/GameCanvas'
import { useLatest } from '../../game/react/useLatest'
import { ExploreScene, type ExploreData } from '../../game/explore/ExploreScene'
import type { ClockView } from '../../game/explore/WorldClock'
import type { View } from '../../game/engine/Camera'
import { passTime, restLong, restShort } from '../play/time'
import { useGameCatalog } from '../game/useGameCatalog'

import type { BattleState } from '@shared/game/state/BattleStateMachine'

export interface ClockControls {
  pass: (seconds: number, source: string) => void
  shortRest: (hitDice: Record<string, number>) => void
  longRest: () => void
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
  onWalked?: (sheet: string, feet: number) => void
  onBattleMove?: (at: Point) => void
  onNavigation?: (nav: StageNavigation | null) => void
  onTarget?: (target: { sheet: string | null; token?: string; at: Point; label: string }) => boolean
  onCamera?: (camera: View) => void
  aiming?: boolean
  aimRange?: number
  activeActorId?: string | null
  battle?: BattleState | null
  className?: string
}

export function PlayStage({ world, save, triggers, onTrigger, map, shapes, places, here, place, tokens, mine, selected, onPlace, onBlankMenu, tokenHandlers, objects, onTime, onClock, onWalked, onBattleMove, onNavigation, onTarget, onCamera, aiming = false, aimRange = 0, activeActorId = null, battle = null, className }: Props) {
  const catalog = useGameCatalog()
  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const names = useMemo(() => Object.fromEntries(Object.keys(shapes).map((k) => [k, placeName(places, k)])), [shapes, places])
  const timeDef = catalog ? (catalog.time(save?.clockId ?? '') ?? catalog.times()[0] ?? null) : null
  const hostileFactions = useMemo(() => {
    const playerFaction = tokens.find((t) => mine && t.visitor.sheet === mine)?.visitor.faction || ''
    if (!playerFaction) {
      return new Set(factions.filter((f) => f.defaultStance === 'hostile').map((f) => f.id))
    }
    return new Set(factions.filter((f) => getFactionStance(factions, f.id, playerFaction) === 'hostile').map((f) => f.id))
  }, [factions, tokens, mine])
  const data = useMemo<ExploreData>(
    () => ({
      map,
      shapes,
      names,
      tokens,
      markers: here,
      mine,
      selected,
      catalog,
      save: save ? { id: save.id, clockId: save.clockId, clock: save.clock, longRestAt: save.longRestAt ?? null } : null,
      triggers,
      used: save?.used ?? [],
      thingFlags: save?.thingFlags ?? {},
      tileFeet: timeDef?.tileFeet ?? 5,
      aiming,
      aimRange,
      activeActorId,
      battle,
      hostileFactions
    }),
    [map, shapes, names, tokens, here, mine, selected, catalog, save?.id, save?.clockId, save?.clock, save?.longRestAt, triggers, save?.used, save?.thingFlags, timeDef?.tileFeet, aiming, aimRange, activeActorId, battle, hostileFactions]
  )
  const latest = useLatest({ data, world, onTrigger, onPlace, onBlankMenu, tokenHandlers, objects, onTime, onClock, onWalked, onBattleMove, onNavigation, onTarget, onCamera })
  const scene = useRef<ExploreScene | null>(null)

  useEffect(() => {
    scene.current?.setData(data)
  }, [data])

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
        on.on('token', ({ token, hit }) => latest.current.onTarget?.({ sheet: token.visitor.sheet, token: token.visitor.token, at: token.at, label: token.visitor.name }) || latest.current.tokenHandlers.onPick?.(token, hit.native))
        on.on('tokenMenu', ({ token, hit }) => latest.current.tokenHandlers.onMenu?.(token, hit.native))
        on.on('tokenMove', ({ sheet, at }) => latest.current.tokenHandlers.onMove?.(sheet, at))
        on.on('battleMove', ({ at }) => latest.current.onBattleMove?.(at))
        on.on('arrive', ({ sheet, at, place, feet }) => {
          latest.current.tokenHandlers.onMove?.(sheet, at)
          latest.current.onWalked?.(sheet, feet)
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
        engine.scenes.replace(s)
        scene.current = s
        latest.current.onClock?.({
          pass: (seconds, source) => {
            const save = latest.current.data.save
            if (save) passTime(save.id, latest.current.data.tokens, seconds, source)
          },
          shortRest: (hitDice) => {
            const save = latest.current.data.save
            if (save) restShort(save.id, latest.current.data.tokens, hitDice)
          },
          longRest: () => {
            const save = latest.current.data.save
            if (save) restLong(save.id, latest.current.data.tokens)
          }
        })
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
