import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { DOMParser } from 'linkedom'
import { ANY_ZOOM, type MapLayer, type Tileset } from '@shared/maps'
import type { Size } from '@shared/shapes'
import { MapError } from './store'
import { registerMapReader } from './mapReaders'

type Json = Record<string, unknown>

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function readText(file: string): string {
  if (!fs.existsSync(file)) throw new MapError(`${file} is missing. Keep the map's tilesets and pictures where the map file expects them, then import again.`)
  return fs.readFileSync(file, 'utf8')
}

function readJsonFile(file: string): Json {
  const text = readText(file)
  try {
    return JSON.parse(text) as Json
  } catch {
    throw new MapError(`${path.basename(file)} isn't a JSON map. Export it from Tiled as JSON (.tmj).`)
  }
}

function xmlTileset(text: string): Json | null {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  const t = doc.querySelector('tileset')
  if (!t) return null
  const n = (el: Element | null, name: string) => (el?.hasAttribute(name) ? Number(el.getAttribute(name)) : undefined)
  const image = doc.querySelector('tileset > image')
  return { name: t.getAttribute('name') ?? '', tilewidth: n(t, 'tilewidth'), tileheight: n(t, 'tileheight'), tilecount: n(t, 'tilecount'), columns: n(t, 'columns'), margin: n(t, 'margin'), spacing: n(t, 'spacing'), image: image?.getAttribute('source') ?? '', imagewidth: n(image, 'width'), imageheight: n(image, 'height') }
}

function jsonTileset(text: string): Json | null {
  try {
    return JSON.parse(text) as Json
  } catch {
    return null
  }
}

function readTilesetFile(file: string): Json {
  const text = readText(file)
  const found = text.trimStart().startsWith('<') ? xmlTileset(text) : jsonTileset(text)
  if (!found) throw new MapError(`${path.basename(file)} isn't a Tiled tileset Seven can read. Save it from Tiled as a .tsx or .tsj tileset.`)
  return found
}

function pngSize(file: string): Size {
  const head = Buffer.alloc(24)
  const fd = fs.openSync(file, 'r')
  try {
    fs.readSync(fd, head, 0, 24, 0)
  } finally {
    fs.closeSync(fd)
  }
  return head.toString('ascii', 1, 4) === 'PNG' ? { w: head.readUInt32BE(16), h: head.readUInt32BE(20) } : { w: 0, h: 0 }
}

function tileData(raw: Json, count: number): number[] {
  const data = raw.data
  if (Array.isArray(data)) return data.map((n) => num(n))
  if (typeof data !== 'string') return new Array<number>(count).fill(0)
  let bytes = Buffer.from(data.trim(), 'base64')
  const compression = str(raw.compression)
  if (compression === 'zlib') bytes = zlib.inflateSync(bytes)
  else if (compression === 'gzip') bytes = zlib.gunzipSync(bytes)
  else if (compression) throw new MapError(`This map's tile layers are compressed with ${compression}, which Seven can't read. In Tiled, set the layer format to CSV or Base64 (zlib) and export again.`)
  return Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readUInt32LE(i * 4))
}

function readTileset(raw: Json, base: string, store: (file: string) => string): Tileset {
  const first = num(raw.firstgid, 1)
  const source = str(raw.source)
  const file = source ? path.resolve(base, source) : null
  const t = file ? readTilesetFile(file) : raw
  const dir = file ? path.dirname(file) : base
  const image = str(t.image)
  if (!image) throw new MapError(`The tileset ${str(t.name) || source} is a collection of separate pictures, which Seven can't read yet. Use a tileset made from one picture.`)
  const tile = { w: num(t.tilewidth, 1), h: num(t.tileheight, 1) }
  return { id: crypto.randomUUID(), name: str(t.name) || path.basename(image), image: store(path.resolve(dir, image)), first, tile, columns: Math.max(1, num(t.columns, 1)), count: num(t.tilecount), margin: num(t.margin), spacing: num(t.spacing) }
}

function base(raw: Json): Omit<MapLayer, 'kind'> {
  return { id: crypto.randomUUID(), name: str(raw.name) || 'Layer', visible: raw.visible !== false, opacity: num(raw.opacity, 1), offset: { x: num(raw.offsetx), y: num(raw.offsety) }, zoom: ANY_ZOOM }
}

function readLayer(raw: Json, map: { columns: number; rows: number }, dir: string, store: (file: string) => string): MapLayer | null {
  if (raw.type === 'tilelayer') {
    if (Array.isArray(raw.chunks)) {
      const tiles = new Array<number>(map.columns * map.rows).fill(0)
      for (const c of raw.chunks as Json[]) {
        const w = num(c.width)
        tileData(c, w * num(c.height)).forEach((gid, i) => {
          const x = num(c.x) + (i % w)
          const y = num(c.y) + Math.floor(i / w)
          if (x >= 0 && y >= 0 && x < map.columns && y < map.rows) tiles[y * map.columns + x] = gid
        })
      }
      return { ...base(raw), kind: 'tiles', columns: map.columns, rows: map.rows, tiles }
    }
    const columns = num(raw.width, map.columns)
    const rows = num(raw.height, map.rows)
    return { ...base(raw), kind: 'tiles', columns, rows, tiles: tileData(raw, columns * rows) }
  }
  if (raw.type === 'imagelayer') {
    const image = str(raw.image)
    if (!image) return null
    const file = path.resolve(dir, image)
    const size = raw.imagewidth && raw.imageheight ? { w: num(raw.imagewidth), h: num(raw.imageheight) } : pngSize(file)
    return { ...base(raw), kind: 'image', image: store(file), size, scale: 1, rotation: 0 }
  }
  if (raw.type === 'group') return { ...base(raw), kind: 'group', layers: readLayers(raw.layers, map, dir, store) }
  return null
}

function readLayers(raw: unknown, map: { columns: number; rows: number }, dir: string, store: (file: string) => string): MapLayer[] {
  return Array.isArray(raw) ? (raw as Json[]).map((l) => readLayer(l, map, dir, store)).filter((l): l is MapLayer => l !== null) : []
}

registerMapReader({
  label: 'Tiled maps',
  extensions: ['tmj', 'json'],
  read(file, store) {
    const raw = readJsonFile(file)
    if (raw.type !== 'map') throw new MapError(`${path.basename(file)} isn't a Tiled map. Export the map from Tiled as JSON (.tmj).`)
    if (str(raw.orientation) !== 'orthogonal') throw new MapError(`This map is ${str(raw.orientation)}; Seven can only show orthogonal (square grid) maps so far.`)
    const dir = path.dirname(file)
    const tile = { w: num(raw.tilewidth, 1), h: num(raw.tileheight, 1) }
    const grid = { columns: num(raw.width, 1), rows: num(raw.height, 1) }
    return {
      size: { w: grid.columns * tile.w, h: grid.rows * tile.h },
      tile,
      tilesets: Array.isArray(raw.tilesets) ? (raw.tilesets as Json[]).map((t) => readTileset(t, dir, store)) : [],
      layers: readLayers(raw.layers, grid, dir, store)
    }
  }
})
