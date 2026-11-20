import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { ImageHistoryEntry } from '@shared/types'
import { isVaultLocked } from '@shared/sealed'
import { dataRoot } from '../util/paths'
import { newId, readJson, writeJson } from '../util/fs'
import { vaultEvents } from '../util/secure'

const FILE = path.join(dataRoot, 'image-history.json')
const MAX_HISTORY = 500

class ImageHistory extends EventEmitter {
  private load(): ImageHistoryEntry[] {
    const raw = readJson<unknown>(FILE, [])
    return Array.isArray(raw) ? (raw as ImageHistoryEntry[]) : []
  }

  private save(list: ImageHistoryEntry[]): ImageHistoryEntry[] {
    const trimmed = list.slice(0, MAX_HISTORY)
    writeJson(FILE, trimmed)
    this.emit('changed', trimmed)
    return trimmed
  }

  /** List saved image prompts and their generated outputs (stored encrypted inside the vault). */
  list(): ImageHistoryEntry[] {
    try {
      return this.load()
    } catch (err) {
      if (isVaultLocked(err)) return []
      throw err
    }
  }

  /** Record a completed generation or edit entry cleanly inside the vault. */
  record(entry: Omit<ImageHistoryEntry, 'id' | 'createdAt'>): ImageHistoryEntry {
    const next: ImageHistoryEntry = {
      id: newId('imghist'),
      createdAt: Date.now(),
      ...entry
    }
    this.save([next, ...this.load()])
    return next
  }

  remove(id: string): ImageHistoryEntry[] {
    return this.save(this.load().filter((item) => item.id !== id))
  }

  clear(): ImageHistoryEntry[] {
    return this.save([])
  }
}

export const imageHistory = new ImageHistory()

vaultEvents.on('locked', () => imageHistory.emit('changed', []))
vaultEvents.on('unlocked', () => imageHistory.emit('changed', imageHistory.list()))
