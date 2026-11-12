import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { NetworkSettings } from '@shared/types'
import { dataDir } from '../paths'

interface PendingUpload {
  id: string
  name: string
  size: number
  received: number
  startedAt: number
}

function safeName(name: string): string {
  const base = path.basename(name).replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim()
  return base && base !== '.' && base !== '..' ? base : 'file'
}

export class Uploads {
  private pending = new Map<string, PendingUpload>()

  constructor(private settings: () => NetworkSettings) {}

  root(): string {
    const chosen = this.settings().uploadFolder.trim()
    return chosen ? path.join(chosen, 'seven-files') : path.join(dataDir, 'data', 'remote-files')
  }

  private partFile(id: string): string {
    return path.join(this.root(), `${id}.part`)
  }

  create(name: string, size: number): { upload: string; received: number; chunkBytes: number } {
    const s = this.settings()
    if (!Number.isInteger(size) || size <= 0 || size > s.maxUploadMb * 1024 * 1024) throw new Error(`Files up to ${s.maxUploadMb} MB can be sent.`)
    this.cleanup()
    const id = crypto.randomUUID()
    fs.mkdirSync(this.root(), { recursive: true })
    fs.writeFileSync(this.partFile(id), Buffer.alloc(0))
    this.pending.set(id, { id, name: safeName(name), size, received: 0, startedAt: Date.now() })
    return { upload: id, received: 0, chunkBytes: s.maxMessageMb * 1024 * 1024 }
  }

  append(id: string, offset: number, bytes: Buffer): { received: number; path?: string } {
    const entry = this.pending.get(id)
    if (!entry) throw new Error('That upload is no longer open.')
    if (offset !== entry.received) return { received: entry.received }
    if (entry.received + bytes.length > entry.size) throw new Error('The upload is larger than it said it would be.')
    fs.appendFileSync(this.partFile(id), bytes)
    entry.received += bytes.length
    if (entry.received < entry.size) return { received: entry.received }
    this.pending.delete(id)
    const target = this.place(entry.name)
    fs.renameSync(this.partFile(id), target)
    return { received: entry.received, path: target }
  }

  private place(name: string): string {
    const ext = path.extname(name)
    const stem = name.slice(0, name.length - ext.length)
    for (let i = 0; ; i++) {
      const candidate = path.join(this.root(), i ? `${stem} (${i})${ext}` : name)
      if (!fs.existsSync(candidate)) return candidate
    }
  }

  within(candidate: string): boolean {
    const rel = path.relative(this.root(), path.resolve(candidate))
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
  }

  consume(paths: string[]): void {
    for (const p of paths) {
      if (!this.within(p)) continue
      try {
        fs.rmSync(p, { force: true })
      } catch {
        continue
      }
    }
  }

  cleanup(): void {
    const keepMs = this.settings().uploadKeepMinutes * 60_000
    const now = Date.now()
    const root = this.root()
    let names: string[]
    try {
      names = fs.readdirSync(root)
    } catch {
      return
    }
    for (const n of names) {
      const file = path.join(root, n)
      try {
        const stat = fs.statSync(file)
        if (stat.isFile() && now - stat.mtimeMs > keepMs) fs.rmSync(file, { force: true })
      } catch {
        continue
      }
    }
    for (const [id, entry] of this.pending) {
      if (now - entry.startedAt > keepMs && !fs.existsSync(this.partFile(id))) this.pending.delete(id)
    }
  }
}
