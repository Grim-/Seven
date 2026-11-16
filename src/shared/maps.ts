import type { Point, ShapeForm, Size } from './shapes'
import { PLACE_TYPE_KEY, recordKey } from './world'
import type { DndStats } from './dnd'
import type { EntityRecord } from './game/core/GameEntity'
import { cleanTrigger, type TriggerDef } from './game/triggers'
import { cleanComponents } from './game/core/params'
import type { ComponentDef } from './game/core/registry'
import { refsIn } from './story'

export interface LayerBase {
  id: string
  name: string
  visible: boolean
  opacity: number
  offset: Point
  zoom: ZoomRange
}

export interface ZoomRange {
  min: number | null
  max: number | null
}

export const ANY_ZOOM: ZoomRange = { min: null, max: null }

export function showsAt(layer: LayerBase, scale: number): boolean {
  return (layer.zoom.min === null || scale >= layer.zoom.min) && (layer.zoom.max === null || scale <= layer.zoom.max)
}

export function zoomLabel(z: ZoomRange): string | null {
  const x = (n: number) => `${Math.round(n * 100) / 100}×`
  if (z.min !== null && z.max !== null) return `${x(z.min)}–${x(z.max)}`
  if (z.min !== null) return `≥ ${x(z.min)}`
  if (z.max !== null) return `≤ ${x(z.max)}`
  return null
}

export type PropCollision = 'solid' | 'passable' | 'water'

export type ObjectStateMatch = 'is_set' | 'is_not_set' | 'equals'

export interface ObjectStateRule {
  id: string
  name?: string
  priority?: number
  flag: string
  match?: ObjectStateMatch
  value?: string | number | boolean
  image?: string
  collision?: PropCollision
  opacity?: number
  visible?: boolean
}

export interface ResolvedObjectState {
  image: string
  collision: PropCollision
  opacity: number
  visible: boolean
  activeRuleId: string | null
}

export function resolveObjectState(
  object: ObjectLayerData,
  flags: Record<string, string | number | boolean> = {}
): ResolvedObjectState {
  const rules = object.states ?? []
  const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  for (const rule of sorted) {
    const val = flags[rule.flag]
    let matches = false
    if (rule.match === 'is_not_set') {
      matches = val === undefined || val === false || val === '' || val === 0
    } else if (rule.match === 'equals') {
      matches = String(val) === String(rule.value)
    } else {
      matches = Boolean(val)
    }

    if (matches) {
      return {
        image: rule.image || object.image,
        collision: rule.collision ?? object.collision ?? 'solid',
        opacity: typeof rule.opacity === 'number' ? rule.opacity : (typeof object.opacity === 'number' && object.opacity > 0 ? object.opacity : 1),
        visible: rule.visible !== undefined ? rule.visible : (object.visible !== false),
        activeRuleId: rule.id
      }
    }
  }

  return {
    image: object.image,
    collision: object.collision ?? 'solid',
    opacity: typeof object.opacity === 'number' && object.opacity > 0 ? object.opacity : 1,
    visible: object.visible !== false,
    activeRuleId: null
  }
}

export function newObject(name: string, image: string, imageSize: Size, at: Point): ObjectLayerData {
  return { id: crypto.randomUUID(), kind: 'object', name, visible: true, opacity: 1, offset: at, zoom: ANY_ZOOM, image, size: imageSize, scale: 1, rotation: 0, collision: 'solid', entry: null, actions: '', decisions: '', states: [] }
}

export function mapObjects(layers: MapLayer[]): ObjectLayerData[] {
  return layers.flatMap((l) => (l.kind === 'object' ? [l] : mapObjects(childLayers(l) ?? [])))
}

