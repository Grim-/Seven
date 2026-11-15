import { notFound } from '@shared/errors'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { toId } from '@shared/ids'
import { cleanStoredMapObject, type StoredMapObject } from '@shared/game/mapObjects'
import { readJson, writeJson } from '../util/fs'
import { dataRoot } from '../util/paths'
import { ToolError } from '../tools/types'

const FILE = path.join(dataRoot, 'mapObjects.json')

export class MapObjectStore extends EventEmitter {
  constructor(private readonly file: string = FILE) {
    super()
  }

  list(): StoredMapObject[] {
    return readJson<unknown[]>(this.file, [])
      .map(cleanStoredMapObject)
      .filter((o): o is StoredMapObject => o !== null)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): StoredMapObject {
    const hit = this.list().find((o) => o.id === id)
    if (!hit) throw notFound(new ToolError(`No map object "${id}".`))
    return hit
  }

  find(ref: string): StoredMapObject | null {
    const id = toId(ref.trim().replace(/^@?map_object:/i, '').replace(/^"|"$/g, ''))
    const all = this.list()
    return all.find((o) => o.id === id) ?? all.find((o) => toId(o.name) === id) ?? null
  }

  save(raw: unknown, previousId: string | null = null): StoredMapObject {
    const o = cleanStoredMapObject(raw)
    if (!o) throw new ToolError('Give the map object a name.')
    this.write([...this.list().filter((x) => x.id !== o.id && x.id !== previousId), o])
    return o
  }

  remove(id: string): void {
    const all = this.list()
    if (!all.some((o) => o.id === id)) throw notFound(new ToolError(`No map object "${id}".`))
    this.write(all.filter((o) => o.id !== id))
  }

  private write(list: StoredMapObject[]): void {
    writeJson(this.file, list)
    this.emit('changed')
  }
}

export const mapObjectsStore = new MapObjectStore()
