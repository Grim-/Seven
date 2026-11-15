import { notFound } from '@shared/errors'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { cleanMap, type MapData, type MapMeta } from '@shared/maps'
import { dataRoot } from '../util/paths'
import { readJson, removePath, writeJson } from '../util/fs'

export class MapError extends Error {}

const ROOT = path.join(dataRoot, 'maps')

function slug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 40) || 'map'
  )
}

class MapStore extends EventEmitter {
  private file(id: string): string {
    if (!/^[a-z0-9_-]+$/.test(id)) throw notFound(new MapError(`There is no map "${id}"`))
    return path.join(ROOT, `${id}.json`)
  }

  list(): MapMeta[] {
    if (!fs.existsSync(ROOT)) return []
    return fs
      .readdirSync(ROOT)
      .filter((f) => f.endsWith('.json'))
      .map((f) => this.get(f.slice(0, -5)))
      .filter((m): m is MapData => m !== null)
      .map((m) => ({ id: m.id, name: m.name, size: m.size, updatedAt: m.updatedAt }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): MapData | null {
    const file = this.file(id)
    return fs.existsSync(file) ? cleanMap(readJson(file, {}), id) : null
  }

  create(name: string, init: Partial<Omit<MapData, 'id' | 'name' | 'updatedAt'>> = {}): MapData {
    let id = slug(name)
    for (let n = 2; this.get(id); n++) id = `${slug(name)}_${n}`
    return this.save(cleanMap({ ...init, name: name.trim() || id }, id))
  }

  save(map: MapData): MapData {
    const clean = cleanMap({ ...map, updatedAt: Date.now() }, map.id)
    fs.mkdirSync(ROOT, { recursive: true })
    writeJson(this.file(map.id), clean)
    this.emit('changed', map.id)
    return clean
  }

  remove(id: string): boolean {
    const file = this.file(id)
    if (!fs.existsSync(file)) return false
    removePath(file)
    this.emit('changed', id)
    return true
  }
}

export const maps = new MapStore()
