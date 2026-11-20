import path from 'node:path'
import { EventEmitter } from 'node:events'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'kind-folders.json')

function cleanFolderPath(raw: string): string {
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

class KindFolderStore extends EventEmitter {
  private map: Record<string, string> | null = null

  private load(): Record<string, string> {
    if (this.map) return this.map
    const raw = readJson<unknown>(FILE, {})
    const out: Record<string, string> = {}
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof v === 'string') {
          const cleaned = cleanFolderPath(v)
          if (cleaned) out[k] = cleaned
        }
      }
    }
    this.map = out
    return out
  }

  getAll(): Record<string, string> {
    return { ...this.load() }
  }

  forKind(kind: string): string | null {
    const val = this.load()[kind]
    return val || null
  }

  set(kind: string, folder: string): Record<string, string> {
    const next = { ...this.load() }
    const cleaned = cleanFolderPath(folder)
    if (cleaned) next[kind] = cleaned
    else delete next[kind]
    this.map = next
    writeJson(FILE, next)
    this.emit('changed', next)
    return this.getAll()
  }
}

export const kindFolders = new KindFolderStore()