function layerExtent(layer: MapLayer, map: MapData): Size {
  if (layer.kind === 'tiles') return { w: layer.columns * map.tile.w, h: layer.rows * map.tile.h }
  if (layer.kind === 'image' || layer.kind === 'object') {
    const w = layer.size.w * layer.scale
    const h = layer.size.h * layer.scale
    const turn = (layer.rotation * Math.PI) / 180
    const rw = Math.abs(w * Math.cos(turn)) + Math.abs(h * Math.sin(turn))
    const rh = Math.abs(w * Math.sin(turn)) + Math.abs(h * Math.cos(turn))
    return { w: w / 2 + rw / 2, h: h / 2 + rh / 2 }
  }
  return { w: 0, h: 0 }
}

export function mapArea(map: MapData): Size {
  let w = map.size.w
  let h = map.size.h
  const walk = (layers: MapLayer[], ox: number, oy: number) => {
    for (const l of layers) {
      const x = ox + l.offset.x
      const y = oy + l.offset.y
      const kids = childLayers(l)
      if (kids) walk(kids, x, y)
      else {
        const e = layerExtent(l, map)
        w = Math.max(w, Math.ceil(x + e.w))
        h = Math.max(h, Math.ceil(y + e.h))
      }
    }
  }
  walk(map.layers, 0, 0)
  return { w, h }
}

export function newGroup(name: string, layers: MapLayer[] = []): GroupLayerData {
  return { id: crypto.randomUUID(), kind: 'group', name, visible: true, opacity: 1, offset: { x: 0, y: 0 }, zoom: ANY_ZOOM, layers }
}

export interface TileLayerData extends LayerBase {
  kind: 'tiles'
  columns: number
  rows: number
  tiles: number[]
}

export interface PictureLayer {
  image: string
  size: Size
  scale: number
  rotation: number
}

export interface ImageLayerData extends LayerBase, PictureLayer {
  kind: 'image'
}

export interface GroupLayerData extends LayerBase {
  kind: 'group'
  layers: MapLayer[]
}

export interface ObjectLayerData extends LayerBase, PictureLayer {
  kind: 'object'
  collision?: PropCollision
  entry?: string | null
  actions?: string
  decisions?: string
  states?: ObjectStateRule[]
  comps?: ComponentDef[]
}

export type MapLayer = TileLayerData | ImageLayerData | GroupLayerData | ObjectLayerData

export interface Tileset {
  id: string
  name: string
  image: string
  first: number
  tile: Size
  columns: number
  count: number
  margin: number
  spacing: number
}

export type CreatureDisposition = 'hostile' | 'neutral' | 'friendly'
export type SpawnerTriggerMode = 'map_load' | 'proximity' | 'on_flag' | 'action_only'
export type SpawnerResetMode = 'never' | 'on_rest' | 'on_flag' | 'action_only' | 'on_map_enter'

export interface CreatureSpawner {
  id: string
  name: string
  monsterId: string
  at: Point
  scale?: number
  facing?: number
  faction?: string
  disposition: CreatureDisposition
  spawnWhen: SpawnerTriggerMode
  triggerRadius?: number
  spawnFlag?: string
  resetWhen: SpawnerResetMode
  resetFlag?: string
  lootTableId?: string
  actions?: string
  decisions?: string
}

export interface MapData {
  id: string
  name: string
  size: Size
  tile: Size
  tilesets: Tileset[]
  layers: MapLayer[]
  shapes?: Record<string, ShapeForm>
  triggers?: TriggerDef[]
  spawners?: CreatureSpawner[]
  updatedAt: number
}

export interface Standing {
  at: Point
  actions: string
  decisions: string
}

export interface ConditionGating {
  needsFlag?: string
  hiddenIfFlag?: string
}

export function checkConditionGating(
  gating: ConditionGating | undefined,
  flags: Record<string, string | number | boolean> = {}
): boolean {
  if (!gating) return true
  if (gating.needsFlag && !flags[gating.needsFlag]) return false
  if (gating.hiddenIfFlag && Boolean(flags[gating.hiddenIfFlag])) return false
  return true
}

export interface WorldMapUse {
  map: string
  shapes: Record<string, ShapeForm>
  stand: Record<string, Standing>
  triggers?: TriggerDef[]
  layerGating?: Record<string, ConditionGating>
  propGating?: Record<string, ConditionGating>
}

