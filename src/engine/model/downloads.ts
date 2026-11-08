import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { DownloadItem } from '@shared/types'
import { isVaultLocked } from '@shared/sealed'
import { dataRoot } from '../util/paths'
import { newId, readJson, writeJson } from '../util/fs'
import { hubTokens } from './hub'
import { hubUrl } from './gguf/read'

const FILE = path.join(dataRoot, 'downloads.json')
const ACTIVE: DownloadItem['state'][] = ['queued', 'downloading']
const PART = /-(\d{5})-of-(\d{5})\.gguf$/i

function partFiles(file: string): string[] {
  const m = file.match(PART)
  if (!m) return [file]
  const parts = Number(m[2])
  return Array.from({ length: parts }, (_, i) => file.replace(PART, `-${String(i + 1).padStart(5, '0')}-of-${m[2]}.gguf`))
}

function auth(): Record<string, string> {
  const token = hubTokens().huggingFace
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function remoteSize(url: string, signal: AbortSignal): Promise<number> {
  const res = await fetch(url, { method: 'HEAD', headers: auth(), signal })
  if (res.status === 401 || res.status === 403) throw new Error('Hugging Face refused the download. The model may need you to accept its terms on its page, or a Hugging Face token in Models.')
  if (!res.ok) throw new Error(`Hugging Face answered ${res.status} for ${path.posix.basename(new URL(url).pathname)}.`)
  const size = Number(res.headers.get('x-linked-size') ?? res.headers.get('content-length'))
  if (!Number.isFinite(size) || size <= 0) throw new Error(`Hugging Face did not say how big ${path.posix.basename(new URL(url).pathname)} is, so it can't be resumed safely.`)
  return size
}

function sizeOn(file: string): number {
  try {
    return fs.statSync(file).size
  } catch {
    return 0
  }
}

class Downloads extends EventEmitter {
  private items: DownloadItem[] | null = null
  private running = new Map<string, AbortController>()
  private stopping = new Set<string>()
  private lastEmit = 0

  private all(): DownloadItem[] {
    if (!this.items) {
      const saved = readJson<DownloadItem[]>(FILE, [])
      this.items = saved.map((d) => (ACTIVE.includes(d.state) ? { ...d, state: 'paused' as const, speed: 0, secondsLeft: null } : d))
    }
    return this.items
  }

  list(): DownloadItem[] {
    try {
      return [...this.all()]
    } catch (err) {
      if (isVaultLocked(err)) return []
      throw err
    }
  }

  private save(): void {
    writeJson(FILE, this.all())
    this.emit('changed', this.list())
  }

  private patch(id: string, change: Partial<DownloadItem>, persist = true): void {
    this.items = this.all().map((d) => (d.id === id ? { ...d, ...change } : d))
    if (persist) return this.save()
    const now = Date.now()
    if (now - this.lastEmit < 400) return
    this.lastEmit = now
    this.emit('changed', this.list())
  }

  start(input: { repo: string; file: string; name: string; folder: string; total: number }): DownloadItem[] {
    if (!input.folder) throw new Error('Pick a model folder to save it in. Add one under Folders in Models first if there are none.')
    const same = this.all().find((d) => d.repo === input.repo && d.file === input.file && d.folder === input.folder && d.state !== 'done')
    if (same) throw new Error(`${input.name} is already in your downloads. Resume it there instead.`)
    const item: DownloadItem = { id: newId('dl'), ...input, state: 'queued', received: 0, speed: 0, secondsLeft: null, error: null, path: null, startedAt: Date.now() }
    this.items = [...this.all(), item]
    this.save()
    this.pump()
    return this.list()
  }

  private pump(): void {
    if (this.all().some((d) => d.state === 'downloading')) return
    const next = this.all().find((d) => d.state === 'queued')
    if (next) void this.run(next)
  }

  private targets(d: DownloadItem): { url: string; target: string }[] {
    return partFiles(d.file).map((file) => ({ url: hubUrl(d.repo, file), target: path.join(d.folder, path.posix.basename(file)) }))
  }

  private async run(d: DownloadItem): Promise<void> {
    const controller = new AbortController()
    this.running.set(d.id, controller)
    this.patch(d.id, { state: 'downloading', error: null })
    try {
      const files = this.targets(d)
      const sizes = await Promise.all(files.map((f) => remoteSize(f.url, controller.signal)))
      const total = sizes.reduce((n, s) => n + s, 0)
      let received = files.reduce((n, f, i) => n + (sizeOn(f.target) === sizes[i] ? sizes[i] : Math.min(sizeOn(`${f.target}.part`), sizes[i])), 0)
      const began = Date.now()
      const startedWith = received
      const report = () => {
        const seconds = (Date.now() - began) / 1000
        const speed = seconds > 0 ? (received - startedWith) / seconds : 0
        this.patch(d.id, { received, total, speed, secondsLeft: speed > 0 ? Math.round((total - received) / speed) : null }, false)
      }
      for (const [i, f] of files.entries()) {
        if (sizeOn(f.target) === sizes[i]) continue
        const part = `${f.target}.part`
        let from = Math.min(sizeOn(part), sizes[i])
        if (from < sizes[i]) {
          const res = await fetch(f.url, { headers: { ...auth(), ...(from > 0 ? { Range: `bytes=${from}-` } : {}) }, signal: controller.signal })
          if (!res.ok || !res.body) throw new Error(`Downloading ${path.basename(f.target)} failed: Hugging Face answered ${res.status}.`)
          if (from > 0 && res.status !== 206) {
            received -= from
            from = 0
          }
          fs.mkdirSync(path.dirname(part), { recursive: true })
          const count = new Transform({
            transform(chunk: Buffer, _enc, done) {
              received += chunk.length
              report()
              done(null, chunk)
            }
          })
          await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), count, fs.createWriteStream(part, { flags: from > 0 ? 'a' : 'w' }), { signal: controller.signal })
        }
        if (sizeOn(part) !== sizes[i]) throw new Error(`${path.basename(f.target)} came out the wrong size. Resume the download to try again.`)
        fs.renameSync(part, f.target)
      }
      this.patch(d.id, { state: 'done', path: files[0].target, received: total, total, speed: 0, secondsLeft: 0 })
    } catch (err) {
      if (!this.stopping.has(d.id)) this.patch(d.id, { state: 'failed', speed: 0, secondsLeft: null, error: err instanceof Error ? err.message : String(err) })
    } finally {
      this.running.delete(d.id)
      this.stopping.delete(d.id)
      this.pump()
    }
  }

  private async stop(id: string): Promise<void> {
    const controller = this.running.get(id)
    if (!controller) return
    this.stopping.add(id)
    controller.abort()
    while (this.running.has(id)) await new Promise((resolve) => setTimeout(resolve, 50))
  }

  async pause(id: string): Promise<DownloadItem[]> {
    this.patch(id, { state: 'paused', speed: 0, secondsLeft: null })
    await this.stop(id)
    return this.list()
  }

  resume(id: string): DownloadItem[] {
    this.patch(id, { state: 'queued', error: null })
    this.pump()
    return this.list()
  }

  async cancel(id: string): Promise<DownloadItem[]> {
    const item = this.all().find((d) => d.id === id)
    if (!item) throw new Error('That download is no longer listed.')
    await this.stop(id)
    this.items = this.all().filter((d) => d.id !== id)
    this.save()
    if (item.state !== 'done') {
      try {
        for (const f of this.targets(item)) fs.rmSync(`${f.target}.part`, { force: true })
      } catch (err) {
        throw new Error(`Removed ${item.name} from downloads, but its partial file in ${item.folder} could not be cleaned up: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return this.list()
  }

  clearFinished(): DownloadItem[] {
    this.items = this.all().filter((d) => d.state !== 'done')
    this.save()
    return this.list()
  }
}

export const downloads = new Downloads()
