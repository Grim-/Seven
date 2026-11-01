import fs from 'node:fs'
import path from 'node:path'
import { onStorageChange, type StorageChange } from './fs'
import { vaultEvents } from './secure'

interface Entry<T> {
  size: number
  mtime: number
  value: T | null
}

interface Listing<T> {
  dirMtime: number
  at: number
  items: { name: string; file: string; value: T }[]
}

const FRESH_MS = 2000
const VERIFY_EVERY = 25

const indexes = new Set<DirIndex<unknown>>()

export class DirIndex<T> {
  private files = new Map<string, Entry<T>>()
  private listing: Listing<T> | null = null
  private lists = 0

  private dir: string

  constructor(
    readonly name: string,
    dir: string,
    private fileOf: (entry: string, isDir: boolean) => string | null,
    private read: (file: string) => T | null
  ) {
    this.dir = path.resolve(dir)
    indexes.add(this as DirIndex<unknown>)
  }

  get(target: string): T | null {
    const file = path.resolve(target)
    let st: fs.Stats
    try {
      st = fs.statSync(file)
    } catch {
      this.files.delete(file)
      return null
    }
    const hit = this.files.get(file)
    if (hit && hit.size === st.size && hit.mtime === st.mtimeMs) return hit.value
    const value = this.read(file)
    this.files.set(file, { size: st.size, mtime: st.mtimeMs, value })
    return value
  }

  values(): { name: string; file: string; value: T }[] {
    let dirMtime: number
    try {
      dirMtime = fs.statSync(this.dir).mtimeMs
    } catch {
      this.clear()
      return []
    }
    const now = Date.now()
    const memo = this.listing
    if (memo && memo.dirMtime === dirMtime && now - memo.at < FRESH_MS) return memo.items
    const items: Listing<T>['items'] = []
    const seen = new Set<string>()
    for (const entry of fs.readdirSync(this.dir, { withFileTypes: true })) {
      const target = this.fileOf(entry.name, entry.isDirectory())
      if (!target) continue
      const file = path.resolve(target)
      seen.add(file)
      const value = this.get(file)
      if (value !== null) items.push({ name: entry.name, file, value })
    }
    for (const key of [...this.files.keys()]) if (!seen.has(key)) this.files.delete(key)
    this.listing = { dirMtime, at: now, items }
    if (process.env.SEVEN_DEV === '1' && ++this.lists % VERIFY_EVERY === 0) this.verify(items)
    return items
  }

  touched(change: StorageChange): void {
    for (const p of [change.path, change.to]) {
      if (!p) continue
      const abs = path.resolve(p)
      if (abs === this.dir || this.dir.startsWith(abs + path.sep)) {
        this.clear()
        return
      }
      if (!abs.startsWith(this.dir + path.sep)) continue
      this.listing = null
      for (const key of [...this.files.keys()]) if (key === abs || key.startsWith(abs + path.sep)) this.files.delete(key)
    }
  }

  clear(): void {
    this.files.clear()
    this.listing = null
  }

  private verify(items: Listing<T>['items']): void {
    for (const item of items) {
      let fresh: T | null
      try {
        fresh = this.read(item.file)
      } catch {
        continue
      }
      if (JSON.stringify(fresh) !== JSON.stringify(item.value)) console.warn(`[index] ${this.name}: ${item.file} differs from what is on disk`)
    }
  }
}

export function clearIndexes(): void {
  for (const index of indexes) index.clear()
}

onStorageChange((change) => {
  for (const index of indexes) index.touched(change)
})
vaultEvents.on('locked', clearIndexes)
vaultEvents.on('unlocked', clearIndexes)
