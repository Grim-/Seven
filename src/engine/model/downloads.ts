import path from 'node:path'
import { EventEmitter } from 'node:events'
import { createModelDownloader, type ModelDownloader } from 'node-llama-cpp'
import type { DownloadItem } from '@shared/types'
import { isVaultLocked } from '@shared/sealed'
import { dataRoot } from '../util/paths'
import { newId, readJson, writeJson } from '../util/fs'
import { hubTokens } from './hub'

const FILE = path.join(dataRoot, 'downloads.json')
const ACTIVE: DownloadItem['state'][] = ['queued', 'downloading']

class Downloads extends EventEmitter {
  private items: DownloadItem[] | null = null
  private running = new Map<string, ModelDownloader>()
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

  private downloader(d: DownloadItem, onProgress?: (s: { totalSize: number; downloadedSize: number; averageSpeed: number }) => void): Promise<ModelDownloader> {
    return createModelDownloader({ modelUri: `hf:${d.repo}/${d.file}`, dirPath: d.folder, tokens: hubTokens(), deleteTempFileOnCancel: false, skipExisting: true, ...(onProgress ? { onProgress } : {}) })
  }

  private async run(d: DownloadItem): Promise<void> {
    this.patch(d.id, { state: 'downloading', error: null })
    try {
      const downloader = await this.downloader(d, (s) => {
        const left = s.averageSpeed > 0 ? Math.round((s.totalSize - s.downloadedSize) / s.averageSpeed) : null
        this.patch(d.id, { received: s.downloadedSize, total: s.totalSize, speed: s.averageSpeed, secondsLeft: left }, false)
      })
      this.running.set(d.id, downloader)
      const file = await downloader.download()
      this.patch(d.id, { state: 'done', path: file, received: downloader.totalSize, total: downloader.totalSize, speed: 0, secondsLeft: 0 })
    } catch (err) {
      if (!this.stopping.has(d.id)) this.patch(d.id, { state: 'failed', speed: 0, secondsLeft: null, error: err instanceof Error ? err.message : String(err) })
    } finally {
      this.running.delete(d.id)
      this.stopping.delete(d.id)
      this.pump()
    }
  }

  async pause(id: string): Promise<DownloadItem[]> {
    const running = this.running.get(id)
    this.patch(id, { state: 'paused', speed: 0, secondsLeft: null })
    if (running) {
      this.stopping.add(id)
      await running.cancel({ deleteTempFile: false })
    }
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
    const running = this.running.get(id)
    if (running) {
      this.stopping.add(id)
      await running.cancel({ deleteTempFile: true })
      this.items = this.all().filter((d) => d.id !== id)
      this.save()
      return this.list()
    }
    this.items = this.all().filter((d) => d.id !== id)
    this.save()
    if (item.state !== 'done') {
      try {
        await (await this.downloader(item)).cancel({ deleteTempFile: true })
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
