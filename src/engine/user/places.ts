import path from 'node:path'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'
import { noteFailure } from '../util/report'
import { vaultEvents } from '../util/secure'

const FILE = path.join(dataRoot, 'places.json')
const FLUSH_MS = 150

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

class Places {
  private cache: Record<string, unknown> | null = null
  private dirty = false
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    vaultEvents.on('locked', () => {
      this.flushNow()
      this.cache = null
    })
    vaultEvents.on('unlocked', () => {
      this.cache = null
    })
    process.on('beforeExit', () => this.flushNow())
  }

  get(): Record<string, unknown> {
    if (this.cache) return { ...this.cache }
    const raw = readJson<unknown>(FILE, {})
    const loaded = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    this.cache = loaded
    return { ...loaded }
  }

  set(key: string, value: unknown): void {
    const current = this.cache ?? this.get()
    if (key in current && sameValue(current[key], value)) return
    this.cache = { ...current, [key]: value }
    this.dirty = true
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushNow(), FLUSH_MS)
    }
  }

  flushNow(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (!this.dirty || !this.cache) return
    const snapshot = this.cache
    this.dirty = false
    try {
      writeJson(FILE, snapshot)
    } catch (err) {
      noteFailure(err, 'places', 'Could not save remembered view positions')
    }
  }
}

export const places = new Places()