export type JourneyKind = 'moved' | 'action' | 'decision'

export interface JourneyEntry {
  at: string
  kind: JourneyKind
  text: string
}

export interface PlaceVisitor {
  sheet: string
  name: string
  image: string | null
  line: string
  dnd: Pick<DndStats, 'hp' | 'ac' | 'stats' | 'conditions'> | null
  game?: EntityRecord | null
  gameRules?: string
  faction?: string | null
  hidden?: boolean
  agent: string | null
}

export interface TokenVisitor extends PlaceVisitor {
  token: string
  source: string
  hp: { cur: number; max: number } | null
}

export function asToken(visitor: PlaceVisitor, token: string, source: string): TokenVisitor {
  return { ...visitor, token, source, hp: visitor.dnd ? { cur: visitor.dnd.hp.cur, max: visitor.dnd.hp.max } : null }
}

export interface MapMeta {
  id: string
  name: string
  size: Size
  updatedAt: number
}

export interface MapListing extends MapMeta {
  usedBy: string[]
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const size = (v: unknown): Size => ({ w: Math.max(1, num(obj(v).w, 1)), h: Math.max(1, num(obj(v).h, 1)) })
const point = (v: unknown): Point => ({ x: num(obj(v).x, 0), y: num(obj(v).y, 0) })

function cleanZoom(raw: unknown): ZoomRange {
  const v = obj(raw)
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null)
  return { min: n(v.min), max: n(v.max) }
}

function cleanCollision(raw: unknown): PropCollision {
  const s = String(raw).trim().toLowerCase()
  return s === 'passable' || s === 'water' ? s : 'solid'
}

function cleanStateRule(raw: unknown): ObjectStateRule | null {
  const v = obj(raw)
  const flag = str(v.flag).trim()
  if (!flag) return null
  const matchRaw = str(v.match)
  const match: ObjectStateMatch = matchRaw === 'is_not_set' || matchRaw === 'equals' ? matchRaw : 'is_set'
  return {
    id: str(v.id) || crypto.randomUUID(),
    name: str(v.name),
    priority: typeof v.priority === 'number' ? v.priority : 0,
    flag,
    match,
    value: v.value !== undefined ? (typeof v.value === 'boolean' || typeof v.value === 'number' ? v.value : String(v.value)) : undefined,
    image: str(v.image) || undefined,
    collision: v.collision ? cleanCollision(v.collision) : undefined,
    opacity: typeof v.opacity === 'number' ? Math.min(1, Math.max(0, v.opacity)) : undefined,
    visible: v.visible !== undefined ? Boolean(v.visible) : undefined
  }
}

function cleanStateRules(raw: unknown): ObjectStateRule[] {
  return Array.isArray(raw) ? raw.map(cleanStateRule).filter((r): r is ObjectStateRule => r !== null) : []
}

function cleanLayer(raw: unknown): MapLayer | null {
  const v = obj(raw)
  const rawOpacity = typeof v.opacity === 'number' && Number.isFinite(v.opacity) && v.opacity > 0 ? v.opacity : 1
  const opacity = Math.min(1, Math.max(0.05, rawOpacity))
  const base: LayerBase = { id: str(v.id) || crypto.randomUUID(), name: str(v.name, 'Layer'), visible: v.visible !== false, opacity, offset: point(v.offset), zoom: cleanZoom(v.zoom) }
  if (v.kind === 'tiles') {
    const columns = Math.max(1, Math.round(num(v.columns, 1)))
    const rows = Math.max(1, Math.round(num(v.rows, 1)))
    const tiles = Array.isArray(v.tiles) ? v.tiles.map((t) => (typeof t === 'number' && t > 0 ? Math.floor(t) : 0)) : []
    return { ...base, kind: 'tiles', columns, rows, tiles }
  }
  const picture = (): PictureLayer => ({ image: str(v.image), size: size(v.size), scale: Math.max(0.01, num(v.scale, 1)), rotation: num(v.rotation, 0) % 360 })
  if (v.kind === 'image') return str(v.image) ? { ...base, kind: 'image', ...picture() } : null
  if (v.kind === 'group') return { ...base, kind: 'group', layers: cleanLayers(v.layers) }
  if (v.kind === 'object') {
    if (!str(v.image)) return null
    return {
      ...base,
      kind: 'object',
      ...picture(),
      collision: cleanCollision(v.collision),
      entry: str(v.entry) || null,
      actions: str(v.actions),
      decisions: str(v.decisions),
      states: cleanStateRules(v.states),
      comps: cleanComponents(v.comps)
    }
  }
  return null
}

