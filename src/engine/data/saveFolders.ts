import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { cleanSaveFolder, type SaveFolder } from '@shared/saveFolders'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'save-folders.json')
const EARLIER = path.join(dataRoot, 'kind-folders.json')

function read(file: string): Record<string, SaveFolder> {
  const raw = readJson<unknown>(file, {})
  const out: Record<string, SaveFolder> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [target, value] of Object.entries(raw as Record<string, unknown>)) {
    const place = cleanSaveFolder(value)
    if (place) out[target] = place
  }
  return out
}

class SaveFolderStore extends EventEmitter {
  private map: Record<string, SaveFolder> | null = null

  private load(): Record<string, SaveFolder> {
    this.map ??= read(fs.existsSync(FILE) ? FILE : EARLIER)
    return this.map
  }

  get(target: string): SaveFolder | null {
    return this.load()[target] ?? null
  }

  all(): Record<string, SaveFolder> {
    return { ...this.load() }
  }

  set(target: string, place: SaveFolder | null): SaveFolder | null {
    const next = { ...this.load() }
    if (place) next[target] = cleanSaveFolder(place) ?? place
    else delete next[target]
    this.map = next
    writeJson(FILE, next)
    this.emit('changed', next)
    return next[target] ?? null
  }
}

export const saveFolders = new SaveFolderStore()
