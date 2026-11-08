import { Container, Graphics } from 'pixi.js'
import { mapArea, type MapData, type ObjectLayerData, type PlaceVisitor } from '@shared/maps'
import { formHas, shapeBounds, smallestAt, type Point, type ShapeForm } from '@shared/shapes'
import type { TriggerDef } from '@shared/game/triggers'
import { NavGrid, findPath } from '@shared/game/nav'
import { GameEntity, type Catalog, type ClockState } from '@shared/game/core'
import { resourcesOf } from '@shared/game/components'
import type { MapToken } from '../../components/maps/TokenLayer'
import type { GameEngine } from '../engine/GameEngine'
import type { PointerHit } from '../engine/Input'
import type { Scene } from '../engine/Scene'
import type { View } from '../engine/Camera'
import { themeColour } from '../engine/theme'
import { EventBus } from '../engine/EventBus'
import { MapView } from '../map/MapView'
import { PlaceLabel } from './PlaceLabel'
import { PlaceAreas } from './PlaceAreas'
import { TokenView, type TokenBar } from './TokenView'
import { MoveMarker } from './MoveMarker'
import { Walk } from './Walk'
import { WorldClock, type ClockView } from './WorldClock'

export interface ExploreData {
  map: MapData
  shapes: Record<string, ShapeForm>
  names: Record<string, string>
  tokens: MapToken[]
  markers: Record<string, PlaceVisitor[]>
  mine: string | null
  selected: string | null
  catalog: Catalog | null
  save: { id: string; clockId: string; clock: ClockState } | null
  triggers: TriggerDef[]
  used: string[]
}

export interface ExploreEvents {
  place: { key: string | null; hit: PointerHit }
  token: { token: MapToken; hit: PointerHit }
  tokenMenu: { token: MapToken; hit: PointerHit }
  tokenMove: { sheet: string; at: Point }
  arrive: { sheet: string; at: Point; place: string | null }
  tick: { seconds: number }
  time: ClockView | null
  clockSave: { save: string; clockId: string; clock: ClockState }
  trigger: { id: string; sheet: string }
  object: { object: ObjectLayerData; hit: PointerHit }
  objectMenu: { object: ObjectLayerData; hit: PointerHit }
  blankMenu: { hit: PointerHit }
}

const TOKEN_SMALLEST = 40
const MARKER_SIDE = 20
const MARKER_GAP = 4
const WALK_TILES_PER_SECOND = 4
const FOLLOW_EDGE = 0.25
const NIGHT_DARKNESS = 0.55
const NIGHT_COLOUR = '#05070f'

export class ExploreScene implements Scene {
  readonly root = new Container()
  readonly events = new EventBus<ExploreEvents>()
  private engine!: GameEngine
  private mapView: MapView | null = null
  private tokenLayer = new Container()
  private tokens = new Map<string, TokenView>()
  private markers = new Map<string, TokenView>()
  private label: PlaceLabel | null = null
  private areas: PlaceAreas | null = null
  private zoom = 0
  private gone = false
  private nav: NavGrid | null = null
  private navFor = ''
  private walk: { view: TokenView; walk: Walk } | null = null
  private marker: MoveMarker | null = null
  private clock: WorldClock | null = null
  private clockFor = ''
  private night = new Graphics()
  private triggerAreas: PlaceAreas | null = null
  private inside = new Set<string>()
  private aim: string | null = null

  constructor(
    private data: ExploreData,
    private start: View | null
  ) {}

  enter(engine: GameEngine): void {
    this.engine = engine
    engine.camera.setArea(mapArea(this.data.map))
    if (this.start) engine.camera.set(this.start)
    else engine.camera.fit(false)
    this.areas = new PlaceAreas(engine)
    this.marker = new MoveMarker(engine)
    this.triggerAreas = new PlaceAreas(engine, 'purple')
    this.night.eventMode = 'none'
    this.root.addChild(this.areas.root, this.triggerAreas.root, this.marker.root, this.tokenLayer, this.night)
    this.label = new PlaceLabel(engine)
    engine.input.blank = {
      tap: (hit) => {
        if (!this.walkTo(hit.world)) this.events.emit('place', { key: smallestAt(this.data.shapes, hit.world), hit })
      },
      menu: (hit) => this.events.emit('blankMenu', { hit }),
      hover: (world) => {
        const trigger = world ? this.triggerAt(world) : null
        const key = world && !trigger ? smallestAt(this.data.shapes, world) : null
        this.areas?.hover(key)
        this.triggerAreas?.hover(trigger?.id ?? null)
        this.label?.show(trigger ? trigger.name : key ? (this.data.names[key] ?? key) : null, world)
      }
    }
    void MapView.load(this.data.map, engine.assets, (target, object) =>
      engine.input.bind(target, {
        tap: (hit) => this.events.emit('object', { object, hit }),
        menu: (hit) => this.events.emit('objectMenu', { object, hit })
      })
    ).then((view) => {
      if (this.gone) return view.destroy()
      this.mapView = view
      view.root.alpha = 0
      this.root.addChildAt(view.root, 0)
      engine.tweens.to(view.root, { alpha: 1 }, 0.4)
      this.zoom = 0
    })
    this.sync()
  }