function cleanLayers(raw: unknown): MapLayer[] {
  return Array.isArray(raw) ? raw.map(cleanLayer).filter((l): l is MapLayer => l !== null) : []
}

function cleanTileset(raw: unknown): Tileset | null {
  const v = obj(raw)
  if (!str(v.image)) return null
  return { id: str(v.id) || crypto.randomUUID(), name: str(v.name, 'Tileset'), image: str(v.image), first: Math.max(1, Math.round(num(v.first, 1))), tile: size(v.tile), columns: Math.max(1, Math.round(num(v.columns, 1))), count: Math.max(0, Math.round(num(v.count, 0))), margin: num(v.margin, 0), spacing: num(v.spacing, 0) }
}

export function cleanForm(raw: unknown): ShapeForm | null {
  const v = obj(raw)
  if (v.kind === 'box') return { kind: 'box', ...point(v), w: Math.max(0, num(v.w, 0)), h: Math.max(0, num(v.h, 0)) }
  if (v.kind === 'outline' && Array.isArray(v.points) && v.points.length >= 3) return { kind: 'outline', points: v.points.map(point) }
  return null
}

export function cleanShapes(raw: unknown): Record<string, ShapeForm> {
  const shapes: Record<string, ShapeForm> = {}
  for (const [key, form] of Object.entries(obj(raw))) {
    const f = cleanForm(form)
    if (f) shapes[key] = f
  }
  return shapes
}

export function cleanStand(raw: unknown): Record<string, Standing> {
  return Object.fromEntries(Object.entries(obj(raw)).map(([sheet, v]) => [sheet, { at: point(obj(v).at), actions: str(obj(v).actions), decisions: str(obj(v).decisions) }]))
}

function cleanTriggers(raw: unknown): TriggerDef[] {
  return Array.isArray(raw) ? raw.map((t) => cleanTrigger(t, cleanForm(obj(t).shape))).filter((t): t is TriggerDef => t !== null) : []
}

function cleanGating(raw: unknown): Record<string, ConditionGating> {
  const out: Record<string, ConditionGating> = {}
  for (const [k, v] of Object.entries(obj(raw))) {
    const o = obj(v)
    const needsFlag = str(o.needsFlag).trim()
    const hiddenIfFlag = str(o.hiddenIfFlag).trim()
    if (needsFlag || hiddenIfFlag) {
      out[k] = {
        ...(needsFlag ? { needsFlag } : {}),
        ...(hiddenIfFlag ? { hiddenIfFlag } : {})
      }
    }
  }
  return out
}

export function cleanMapUses(raw: unknown): WorldMapUse[] {
  const list = Array.isArray(obj(raw).maps) ? (obj(raw).maps as unknown[]) : []
  return list.map(obj).filter((u) => typeof u.map === 'string' && u.map).map((u) => ({
    map: String(u.map),
    shapes: cleanShapes(u.shapes),
    stand: cleanStand(u.stand),
    triggers: cleanTriggers(u.triggers),
    layerGating: cleanGating(u.layerGating),
    propGating: cleanGating(u.propGating)
  }))
}

