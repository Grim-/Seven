import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import { MODEL_KINDS, type ChatTemplate, type GpuBackend, type ModelConfig, type ModelConfigResult, type ModelEntry, type ModelInfo, type ModelKind, type RemoteApi } from '@shared/types'
import { paths } from '../util/paths'
import { remoteKeys } from './keys'
import type { RemoteTarget } from './remote'
import { readJson, writeJson } from '../util/fs'
import { normalize, reloadRequired } from './params'
import { readHeader } from './gguf/read'

interface ModelsFile {
  models: ModelEntry[]
  configs: Record<string, ModelConfig>
  favourites?: string[]
  lastUsed?: Record<string, number>
  info?: Record<string, { size: number; info: ModelInfo | null; v?: number }>
  kinds?: Record<string, ModelKind>
  templates?: Record<string, ChatTemplate>
  fixes?: Record<string, Record<string, boolean>>
  gpu?: GpuBackend
}

const GPUS: GpuBackend[] = ['auto', 'cuda', 'vulkan', 'cpu']
const INFO_VERSION = 5
function readInfo(filePath: string): Promise<ModelInfo | null> {
  return readHeader(filePath, { size: true }).catch(() => null)
}


function modelId(filePath: string): string {
  const base = path
    .basename(filePath, '.gguf')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const hash = crypto.createHash('sha1').update(path.resolve(filePath).toLowerCase()).digest('hex').slice(0, 6)
  return `${base}-${hash}`
}

function describe(filePath: string, folder: string | null): ModelEntry {
  const name = path.basename(filePath, path.extname(filePath))
  let sizeBytes = 0
  try {
    sizeBytes = fs.statSync(filePath).size
  } catch {
    sizeBytes = 0
  }
  return { id: modelId(filePath), name, path: path.resolve(filePath), sizeBytes, quant: null, folder }
}

function isGguf(file: string): boolean {
  return path.extname(file).toLowerCase() === '.gguf'
}

function walk(dir: string, depth: number, out: string[]): void {
  if (depth > 6) return
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, depth + 1, out)
    else if (entry.isFile() && isGguf(entry.name)) out.push(full)
  }
}

export class ModelRegistry extends EventEmitter {
  private data: ModelsFile

  constructor() {
    super()
    this.data = readJson<ModelsFile>(paths.models, { models: [], configs: {} })
    this.data.models ??= []
    this.data.configs ??= {}
  }

  private save(): void {
    writeJson(paths.models, this.data)
  }

  setFavourite(id: string, on: boolean): ModelEntry[] {
    const favs = new Set(this.data.favourites ?? [])
    if (on) favs.add(id)
    else favs.delete(id)
    this.data.favourites = [...favs]
    this.changed()
    return this.list()
  }

  private changed(): void {
    this.save()
    this.emit('changed', this.list())
  }