  setData(data: ExploreData): void {
    this.data = data
    if (this.engine) this.sync()
  }

  private syncClock(): void {
    const save = this.data.save
    const catalog = this.data.catalog
    const def = save && catalog ? (catalog.time(save.clockId) ?? catalog.times()[0] ?? null) : null
    const key = save && def ? `${save.id}:${def.id}:${JSON.stringify(def.clock)}` : ''
    if (key === this.clockFor) return
    this.clock?.save()
    this.clockFor = key
    const id = save?.id ?? ''
    this.clock =
      save && def
        ? new WorldClock(def, save.clock, {
            tick: (seconds) => this.events.emit('tick', { seconds }),
            show: (view) => {
              this.events.emit('time', view)
              this.shade()
            },
            save: (clockId, clock) => this.events.emit('clockSave', { save: id, clockId, clock })
          })
        : null
    if (!this.clock) this.events.emit('time', null)
    this.shade()
  }

  private shade(): void {
    const area = mapArea(this.data.map)
    const dark = this.clock ? (1 - this.clock.daylight) * NIGHT_DARKNESS : 0
    this.night.clear()
    if (dark > 0.01) this.night.rect(0, 0, area.w, area.h).fill({ color: NIGHT_COLOUR, alpha: dark })
  }

  setSpeed(speed: number): void {
    this.clock?.setSpeed(speed)
  }

  setPaused(paused: boolean): void {
    this.clock?.setPaused(paused)
  }

  private grid(): NavGrid {
    const map = this.data.map
    const key = `${map.id}:${map.updatedAt}`
    if (!this.nav || this.navFor !== key) {
      this.nav = NavGrid.covering(mapArea(map), map.tile)
      this.navFor = key
    }
    return this.nav
  }

  private live(): TriggerDef[] {
    const used = new Set(this.data.used)
    return this.data.triggers.filter((t) => !(t.once && used.has(t.id)))
  }

  private triggerAt(point: Point): TriggerDef | null {
    const live = this.live()
    const id = smallestAt(Object.fromEntries(live.map((t) => [t.id, t.shape])), point)
    return live.find((t) => t.id === id) ?? null
  }

  private zonesAt(point: Point): Set<string> {
    return new Set(this.live().filter((t) => formHas(t.shape, point)).map((t) => t.id))
  }

  private walkTo(target: Point): boolean {
    const view = this.data.mine ? this.tokens.get(this.data.mine) : undefined
    if (!view) return false
    const aimed = this.triggerAt(target)
    this.aim = aimed && aimed.fires === 'interact' ? aimed.id : null
    this.inside = this.zonesAt(view.at)
    if (this.aim && this.inside.has(this.aim)) {
      this.events.emit('trigger', { id: this.aim, sheet: view.sheet })
      this.aim = null
      return true
    }
    const path = findPath(this.grid(), view.at, target)
    if (!path) {
      this.marker?.show(target, false)
      return true
    }
    this.walk = { view, walk: new Walk(view.at, path, WALK_TILES_PER_SECOND * this.data.map.tile.w) }
    this.marker?.show(this.walk.walk.end, true)
    return true
  }

  private stopWalk(): void {
    if (!this.walk) return
    this.walk.view.stopWalking()
    this.marker?.hide()
    this.walk = null
  }

  private follow(at: Point): void {
    const view = this.engine.camera.current
    const screen = this.engine.app.screen
    const x = at.x * view.zoom + view.x
    const y = at.y * view.zoom + view.y
    const inside = x > screen.width * FOLLOW_EDGE && x < screen.width * (1 - FOLLOW_EDGE) && y > screen.height * FOLLOW_EDGE && y < screen.height * (1 - FOLLOW_EDGE)
    if (!inside) this.engine.camera.centerOn(at)
  }

  private barsOf(token: MapToken): TokenBar[] | null {
    const record = token.visitor.game
    const catalog = this.data.catalog
    if (!record || !catalog) return null
    const theme = this.engine.theme
    return resourcesOf(GameEntity.fromRecord(record, catalog)).map((r) => ({ value: r.max > 0 ? r.current / r.max : 0, colour: themeColour(theme, r.colour, theme.accent) }))
  }

  private tokenLook(visitor: PlaceVisitor) {
    const theme = this.engine.theme
    return visitor.sheet === this.data.mine ? theme.accent : visitor.agent ? theme.purple : theme.cyan
  }