function cleanSpawner(raw: unknown): CreatureSpawner | null {
  const v = obj(raw)
  const monsterId = str(v.monsterId).trim()
  if (!monsterId) return null
  const id = str(v.id) || crypto.randomUUID()
  const name = str(v.name, monsterId)
  const at = point(v.at)
  const scale = typeof v.scale === 'number' && v.scale > 0 ? v.scale : 1
  const facing = typeof v.facing === 'number' ? (v.facing % 360) : 0
  const faction = str(v.faction) || undefined
  const disp = str(v.disposition).toLowerCase()
  const disposition: CreatureDisposition = disp === 'friendly' || disp === 'neutral' ? disp : 'hostile'

  const sw = str(v.spawnWhen).toLowerCase()
  const spawnWhen: SpawnerTriggerMode =
    sw === 'proximity' || sw === 'on_flag' || sw === 'action_only' ? sw : 'map_load'
  const triggerRadius = typeof v.triggerRadius === 'number' && v.triggerRadius > 0 ? v.triggerRadius : 128
  const spawnFlag = str(v.spawnFlag) || undefined

  const rw = str(v.resetWhen).toLowerCase()
  const resetWhen: SpawnerResetMode =
    rw === 'never' || rw === 'on_rest' || rw === 'on_flag' || rw === 'action_only' || rw === 'on_map_enter' ? rw : 'never'
  const resetFlag = str(v.resetFlag) || undefined

  const lootTableId = str(v.lootTableId) || undefined
  const actions = str(v.actions)
  const decisions = str(v.decisions)

  return {
    id,
    name,
    monsterId,
    at,
    scale,
    facing,
    faction,
    disposition,
    spawnWhen,
    triggerRadius: spawnWhen === 'proximity' ? triggerRadius : undefined,
    spawnFlag: spawnWhen === 'on_flag' ? spawnFlag : undefined,
    resetWhen,
    resetFlag: resetWhen === 'on_flag' ? resetFlag : undefined,
    lootTableId,
    actions,
    decisions
  }
}

export function cleanSpawners(raw: unknown): CreatureSpawner[] {
  return Array.isArray(raw) ? raw.map(cleanSpawner).filter((s): s is CreatureSpawner => s !== null) : []
}

export function cleanMap(raw: unknown, id: string): MapData {
  const v = obj(raw)
  return {
    id,
    name: str(v.name, id),
    size: size(v.size),
    tile: size(v.tile),
    tilesets: Array.isArray(v.tilesets) ? v.tilesets.map(cleanTileset).filter((t): t is Tileset => t !== null) : [],
    layers: cleanLayers(v.layers),
    shapes: cleanShapes(v.shapes),
    triggers: cleanTriggers(v.triggers),
    spawners: cleanSpawners(v.spawners),
    updatedAt: num(v.updatedAt, 0)
  }
}

export function placeRef(id: string): { world: string; key: string } {
  const [world = '', , key = ''] = id.split('/')
  return { world, key }
}

export const placeId = (world: string, key: string) => `${world}/${PLACE_TYPE_KEY}/${key}`

export function childLayers(layer: MapLayer): MapLayer[] | null {
  return 'layers' in layer ? layer.layers : null
}

const withChildren = (layer: MapLayer, layers: MapLayer[]): MapLayer => ({ ...layer, layers }) as MapLayer

export type Flags = Record<string, string | number | boolean>

export function mapInPlay(map: MapData, use: WorldMapUse, flags: Flags, own: (object: string) => Flags): MapData {
  const states = new Map(mapObjects(map.layers).map((o) => [o.id, resolveObjectState(o, { ...flags, ...own(o.id) })]))
  const shown = (layer: MapLayer): MapLayer => {
    const gated = checkConditionGating(use.layerGating?.[layer.id], flags) && checkConditionGating(use.propGating?.[layer.id], flags)
    const state = states.get(layer.id)
    const children = childLayers(layer)
    const next = children ? withChildren(layer, children.map(shown)) : layer
    const changed = state ? ({ ...next, image: state.image, collision: state.collision, opacity: state.opacity } as MapLayer) : next
    return { ...changed, visible: layer.visible && gated && (state?.visible ?? true) }
  }
  return { ...map, layers: map.layers.map(shown) }
}

