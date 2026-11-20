import fs from 'node:fs'
import path from 'node:path'
import type { AssetMeta } from '@shared/types'
import { data } from '../data/hub'
import { appFolder } from '../install/paths'

const DEFAULT_TILESET_FILE = 'terrain-map-v7.png'

function findBundledTileset(): string | null {
  const candidates = [
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'maps', DEFAULT_TILESET_FILE) : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'resources', 'maps', DEFAULT_TILESET_FILE) : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'maps', DEFAULT_TILESET_FILE) : '',
    path.join(appFolder(), 'resources', 'maps', DEFAULT_TILESET_FILE),
    path.join(process.cwd(), 'resources', 'maps', DEFAULT_TILESET_FILE)
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p)) ?? null
}

export function ensureDefaultMapTileset(): AssetMeta | null {
  const existing = data.assets.list().find((a) => a.name.includes('terrain-map-v7'))
  if (existing) return existing
  const file = findBundledTileset()
  if (!file) throw new Error(`Bundled map tileset "${DEFAULT_TILESET_FILE}" could not be found.`)
  return data.assets.register(file, { tool: null, sessionId: null, original: file })
}
