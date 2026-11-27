import { notFound } from '@shared/errors'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { CHANGES_KEY, PLACE_TYPE, PLACE_TYPE_KEY, REGION_TYPE, REGION_TYPE_KEY, STARTER_SCHEMA, cleanWorldLaunch, inspectSchema, normalEntity, worldId, type WorldChanges, type WorldEntity, type WorldLaunch, type WorldMeta, type WorldPost, type WorldSchema, type WorldType } from '@shared/world'
import { dataRoot } from '../util/paths'
import { readJson, removePath, writeJson } from '../util/fs'
import { shapeBounds } from '@shared/shapes'
import { cleanMap, cleanMapUses, cleanShapes, forgetMapThing, mapThingKey, PLACE_THING, REGION_THING, type JourneyEntry, type JourneyKind, type Standing, type WorldMapUse } from '@shared/maps'
import { STARTER_FACTIONS } from '@shared/game/factions'
import { maps } from '../maps/store'
import { currentActor } from '../timeline/actor'
import { timeline } from '../timeline/store'

export class WorldError extends Error {}

export type WorldLayer = 'template' | 'play'

export interface PlayLayer {
  records(world: string, type: string): Record<string, Record<string, unknown> | null>
  setRecord(world: string, type: string, key: string, value: Record<string, unknown> | null): void
  stand(world: string, map: string): Record<string, Standing>
  setStand(world: string, map: string, stand: Record<string, Standing>): void
  journeys(world: string): Record<string, JourneyEntry[]>
  addJourney(world: string, sheet: string, entry: JourneyEntry): void
  board(world: string): WorldPost[]
  setBoard(world: string, list: WorldPost[]): void
}

const ROOT = path.join(dataRoot, 'worlds')

function slug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 40) || 'world'
  )
}

export const nowStamp = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

class WorldStore extends EventEmitter {
  private dir(id: string): string {
    if (!/^[a-z0-9_-]+$/.test(id)) throw notFound(new WorldError(`There is no world "${id}"`))
    return path.join(ROOT, id)
  }

  private manifest(id: string): { name: string; updatedAt: number; player?: string | null; rules?: string; tags?: unknown; flags?: Record<string, string | number | boolean>; launch?: unknown; knowledgeCues?: unknown } {
    return readJson(path.join(this.dir(id), 'manifest.json'), { name: id, updatedAt: 0 })
  }

  flags(id: string): Record<string, string | number | boolean> {
    const m = this.manifest(id)
    return m.flags && typeof m.flags === 'object' ? m.flags : {}
  }