export function changeLayer(layers: MapLayer[], id: string, fn: (layer: MapLayer) => MapLayer | null): MapLayer[] {
  return layers.flatMap((l) => {
    if (l.id === id) {
      const next = fn(l)
      return next ? [next] : []
    }
    const children = childLayers(l)
    return children ? [withChildren(l, changeLayer(children, id, fn))] : [l]
  })
}

export function moveLayer(layers: MapLayer[], id: string, to: number): MapLayer[] {
  const at = layers.findIndex((l) => l.id === id)
  if (at >= 0) {
    const next = [...layers]
    const [item] = next.splice(at, 1)
    next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
    return next
  }
  return layers.map((l) => {
    const children = childLayers(l)
    return children ? withChildren(l, moveLayer(children, id, to)) : l
  })
}

export function findLayer(layers: MapLayer[], id: string): MapLayer | null {
  for (const l of layers) {
    if (l.id === id) return l
    const inside = findLayer(childLayers(l) ?? [], id)
    if (inside) return inside
  }
  return null
}

export function moveInto(layers: MapLayer[], id: string, group: string | null): MapLayer[] {
  const layer = findLayer(layers, id)
  if (!layer || layer.id === group || (group && findLayer(childLayers(layer) ?? [], group))) return layers
  const without = changeLayer(layers, id, () => null)
  return group ? changeLayer(without, group, (g) => withChildren(g, [...(childLayers(g) ?? []), layer])) : [...without, layer]
}

export function groupsIn(layers: MapLayer[]): GroupLayerData[] {
  return layers.flatMap((l) => {
    const inside = childLayers(l)
    return inside ? [l as GroupLayerData, ...groupsIn(inside)] : []
  })
}

export interface PlaceNode {
  key: string
  name: string
  shaped: boolean
  children: PlaceNode[]
}

export function placeTree(places: Record<string, Record<string, unknown>>, shapes: Record<string, ShapeForm>): PlaceNode[] {
  const parentOf = (key: string): string | null => {
    const inside = places[key]?.Inside
    return typeof inside === 'string' && inside && inside !== key && inside in places ? inside : null
  }
  const rooted = (key: string): boolean => {
    const seen = new Set<string>()
    for (let at: string | null = key; at; at = parentOf(at)) {
      if (seen.has(at)) return false
      seen.add(at)
    }
    return true
  }
  const leaf = (key: string): PlaceNode => ({ key, name: typeof places[key]?.Name === 'string' && places[key].Name ? String(places[key].Name) : key, shaped: key in shapes, children: [] })
  const node = (key: string): PlaceNode => ({
    ...leaf(key),
    children: Object.keys(places)
      .filter((k) => parentOf(k) === key)
      .map(node)
      .sort((a, b) => a.name.localeCompare(b.name))
  })
  return Object.keys(places)
    .filter((k) => !parentOf(k) || !rooted(k))
    .map((k) => (rooted(k) ? node(k) : leaf(k)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function layerNames(layers: MapLayer[]): string[] {
  return layers.flatMap((l) => [l.name, ...layerNames(childLayers(l) ?? []).map((n) => `${l.name} › ${n}`)])
}

export function placePath(places: Record<string, Record<string, unknown>>, key: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (let at: unknown = key; typeof at === 'string' && at in places && !seen.has(at); at = places[at]?.Inside) {
    seen.add(at)
    out.unshift(at)
  }
  return out
}

export function placesIn(where: string, world: string, places: Record<string, unknown>): string[] {
  return refsIn(where)
    .filter((r) => r.kind === 'place')
    .map((r) => {
      const ref = r.ref.replace(/^"|"$/g, '')
      const full = placeRef(ref)
      return full.key && full.world === world ? full.key : recordKey(ref)
    })
    .filter((key) => key in places)
}

export function mapPictureIds(map: MapData): string[] {
  const inLayers = (layers: MapLayer[]): string[] =>
    layers.flatMap((l) =>
      l.kind === 'image' || l.kind === 'object'
        ? [l.image]
        : l.kind === 'group'
        ? inLayers(l.layers)
        : []
    )
  return [...new Set([...map.tilesets.map((t) => t.image), ...inLayers(map.layers)])].filter(Boolean)
}
