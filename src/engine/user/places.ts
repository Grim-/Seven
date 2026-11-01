import path from 'node:path'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'places.json')

class Places {
  get(): Record<string, unknown> {
    const raw = readJson<unknown>(FILE, {})
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  }

  set(key: string, value: unknown): void {
    writeJson(FILE, { ...this.get(), [key]: value })
  }
}

export const places = new Places()