  setFlag(id: string, key: string, value: string | number | boolean | null): Record<string, string | number | boolean> {
    const m = this.manifest(id)
    const current: Record<string, string | number | boolean> = { ...(m.flags ?? {}) }
    if (value === null) {
      delete current[key]
    } else {
      current[key] = value
    }
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, flags: current, updatedAt: Date.now() })
    this.emit('changed', id)
    return current
  }

  setFlags(id: string, flags: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
    const m = this.manifest(id)
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, flags, updatedAt: Date.now() })
    this.emit('changed', id)
    return flags
  }

  setPlayer(id: string, sheet: string | null): WorldMeta {
    const m = this.manifest(id)
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, player: sheet, updatedAt: Date.now() })
    this.emit('changed', id)
    return this.meta(id)
  }

  setTags(id: string, tags: string[]): WorldMeta {
    const m = this.manifest(id)
    const clean = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, tags: clean, updatedAt: Date.now() })
    this.emit('changed', id)
    return this.meta(id)
  }

  setKnowledgeCues(id: string, on: boolean): WorldMeta {
    const m = this.manifest(id)
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, knowledgeCues: on, updatedAt: Date.now() })
    this.emit('changed', id)
    return this.meta(id)
  }

  setLaunch(id: string, launch: Partial<WorldLaunch>): WorldMeta {
    const m = this.manifest(id)
    const next = cleanWorldLaunch({ ...cleanWorldLaunch(m.launch), ...launch })
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, launch: next, updatedAt: Date.now() })
    this.emit('changed', id)
    return this.meta(id)
  }

  private touch(id: string): void {
    const m = this.manifest(id)
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, updatedAt: Date.now() })
    this.emit('changed', id)
  }

  folder(id: string): string {
    if (!this.exists(id)) throw notFound(new WorldError(`There is no world "${id}"`))
    return this.dir(id)
  }

  exists(id: string): boolean {
    try {
      return fs.existsSync(path.join(this.dir(id), 'schema.json'))
    } catch {
      return false
    }
  }

  list(): WorldMeta[] {
    if (!fs.existsSync(ROOT)) return []
    return fs
      .readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && this.exists(d.name))
      .map((d) => this.meta(d.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  allTypeKeys(): string[] {
    if (!fs.existsSync(ROOT)) return []
    const out = new Set<string>([REGION_TYPE_KEY, PLACE_TYPE_KEY])
    for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!d.isDirectory() || !this.exists(d.name)) continue
      for (const k of Object.keys(this.schema(d.name).types)) out.add(k)
    }
    return [...out]
  }

  meta(id: string): WorldMeta {
    const schema = this.schema(id)
    const m = this.manifest(id)
    return {
      id,
      name: m.name,
      types: Object.entries(schema.types).map(([key, t]) => ({ key, plural: t.plural, count: Object.keys(this.rawType(id, key)).length })),
      posts: this.board(id).length,
      player: m.player ?? null,
      rules: typeof m.rules === 'string' ? m.rules : '',
      tags: Array.isArray(m.tags) ? m.tags.filter((t): t is string => typeof t === 'string') : [],
      flags: m.flags && typeof m.flags === 'object' ? m.flags : {},
      launch: cleanWorldLaunch(m.launch),
      ...(m.knowledgeCues === true ? { knowledgeCues: true } : {}),
      updatedAt: m.updatedAt
    }
  }

  create(name: string, schema: WorldSchema = STARTER_SCHEMA): WorldMeta {
    const check = inspectSchema(schema)
    if (check.errors.length) throw new WorldError(`The schema has problems; fix these and save it again: ${check.errors.join('; ')}`)
    let id = slug(name)
    for (let n = 2; this.exists(id); n++) id = `${slug(name)}_${n}`
    const dir = this.dir(id)
    fs.mkdirSync(dir, { recursive: true })
    writeJson(path.join(dir, 'schema.json'), schema)
    writeJson(path.join(dir, 'manifest.json'), { name: name.trim() || id, updatedAt: Date.now() })
    writeJson(path.join(dir, 'board.json'), [])
    writeJson(path.join(dir, 'factions.json'), STARTER_FACTIONS)
    this.emit('changed', id)
    return this.meta(id)
  }

  rename(id: string, name: string): WorldMeta {
    const m = this.manifest(id)
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, name: name.trim() || m.name, updatedAt: Date.now() })
    this.emit('changed', id)
    return this.meta(id)
  }

  delete(id: string): boolean {
    if (!this.exists(id)) return false
    removePath(this.dir(id))
    this.emit('changed', id)
    return true
  }

  schema(id: string): WorldSchema {
    if (!this.exists(id)) throw notFound(new WorldError(`There is no world "${id}"`))
    const raw = readJson<WorldSchema>(path.join(this.dir(id), 'schema.json'), STARTER_SCHEMA)
    const place = raw.types?.[PLACE_TYPE_KEY]
    const migrated = place && !('Actions' in place.fields) ? this.splitPlaceActions(id, raw, place) : raw
    if (!(PLACE_TYPE_KEY in (migrated.types ?? {}))) return migrated
    const { [PLACE_TYPE_KEY]: _builtIn, ...customTypes } = migrated.types
    return { ...migrated, types: customTypes }
  }

  private splitPlaceActions(id: string, schema: WorldSchema, place: WorldType): WorldSchema {
    const places = this.templateType(id, PLACE_TYPE_KEY)
    let moved = false
    for (const v of Object.values(places)) {
      const p = v as Record<string, unknown>
      if (typeof p.Decisions !== 'string' || !p.Decisions.trim() || p.Actions) continue
      p.Actions = p.Decisions
      p.Decisions = ''
      moved = true
    }
    if (moved) writeJson(this.typeFile(id, PLACE_TYPE_KEY), places)
    const { Decisions: _old, ...fields } = place.fields
    const next = { ...schema, types: { ...schema.types, [PLACE_TYPE_KEY]: { ...place, fields: { ...fields, Actions: PLACE_TYPE.fields.Actions, Decisions: PLACE_TYPE.fields.Decisions } } } }
    writeJson(path.join(this.dir(id), 'schema.json'), next)
    return next
  }

  saveSchema(id: string, schema: WorldSchema): WorldMeta {
    const { [PLACE_TYPE_KEY]: _builtIn, ...customTypes } = schema.types ?? {}
    const clean = { ...schema, types: customTypes }
    const check = inspectSchema(clean)
    if (check.errors.length) throw new WorldError(`The schema has problems; fix these and save it again: ${check.errors.join('; ')}`)
    writeJson(path.join(this.dir(id), 'schema.json'), clean)
    this.touch(id)
    return this.meta(id)
  }

  type(id: string, typeKey: string): WorldType {
    if (typeKey === REGION_TYPE_KEY) return REGION_TYPE
    if (typeKey === PLACE_TYPE_KEY) return PLACE_TYPE
    const schema = this.schema(id)
    const t = schema.types[typeKey]
    if (!t) throw new WorldError(`There is no type "${typeKey}". Set type to one of: ${[REGION_TYPE_KEY, PLACE_TYPE_KEY, ...Object.keys(schema.types)].join(', ')}.`)
    return t
  }

  private typeFile(id: string, typeKey: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(typeKey)) throw new WorldError(`There is no type "${typeKey}". Set type to one of${this.exists(id) ? `: ${Object.keys(this.schema(id).types).join(', ')}` : ' its lower-case type names'}.`)
    return path.join(this.dir(id), `${typeKey}.json`)
  }

  private templateType(id: string, typeKey: string): Record<string, unknown> {
    return readJson<Record<string, unknown>>(this.typeFile(id, typeKey), {})
  }

  rawType(id: string, typeKey: string, layer: WorldLayer = 'play'): Record<string, unknown> {
    const raw = this.templateType(id, typeKey)
    if (layer === 'template' || !this.play) return raw
    for (const [key, v] of Object.entries(this.play.records(id, typeKey))) {
      if (v === null) delete raw[key]
      else raw[key] = v
    }
    return raw
  }

  entities(id: string, typeKey: string, includeHidden = true, layer: WorldLayer = 'play'): Record<string, WorldEntity> {
    const t = this.type(id, typeKey)
    const raw = this.rawType(id, typeKey, layer)
    return Object.fromEntries(Object.entries(raw).map(([key, v]) => [key, normalEntity(t, v, includeHidden)]))
  }

  get(id: string, typeKey: string, key: string, includeHidden = true, layer: WorldLayer = 'play'): WorldEntity | null {
    const t = this.type(id, typeKey)
    const raw = this.rawType(id, typeKey, layer)[worldId(key)]
    return raw === undefined ? null : normalEntity(t, raw, includeHidden)
  }

  put(id: string, typeKey: string, key: string, entity: WorldEntity, layer: WorldLayer = 'template'): void {
    const t = this.type(id, typeKey)
    const raw = this.rawType(id, typeKey, layer)
    const k = worldId(key)
    const made = !(k in raw)
    const previous = (raw[k] && typeof raw[k] === 'object' ? raw[k] : {}) as Record<string, unknown>
    const before = normalEntity(t, previous)
    const after = normalEntity(t, { ...previous, ...entity })
    const by = currentActor().agentId
    const at = nowStamp()
    const changes: WorldChanges = { ...((previous[CHANGES_KEY] ?? {}) as WorldChanges) }
    for (const name of Object.keys(entity)) if (name in t.fields && JSON.stringify(before[name]) !== JSON.stringify(after[name])) changes[name] = { by, at }
    const value = { ...previous, ...entity, [CHANGES_KEY]: changes }
    if (layer === 'play') this.playLayer().setRecord(id, typeKey, k, value)
    else {
      const template = this.templateType(id, typeKey)
      template[k] = value
      writeJson(this.typeFile(id, typeKey), template)
    }
    this.touch(id)
    timeline.record({ kind: 'world', entry: `${id}/${typeKey}/${k}`, action: made ? 'made' : 'changed', by })
  }

  changes(id: string, typeKey: string, layer: WorldLayer = 'play'): Record<string, WorldChanges> {
    return Object.fromEntries(Object.entries(this.rawType(id, typeKey, layer)).map(([key, v]) => [key, ((v as Record<string, unknown>)?.[CHANGES_KEY] ?? {}) as WorldChanges]))
  }

  private deleteRecordOnly(id: string, typeKey: string, k: string, layer: WorldLayer): boolean {
    if (!(k in this.rawType(id, typeKey, layer))) return false
    if (layer === 'play') this.playLayer().setRecord(id, typeKey, k, null)
    else {
      const template = this.templateType(id, typeKey)
      delete template[k]
      writeJson(this.typeFile(id, typeKey), template)
    }
    this.touch(id)
    return true
  }

  remove(id: string, typeKey: string, key: string, layer: WorldLayer = 'template'): boolean {
    if (layer === 'template' && typeKey === PLACE_TYPE_KEY) return this.removePlace(id, key)
    if (layer === 'template' && typeKey === REGION_TYPE_KEY) return this.removeRegion(id, key)
    return this.deleteRecordOnly(id, typeKey, worldId(key), layer)
  }

  removePlace(id: string, key: string): boolean {
    const places = this.rawType(id, PLACE_TYPE_KEY, 'template')
    const k = worldId(key)
    const place = places[k] as Record<string, unknown> | undefined
    if (!place) return false
    const parent = typeof place.Inside === 'string' && place.Inside !== k ? place.Inside : ''
    for (const [child, v] of Object.entries(places)) if (child !== k && (v as Record<string, unknown>)?.Inside === k) this.put(id, PLACE_TYPE_KEY, child, { Inside: parent })
    const uses = this.mapUses(id)
    const placeThing = mapThingKey(PLACE_THING, k)
    if (uses.some((u) => Boolean(u.shapes[k] || u.spawns?.[k] || u.layerOf?.[placeThing]))) {
      this.saveMapUses(
        id,
        uses.map((u) => ({
          ...forgetMapThing(u, placeThing),
          shapes: Object.fromEntries(Object.entries(u.shapes).filter(([sk]) => sk !== k)),
          spawns: Object.fromEntries(Object.entries(u.spawns ?? {}).filter(([sk]) => sk !== k))
        }))
      )
    }
    return this.deleteRecordOnly(id, PLACE_TYPE_KEY, k, 'template')
  }

  removeRegion(id: string, key: string): boolean {
    const regions = this.rawType(id, REGION_TYPE_KEY, 'template')
    const k = worldId(key)
    const region = regions[k] as Record<string, unknown> | undefined
    if (!region) return false
    const parent = typeof region.Parent === 'string' && region.Parent !== k ? region.Parent : ''
    for (const [child, v] of Object.entries(regions)) {
      if (child !== k && (v as Record<string, unknown>)?.Parent === k) {
        this.put(id, REGION_TYPE_KEY, child, { Parent: parent })
      }
    }
    const places = this.rawType(id, PLACE_TYPE_KEY, 'template')
    for (const [pKey, v] of Object.entries(places)) {
      if ((v as Record<string, unknown>)?.Region === k) {
        this.put(id, PLACE_TYPE_KEY, pKey, { Region: parent })
      }
    }
    const uses = this.mapUses(id)
    const regionThing = mapThingKey(REGION_THING, k)
    if (uses.some((u) => Boolean(u.regionShapes?.[k] || u.layerOf?.[regionThing]))) {
      this.saveMapUses(
        id,
        uses.map((u) => ({
          ...forgetMapThing(u, regionThing),
          regionShapes: Object.fromEntries(Object.entries(u.regionShapes ?? {}).filter(([rk]) => rk !== k))
        }))
      )
    }
    return this.deleteRecordOnly(id, REGION_TYPE_KEY, k, 'template')
  }

  private usesFile(id: string): string {
    return path.join(this.dir(id), 'maps.json')
  }

  private templateUses(id: string): WorldMapUse[] {
    this.moveOldMaps(id)
    return cleanMapUses(readJson(this.usesFile(id), {})).filter((u) => maps.get(u.map) !== null)
  }

  oldStand(id: string): Record<string, Record<string, Standing>> {
    return Object.fromEntries(this.templateUses(id).map((u) => [u.map, u.stand]))
  }

  mapUses(id: string): WorldMapUse[] {
    const play = this.play
    return this.templateUses(id).map((u) => ({ ...u, stand: play ? play.stand(id, u.map) : {} }))
  }

  saveMapUses(id: string, uses: WorldMapUse[]): WorldMapUse[] {
    const kept = new Map(cleanMapUses(readJson(this.usesFile(id), {})).map((u) => [u.map, u.stand]))
    writeJson(this.usesFile(id), { maps: uses.map((u) => ({ ...u, stand: kept.get(u.map) ?? {} })) })
    const play = this.play
    if (play) for (const u of uses) if (JSON.stringify(u.stand) !== JSON.stringify(play.stand(id, u.map))) play.setStand(id, u.map, u.stand)
    this.touch(id)
    return this.mapUses(id)
  }

  saveMapUse(id: string, use: WorldMapUse): WorldMapUse {
    this.saveMapUses(id, this.mapUses(id).map((u) => (u.map === use.map ? use : u)))
    return use
  }

  useMap(id: string, mapId: string): WorldMapUse[] {
    const targetMap = maps.get(mapId)
    if (!targetMap) throw notFound(new WorldError(`There is no map "${mapId}". find with kind map lists them.`))
    const uses = this.mapUses(id)
    if (uses.some((u) => u.map === mapId)) return uses

    const existingPlaces = this.entities(id, PLACE_TYPE_KEY, true, 'template')
    const spawns: Record<string, { x: number; y: number }> = {}
    for (const [key, form] of Object.entries(targetMap.shapes ?? {})) {
      if (!existingPlaces[key]) {
        this.put(id, PLACE_TYPE_KEY, key, { Name: key })
      }
      const b = shapeBounds(form)
      spawns[key] = { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) }
    }

    return this.saveMapUses(id, [
      ...uses,
      {
        map: mapId,
        shapes: { ...(targetMap.shapes ?? {}) },
        regionShapes: {},
        spawns,
        stand: {},
        triggers: [...(targetMap.triggers ?? [])]
      }
    ])
  }

  dropMap(id: string, mapId: string): WorldMapUse[] {
    return this.saveMapUses(id, this.mapUses(id).filter((u) => u.map !== mapId))
  }

  oldJourneys(id: string): Record<string, JourneyEntry[]> {
    const raw = readJson<Record<string, JourneyEntry[]>>(path.join(this.dir(id), 'journeys.json'), {})
    return raw && typeof raw === 'object' ? raw : {}
  }

  journeys(id: string): Record<string, JourneyEntry[]> {
    return this.play ? this.play.journeys(id) : {}
  }

  addJourney(id: string, sheet: string, kind: JourneyKind, text: string): JourneyEntry {
    const entry: JourneyEntry = { at: nowStamp(), kind, text }
    this.playLayer().addJourney(id, sheet, entry)
    this.touch(id)
    return entry
  }

  usingMap(mapId: string): WorldMeta[] {
    return this.list().filter((w) => this.templateUses(w.id).some((u) => u.map === mapId))
  }

  private moveOldMaps(id: string): void {
    const dir = path.join(this.dir(id), 'maps')
    if (!fs.existsSync(dir)) return
    const moved = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const raw = readJson<Record<string, unknown>>(path.join(dir, f), {})
        const made = maps.create(typeof raw.name === 'string' ? raw.name : f.slice(0, -5), cleanMap(raw, f.slice(0, -5)))
        return { map: made.id, shapes: cleanShapes(raw.shapes), stand: {} }
      })
    writeJson(this.usesFile(id), { maps: [...cleanMapUses(readJson(this.usesFile(id), {})), ...moved] })
    removePath(dir)
  }

  oldBoard(id: string): WorldPost[] {
    const list = readJson<WorldPost[]>(path.join(this.dir(id), 'board.json'), [])
    return Array.isArray(list) ? list : []
  }

  board(id: string): WorldPost[] {
    return this.play ? this.play.board(id) : []
  }

  post(id: string, author: string, to: string, message: string): WorldPost {
    const entry: WorldPost = { at: nowStamp(), author, to: to || 'ALL', message }
    this.playLayer().setBoard(id, [...this.board(id), entry])
    this.touch(id)
    return entry
  }

  editPost(id: string, index: number, message: string | null): WorldPost[] {
    const list = [...this.board(id)]
    if (index < 0 || index >= list.length) throw new WorldError('There is no such post')
    if (message === null) list.splice(index, 1)
    else list[index] = { ...list[index], message, edited: true }
    this.playLayer().setBoard(id, list)
    this.touch(id)
    return list
  }

  private play: PlayLayer | null = null

  setPlayLayer(layer: PlayLayer): void {
    this.play = layer
  }

  private playLayer(): PlayLayer {
    if (!this.play) throw new WorldError('Saves are not ready yet.')
    return this.play
  }
}

export const worlds = new WorldStore()
