import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { CHANGES_KEY, PLACE_TYPE, PLACE_TYPE_KEY, STARTER_SCHEMA, inspectSchema, normalEntity, withPlaces, worldId, type WorldChanges, type WorldEntity, type WorldMeta, type WorldPost, type WorldSchema, type WorldType } from '@shared/world'
import { dataRoot } from '../util/paths'
import { readJson, removePath, writeJson } from '../util/fs'
import { cleanMap, cleanMapUses, cleanShapes, type JourneyEntry, type JourneyKind, type WorldMapUse } from '@shared/maps'
import { maps } from '../maps/store'
import { currentActor } from '../timeline/actor'
import { timeline } from '../timeline/store'

export class WorldError extends Error {}

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
    if (!/^[a-z0-9_-]+$/.test(id)) throw new WorldError(`There is no world "${id}"`)
    return path.join(ROOT, id)
  }

  private manifest(id: string): { name: string; updatedAt: number; player?: string | null } {
    return readJson(path.join(this.dir(id), 'manifest.json'), { name: id, updatedAt: 0 })
  }

  setPlayer(id: string, sheet: string | null): WorldMeta {
    const m = this.manifest(id)
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, player: sheet, updatedAt: Date.now() })
    this.emit('changed', id)
    return this.meta(id)
  }

  private touch(id: string): void {
    const m = this.manifest(id)
    writeJson(path.join(this.dir(id), 'manifest.json'), { ...m, updatedAt: Date.now() })
    this.emit('changed', id)
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

  meta(id: string): WorldMeta {
    const schema = this.schema(id)
    const m = this.manifest(id)
    return {
      id,
      name: m.name,
      types: Object.entries(schema.types).map(([key, t]) => ({ key, plural: t.plural, count: Object.keys(this.rawType(id, key)).length })),
      posts: this.board(id).length,
      player: m.player ?? null,
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
    if (!this.exists(id)) throw new WorldError(`There is no world "${id}"`)
    const schema = readJson<WorldSchema>(path.join(this.dir(id), 'schema.json'), STARTER_SCHEMA)
    const place = schema.types[PLACE_TYPE_KEY]
    return place && !('Actions' in place.fields) ? this.splitPlaceActions(id, schema, place) : schema
  }

  private splitPlaceActions(id: string, schema: WorldSchema, place: WorldType): WorldSchema {
    const places = this.rawType(id, PLACE_TYPE_KEY)
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
    const check = inspectSchema(schema)
    if (check.errors.length) throw new WorldError(`The schema has problems; fix these and save it again: ${check.errors.join('; ')}`)
    writeJson(path.join(this.dir(id), 'schema.json'), schema)
    this.touch(id)
    return this.meta(id)
  }

  type(id: string, typeKey: string): WorldType {
    const schema = this.schema(id)
    const t = schema.types[typeKey]
    if (!t) throw new WorldError(`There is no type "${typeKey}". Set type to one of: ${Object.keys(schema.types).join(', ')}.`)
    return t
  }

  private typeFile(id: string, typeKey: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(typeKey)) throw new WorldError(`There is no type "${typeKey}". Set type to one of${this.exists(id) ? `: ${Object.keys(this.schema(id).types).join(', ')}` : ' its lower-case type names'}.`)
    return path.join(this.dir(id), `${typeKey}.json`)
  }

  rawType(id: string, typeKey: string): Record<string, unknown> {
    return readJson<Record<string, unknown>>(this.typeFile(id, typeKey), {})
  }

  entities(id: string, typeKey: string, includeHidden = true): Record<string, WorldEntity> {
    const t = this.type(id, typeKey)
    const raw = this.rawType(id, typeKey)
    return Object.fromEntries(Object.entries(raw).map(([key, v]) => [key, normalEntity(t, v, includeHidden)]))
  }

  get(id: string, typeKey: string, key: string, includeHidden = true): WorldEntity | null {
    const t = this.type(id, typeKey)
    const raw = this.rawType(id, typeKey)[worldId(key)]
    return raw === undefined ? null : normalEntity(t, raw, includeHidden)
  }

  put(id: string, typeKey: string, key: string, entity: WorldEntity): void {
    const t = this.type(id, typeKey)
    const raw = this.rawType(id, typeKey)
    const k = worldId(key)
    const made = !(k in raw)
    const previous = (raw[k] && typeof raw[k] === 'object' ? raw[k] : {}) as Record<string, unknown>
    const before = normalEntity(t, previous)
    const after = normalEntity(t, { ...previous, ...entity })
    const by = currentActor().agentId
    const at = nowStamp()
    const changes: WorldChanges = { ...((previous[CHANGES_KEY] ?? {}) as WorldChanges) }
    for (const name of Object.keys(entity)) if (name in t.fields && JSON.stringify(before[name]) !== JSON.stringify(after[name])) changes[name] = { by, at }
    raw[k] = { ...previous, ...entity, [CHANGES_KEY]: changes }
    writeJson(this.typeFile(id, typeKey), raw)
    this.touch(id)
    timeline.record({ kind: 'world', entry: `${id}/${typeKey}/${k}`, action: made ? 'made' : 'changed', by })
  }

  changes(id: string, typeKey: string): Record<string, WorldChanges> {
    return Object.fromEntries(Object.entries(this.rawType(id, typeKey)).map(([key, v]) => [key, ((v as Record<string, unknown>)?.[CHANGES_KEY] ?? {}) as WorldChanges]))
  }

  remove(id: string, typeKey: string, key: string): boolean {
    const raw = this.rawType(id, typeKey)
    const k = worldId(key)
    if (!(k in raw)) return false
    delete raw[k]
    writeJson(this.typeFile(id, typeKey), raw)
    this.touch(id)
    return true
  }

  removePlace(id: string, key: string): boolean {
    const places = this.rawType(id, PLACE_TYPE_KEY)
    const k = worldId(key)
    const place = places[k] as Record<string, unknown> | undefined
    if (!place) return false
    const parent = typeof place.Inside === 'string' && place.Inside !== k ? place.Inside : ''
    for (const [child, v] of Object.entries(places)) if (child !== k && (v as Record<string, unknown>)?.Inside === k) this.put(id, PLACE_TYPE_KEY, child, { Inside: parent })
    const uses = this.mapUses(id)
    if (uses.some((u) => u.shapes[k])) this.saveMapUses(id, uses.map((u) => ({ ...u, shapes: Object.fromEntries(Object.entries(u.shapes).filter(([key]) => key !== k)) })))
    return this.remove(id, PLACE_TYPE_KEY, k)
  }

  private usesFile(id: string): string {
    return path.join(this.dir(id), 'maps.json')
  }

  mapUses(id: string): WorldMapUse[] {
    this.moveOldMaps(id)
    return cleanMapUses(readJson(this.usesFile(id), {})).filter((u) => maps.get(u.map) !== null)
  }

  saveMapUses(id: string, uses: WorldMapUse[]): WorldMapUse[] {
    writeJson(this.usesFile(id), { maps: uses })
    this.touch(id)
    return uses
  }

  saveMapUse(id: string, use: WorldMapUse): WorldMapUse {
    this.saveMapUses(id, this.mapUses(id).map((u) => (u.map === use.map ? use : u)))
    return use
  }

  useMap(id: string, mapId: string): WorldMapUse[] {
    if (!maps.get(mapId)) throw new WorldError(`There is no map "${mapId}". find with kind map lists them.`)
    const schema = this.schema(id)
    const placed = withPlaces(schema)
    if (placed !== schema) this.saveSchema(id, placed)
    const uses = this.mapUses(id)
    return uses.some((u) => u.map === mapId) ? uses : this.saveMapUses(id, [...uses, { map: mapId, shapes: {}, stand: {} }])
  }

  dropMap(id: string, mapId: string): WorldMapUse[] {
    return this.saveMapUses(id, this.mapUses(id).filter((u) => u.map !== mapId))
  }

  journeys(id: string): Record<string, JourneyEntry[]> {
    const raw = readJson<Record<string, JourneyEntry[]>>(path.join(this.dir(id), 'journeys.json'), {})
    return raw && typeof raw === 'object' ? raw : {}
  }

  addJourney(id: string, sheet: string, kind: JourneyKind, text: string): JourneyEntry {
    const entry: JourneyEntry = { at: nowStamp(), kind, text }
    const all = this.journeys(id)
    writeJson(path.join(this.dir(id), 'journeys.json'), { ...all, [sheet]: [...(all[sheet] ?? []), entry] })
    this.touch(id)
    return entry
  }

  usingMap(mapId: string): WorldMeta[] {
    return this.list().filter((w) => this.mapUses(w.id).some((u) => u.map === mapId))
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

  board(id: string): WorldPost[] {
    const list = readJson<WorldPost[]>(path.join(this.dir(id), 'board.json'), [])
    return Array.isArray(list) ? list : []
  }

  post(id: string, author: string, to: string, message: string): WorldPost {
    const list = this.board(id)
    const entry: WorldPost = { at: nowStamp(), author, to: to || 'ALL', message }
    list.push(entry)
    writeJson(path.join(this.dir(id), 'board.json'), list)
    this.touch(id)
    return entry
  }

  editPost(id: string, index: number, message: string | null): WorldPost[] {
    const list = this.board(id)
    if (index < 0 || index >= list.length) throw new WorldError('There is no such post')
    if (message === null) list.splice(index, 1)
    else list[index] = { ...list[index], message, edited: true }
    writeJson(path.join(this.dir(id), 'board.json'), list)
    this.touch(id)
    return list
  }
}

export const worlds = new WorldStore()