  private sync(): void {
    this.syncClock()
    this.triggerAreas?.set(Object.fromEntries(this.live().map((t) => [t.id, t.shape])), null)
    this.areas?.set(this.data.shapes, this.data.selected)
    const base = this.data.map.tile.w * 2
    const seen = new Set<string>()
    for (const token of this.data.tokens) {
      const sheet = token.visitor.sheet
      seen.add(sheet)
      const border = this.tokenLook(token.visitor)
      const known = this.tokens.get(sheet)
      if (known) {
        known.setBorder(border)
        known.setBars(this.barsOf(token))
        known.update(token)
        continue
      }
      const view = new TokenView(this.engine, token, { base, smallest: TOKEN_SMALLEST, label: true, border })
      view.setBars(this.barsOf(token))
      this.engine.input.bind(view.root, {
        tap: (hit) => this.events.emit('token', { token: view.token, hit }),
        menu: (hit) => this.events.emit('tokenMenu', { token: view.token, hit }),
        drag: {
          move: (at) => {
            if (this.walk?.view === view) this.stopWalk()
            view.drag(at)
          },
          drop: (at) => {
            view.drop()
            this.events.emit('tokenMove', { sheet, at: { x: Math.round(at.x), y: Math.round(at.y) } })
          },
          cancel: () => view.snapBack()
        }
      })
      this.tokens.set(sheet, view)
      this.tokenLayer.addChild(view.root)
    }
    for (const [sheet, view] of this.tokens) {
      if (seen.has(sheet)) continue
      if (this.walk?.view === view) this.stopWalk()
      view.destroy()
      this.tokens.delete(sheet)
    }
    this.syncMarkers()
    this.zoom = 0
  }

  private syncMarkers(): void {
    const standing = new Set(this.data.tokens.map((t) => t.visitor.sheet))
    const wanted = new Map<string, MapToken>()
    for (const [place, visitors] of Object.entries(this.data.markers)) {
      const form = this.data.shapes[place]
      if (!form) continue
      const b = shapeBounds(form)
      const list = visitors.filter((v) => !standing.has(v.sheet))
      list.forEach((visitor, i) => wanted.set(`${place}/${visitor.sheet}`, { visitor, at: { x: b.x + b.w / 2 + (i - (list.length - 1) / 2) * (MARKER_SIDE + MARKER_GAP), y: b.y + b.h / 2 } }))
    }
    for (const [key, token] of wanted) {
      const known = this.markers.get(key)
      if (known) {
        known.update(token)
        continue
      }
      const view = new TokenView(this.engine, token, { base: 0, smallest: MARKER_SIDE, label: false, border: this.engine.theme.cyan })
      this.markers.set(key, view)
      this.tokenLayer.addChild(view.root)
    }
    for (const [key, view] of this.markers) {
      if (wanted.has(key)) continue
      view.destroy()
      this.markers.delete(key)
    }
  }

  update(dt: number): void {
    this.clock?.update(dt)
    const going = this.walk
    if (!going) return
    const at = going.walk.step(dt)
    going.view.walkTo(at, going.walk.distance / this.data.map.tile.w)
    this.follow(at)
    const now = this.zonesAt(at)
    for (const t of this.live()) if (t.fires === 'enter' && now.has(t.id) && !this.inside.has(t.id)) this.events.emit('trigger', { id: t.id, sheet: going.view.sheet })
    this.inside = now
    if (!going.walk.done) return
    this.stopWalk()
    const end = { x: Math.round(at.x), y: Math.round(at.y) }
    this.events.emit('arrive', { sheet: going.view.sheet, at: end, place: smallestAt(this.data.shapes, end) })
    if (this.aim && now.has(this.aim)) this.events.emit('trigger', { id: this.aim, sheet: going.view.sheet })
    this.aim = null
  }

  render(): void {
    const zoom = this.engine.camera.zoom
    if (zoom !== this.zoom) {
      this.zoom = zoom
      this.mapView?.zoomed(zoom)
      this.marker?.layout(zoom)
    }
    for (const t of this.tokens.values()) t.layout(zoom)
    for (const m of this.markers.values()) m.layout(zoom)
  }

  exit(): void {
    this.gone = true
    this.clock?.save()
    this.clock = null
    this.walk = null
    this.engine.input.blank = {}
    this.marker?.destroy()
    for (const t of this.tokens.values()) t.destroy()
    for (const m of this.markers.values()) m.destroy()
    this.tokens.clear()
    this.markers.clear()
    this.label?.destroy()
    this.areas?.destroy()
    this.triggerAreas?.destroy()
    this.mapView?.destroy()
    this.mapView = null
    this.events.clear()
  }
}
