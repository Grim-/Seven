import fs from 'node:fs'
import path from 'node:path'
import type { BundledTileset } from '@shared/types'
import { data } from '../data/hub'
import { appFolder } from '../install/paths'
import { registerAttribution } from '../credits'

const DEFAULT_TILESET_META = 'terrain-map-v7.tileset.json'

interface TilesetMetaFile {
  name: string
  image: string
  tileWidth: number
  tileHeight: number
  columns?: number
  tileCount?: number
  margin?: number
  spacing?: number
}

registerAttribution({
  id: 'lpc-terrains',
  name: '[LPC] Terrains',
  category: 'Map Art',
  license: 'CC-BY-SA 4.0 / 3.0',
  url: 'https://opengameart.org/content/lpc-terrains',
  usedFor: 'Default terrain tileset (terrain-map-v7.png) used by the map generator in Seven.',
  attribution:
    '"[LPC] Terrains" by bluecarrot16, Lanea Zimmerman (Sharm), Daniel Eddeland (Daneeklu), Richard Kettering (Jetrel), Zachariah Husiar (Zabin), Hyptosis, Casper Nilsson, Buko Studios, Nushio, ZaPaper, billknye, William Thompson, caeles, Redshrike, Bertram, and Rayane Félix (RayaneFLX).\n\nSource: https://opengameart.org/content/lpc-terrains\nLicensed under CC-BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/) and CC-BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/).',
  source: 'maps:default-tileset'
})

function mapsResourceDirs(): string[] {
  return [
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'maps') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'resources', 'maps') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'maps') : '',
    path.join(appFolder(), 'resources', 'maps'),
    path.join(process.cwd(), 'resources', 'maps')
  ].filter(Boolean)
}

function pngDimensions(filePath: string): { w: number; h: number } | null {
  try {
    const fd = fs.openSync(filePath, 'r')
    try {
      const buf = Buffer.alloc(24)
      const read = fs.readSync(fd, buf, 0, 24, 0)
      if (read < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

function findBundledTileset(): { dir: string; meta: TilesetMetaFile; imagePath: string } | null {
  for (const dir of mapsResourceDirs()) {
    const metaPath = path.join(dir, DEFAULT_TILESET_META)
    if (!fs.existsSync(metaPath)) continue
    const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Partial<TilesetMetaFile>
    if (!raw.name || !raw.image || !raw.tileWidth || !raw.tileHeight) continue
    const imagePath = path.join(dir, raw.image)
    if (!fs.existsSync(imagePath)) continue
    return { dir, meta: raw as TilesetMetaFile, imagePath }
  }
  return null
}

export function ensureDefaultMapTileset(): BundledTileset | null {
  const found = findBundledTileset()
  if (!found) throw new Error(`Bundled map tileset "${DEFAULT_TILESET_META}" could not be found.`)
  const { meta, imagePath } = found
  const margin = meta.margin ?? 0
  const spacing = meta.spacing ?? 0
  let columns = meta.columns ?? 0
  let count = meta.tileCount ?? 0
  if (!columns || !count) {
    const dims = pngDimensions(imagePath)
    if (dims) {
      if (!columns) columns = Math.floor((dims.w - margin * 2 + spacing) / (meta.tileWidth + spacing))
      if (!count) {
        const rows = Math.floor((dims.h - margin * 2 + spacing) / (meta.tileHeight + spacing))
        count = columns * rows
      }
    }
  }
  const stem = path.parse(meta.image).name
  const existing = data.assets.list().find((a) => a.name.includes(stem))
  const asset = existing ?? data.assets.register(imagePath, { tool: null, sessionId: null, original: imagePath })
  return {
    asset,
    name: meta.name,
    tile: { w: meta.tileWidth, h: meta.tileHeight },
    columns,
    count,
    margin,
    spacing
  }
}