  list(): ModelEntry[] {
    const favs = new Set(this.data.favourites ?? [])
    const used = this.data.lastUsed ?? {}
    const info = this.data.info ?? {}
    return [...this.data.models]
      .filter((m) => {
        const known = info[m.id]?.size === m.sizeBytes ? info[m.id]?.info : null
        return !known || (MODEL_KINDS[known.kind].listed && !(known.split && known.split.part > 0))
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => {
        if (m.remote) return { ...m, favourite: favs.has(m.id), remote: { ...m.remote, hasKey: remoteKeys.has(m.id) }, ...(used[m.id] ? { lastUsedAt: used[m.id] } : {}), info: undefined }
        return {
          ...m,
          favourite: favs.has(m.id),
          ...(used[m.id] ? { lastUsedAt: used[m.id] } : {}),
          info: this.infoOf(m, info[m.id]),
          quant: this.infoOf(m, info[m.id])?.quant ?? null,
          ...(this.data.kinds?.[m.id] ? { kindChosen: true } : {})
        }
      })
  }

  private infoOf(m: ModelEntry, cached: { size: number; info: ModelInfo | null } | undefined): ModelInfo | null | undefined {
    if (cached?.size !== m.sizeBytes) return undefined
    const chosen = this.data.kinds?.[m.id]
    return chosen && cached.info ? { ...cached.info, kind: chosen } : cached.info
  }

  setKind(id: string, kind: ModelKind | null): ModelEntry[] {
    const kinds = { ...(this.data.kinds ?? {}) }
    if (kind) kinds[id] = kind
    else delete kinds[id]
    this.data.kinds = kinds
    this.changed()
    return this.list()
  }

  get gpu(): GpuBackend {
    return GPUS.includes(this.data.gpu as GpuBackend) ? (this.data.gpu as GpuBackend) : 'auto'
  }

  setGpu(choice: GpuBackend): void {
    if (!GPUS.includes(choice)) throw new Error(`Unknown GPU backend "${choice}". Pick one of: ${GPUS.join(', ')}.`)
    this.data.gpu = choice
    this.save()
  }

  getTemplate(id: string): ChatTemplate {
    return this.data.templates?.[id] ?? { type: 'auto' }
  }

  setTemplate(id: string, choice: ChatTemplate): ChatTemplate {
    this.get(id)
    const map = { ...(this.data.templates ?? {}) }
    if (choice.type === 'auto') delete map[id]
    else map[id] = choice
    this.data.templates = map
    this.save()
    return this.getTemplate(id)
  }

  getFixes(id: string): Record<string, boolean> {
    return { ...(this.data.fixes?.[id] ?? {}) }
  }

  setFix(id: string, fix: string, on: boolean): Record<string, boolean> {
    this.get(id)
    const mine = { ...(this.data.fixes?.[id] ?? {}) }
    if (on) delete mine[fix]
    else mine[fix] = false
    const map = { ...(this.data.fixes ?? {}) }
    if (Object.keys(mine).length) map[id] = mine
    else delete map[id]
    this.data.fixes = map
    this.save()
    return this.getFixes(id)
  }

  touch(id: string): void {
    this.data.lastUsed = { ...(this.data.lastUsed ?? {}), [id]: Date.now() }
    this.changed()
  }

  private filling: Promise<void> | null = null

  fillInfo(): Promise<void> {
    this.filling ??= (async () => {
      try {
        let count = 0
        for (const m of [...this.data.models]) {
          if (m.remote) continue
          const cached = this.data.info?.[m.id]
          if (cached && cached.size === m.sizeBytes && cached.v === INFO_VERSION) continue
          const info = await readInfo(m.path)
          this.data.info = { ...(this.data.info ?? {}), [m.id]: { size: m.sizeBytes, info, v: INFO_VERSION } }
          if (++count % 5 === 0) this.changed()
        }
        if (count) this.changed()
      } finally {
        this.filling = null
      }
    })()
    return this.filling
  }

  assertRunnable(id: string): void {
    const entry = this.list().find((m) => m.id === id)
    const kind = entry?.info?.kind
    if (entry && kind && !MODEL_KINDS[kind].runnable) throw new Error(`${entry.name} can't be loaded. ${MODEL_KINDS[kind].note}`)
  }

  get(id: string): ModelEntry {
    const found = this.data.models.find((m) => m.id === id)
    if (!found) throw new Error('That model is no longer in Models. Add its file again, or pick another model.')
    return found
  }

  has(id: string): boolean {
    return this.data.models.some((m) => m.id === id)
  }

  scan(folders: string[]): ModelEntry[] {
    const normalized = folders.map((f) => path.resolve(f))
    const kept = this.data.models.filter((m) => m.remote || (m.folder === null && fs.existsSync(m.path)))
    const found: ModelEntry[] = []
    for (const folder of normalized) {
      const files: string[] = []
      walk(folder, 0, files)
      for (const file of files) found.push(describe(file, folder))
    }
    const byId = new Map<string, ModelEntry>()
    for (const m of [...kept, ...found]) byId.set(m.id, m)
    this.data.models = [...byId.values()]
    this.changed()
    return this.list()
  }

  add(filePath: string): ModelEntry {
    if (!fs.existsSync(filePath)) throw new Error(`There is no file at ${filePath}. Pick a .gguf model file that exists on this computer.`)
    if (!filePath.toLowerCase().endsWith('.gguf')) throw new Error('Only .gguf files can be added')
    const entry = describe(filePath, null)
    this.data.models = [...this.data.models.filter((m) => m.id !== entry.id), entry]
    this.changed()
    return entry
  }

  isRemote(id: string | null | undefined): boolean {
    return Boolean(id && this.data.models.find((m) => m.id === id)?.remote)
  }

  saveRemote(input: { id: string | null; name: string; api: RemoteApi; baseUrl: string | null; model: string; key: string | null; contextSize: number | null }): ModelEntry {
    const name = input.name.trim().slice(0, 80)
    const model = input.model.trim()
    if (!name) throw new Error('Give it a name')
    if (!model) throw new Error("Give the provider's model name, e.g. gpt-4.1 or claude-sonnet-4-5")
    if (input.api !== 'openai' && input.api !== 'anthropic') throw new Error('Pick the API it speaks: OpenAI-compatible or Anthropic.')
    const baseUrl = input.baseUrl?.trim() ? input.baseUrl.trim().replace(/\/+$/, '') : null
    if (baseUrl && !/^https?:\/\/\S+$/i.test(baseUrl)) throw new Error('The address must start with http:// or https://')
    const existing = input.id ? this.data.models.find((m) => m.id === input.id && m.remote) : undefined
    if (input.id && !existing) throw new Error('That remote model was removed. Close this form and add it again as a new remote model.')
    const id = existing?.id ?? `remote-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'model'}-${Date.now().toString(36).slice(-4)}`
    const entry: ModelEntry = { id, name, remote: { api: input.api, baseUrl, model, hasKey: false }, path: '', sizeBytes: 0, quant: null, folder: null }
    this.data.models = [...this.data.models.filter((m) => m.id !== id), entry]
    if (input.key !== null) remoteKeys.set(id, input.key.trim() || null)
    if (input.contextSize) this.data.configs[id] = normalize({ ...this.getConfig(id), contextSize: input.contextSize })
    this.changed()
    return this.list().find((m) => m.id === id)!
  }

  remoteTarget(id: string): RemoteTarget {
    const m = this.get(id)
    if (!m.remote) throw new Error(`${m.name} is not a remote model`)
    const size = Number(this.getConfig(id).contextSize) || 32768
    return { id, spec: { ...m.remote, hasKey: remoteKeys.has(id) }, key: remoteKeys.get(id), contextSize: size }
  }

  remove(id: string): boolean {
    if (this.data.models.find((m) => m.id === id)?.remote) remoteKeys.set(id, null)
    const before = this.data.models.length
    this.data.models = this.data.models.filter((m) => m.id !== id)
    delete this.data.configs[id]
    if (this.data.templates) delete this.data.templates[id]
    if (this.data.fixes) delete this.data.fixes[id]
    if (this.data.models.length === before) return false
    this.changed()
    return true
  }

  getConfig(id: string): ModelConfig {
    return normalize(this.data.configs[id] ?? {})
  }

  setConfig(id: string, patch: ModelConfig, loadedConfig: ModelConfig | null): ModelConfigResult {
    this.get(id)
    const config = normalize({ ...this.getConfig(id), ...patch })
    this.data.configs[id] = config
    this.save()
    return { config, reloadRequired: loadedConfig ? reloadRequired(loadedConfig, config) : false }
  }

  resetConfig(id: string, loadedConfig: ModelConfig | null): ModelConfigResult {
    delete this.data.configs[id]
    this.save()
    const config = this.getConfig(id)
    return { config, reloadRequired: loadedConfig ? reloadRequired(loadedConfig, config) : false }
  }
}
