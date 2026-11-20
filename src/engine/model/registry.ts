import { noteFailure } from '../util/report'
import { notFound } from '@shared/errors'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import { DEFAULT_IMAGE_CONFIG, MODEL_KINDS, type ChatTemplate, type ImageCompanionRef, type ImageCompanions, type ImageModelConfig, type ModelConfig, type ModelConfigResult, type ModelEntry, type ModelInfo, type ModelKind, type RemoteApi } from '@shared/types'
import { resolveImageArchSpec, missingRecipeSlots, type CompanionSlot } from '@shared/imageModels'
import { REMOTE_APIS } from '@shared/remoteModels'
import { paths } from '../util/paths'
import { remoteKeys } from './keys'
import type { ApiTarget } from './apiChat'
import { readJson, writeJson } from '../util/fs'
import { normalize } from './params'
import { isModelFile, readModelInfo } from './weightMeta'

interface ModelsFile {
  models: ModelEntry[]
  configs: Record<string, ModelConfig>
  imageConfigs?: Record<string, Partial<ImageModelConfig>>
  favourites?: string[]
  lastUsed?: Record<string, number>
  info?: Record<string, { size: number; info: ModelInfo | null; v?: number }>
  kinds?: Record<string, ModelKind>
  templates?: Record<string, ChatTemplate>
  projectors?: Record<string, string | null>
  packs?: Record<string, string[]>
}

export type ConfigOverlay = (id: string, own: ModelConfig) => ModelConfig

const INFO_VERSION = 7
function readInfo(filePath: string): Promise<ModelInfo | null> {
  return readModelInfo(filePath, { size: true }).catch((err: unknown) => (noteFailure(err, 'models', "Could not read a model file's header"), null))
}

function modelId(filePath: string): string {
  const base = path
    .basename(filePath, path.extname(filePath))
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
  } catch (err) {
    noteFailure(err, 'models', "Could not read a model file's size")
    sizeBytes = 0
  }
  return { id: modelId(filePath), name, path: path.resolve(filePath), sizeBytes, quant: null, folder }
}

function normalizeImageConfig(raw?: Partial<ImageModelConfig> | null): ImageModelConfig {
  const s = raw ?? {}
  const opt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const num = (v: unknown, fallback: number, min: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback)
  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
  const mode = s.mode === 'model' || s.mode === 'diffusion' || s.mode === 'auto' ? s.mode : DEFAULT_IMAGE_CONFIG.mode
  return {
    mode,
    vae: opt(s.vae),
    tae: opt(s.tae),
    clipL: opt(s.clipL),
    clipG: opt(s.clipG),
    t5xxl: opt(s.t5xxl),
    llm: opt(s.llm),
    llmVision: opt(s.llmVision),
    loraDir: opt(s.loraDir),
    width: Math.round(num(s.width, DEFAULT_IMAGE_CONFIG.width, 64)),
    height: Math.round(num(s.height, DEFAULT_IMAGE_CONFIG.height, 64)),
    steps: Math.round(num(s.steps, DEFAULT_IMAGE_CONFIG.steps, 1)),
    cfgScale: num(s.cfgScale, DEFAULT_IMAGE_CONFIG.cfgScale, 0),
    sampler: typeof s.sampler === 'string' && s.sampler.trim() ? s.sampler.trim() : DEFAULT_IMAGE_CONFIG.sampler,
    clipOnCpu: bool(s.clipOnCpu, DEFAULT_IMAGE_CONFIG.clipOnCpu),
    vaeTiling: bool(s.vaeTiling, DEFAULT_IMAGE_CONFIG.vaeTiling),
    flashAttention: bool(s.flashAttention, DEFAULT_IMAGE_CONFIG.flashAttention),
    offloadToCpu: bool(s.offloadToCpu, DEFAULT_IMAGE_CONFIG.offloadToCpu)
  }
}

function walk(dir: string, depth: number, out: string[]): void {
  if (depth > 6) return
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    noteFailure(err, 'models', 'Could not scan a model folder')
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, depth + 1, out)
    else if (entry.isFile() && isModelFile(entry.name)) out.push(full)
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
        const known = this.infoOf(m, info[m.id])
        return !known || (MODEL_KINDS[known.kind].listed && !(known.split && known.split.part > 0))
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => {
        if (m.remote) {
          const override = this.data.kinds?.[m.id]
          const category = override === 'image' ? ('image' as const) : m.remote.category
          return {
            ...m,
            favourite: favs.has(m.id),
            remote: { ...m.remote, hasKey: remoteKeys.has(m.id), ...(category ? { category } : {}) },
            ...(used[m.id] ? { lastUsedAt: used[m.id] } : {}),
            ...(override ? { kindChosen: true } : {}),
            info: undefined
          }
        }
        const resolved = this.infoOf(m, info[m.id])
        return {
          ...m,
          favourite: favs.has(m.id),
          ...(used[m.id] ? { lastUsedAt: used[m.id] } : {}),
          info: resolved,
          quant: resolved?.quant ?? null,
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

  mtpLayers(id: string): number | null {
    return this.list().find((m) => m.id === id)?.info?.mtpLayers ?? null
  }

  private modelsOfKind(kind: ModelKind): ImageCompanionRef[] {
    const info = this.data.info ?? {}
    return this.data.models.filter((m) => !m.remote && this.infoOf(m, info[m.id])?.kind === kind).map((m) => ({ id: m.id, name: m.name, path: m.path }))
  }

  projectors(): ImageCompanionRef[] {
    return this.modelsOfKind('projector')
  }

  imageCompanions(): ImageCompanions {
    return {
      vaes: this.modelsOfKind('vae'),
      textEncoders: this.modelsOfKind('text_encoder'),
      projectors: this.modelsOfKind('projector'),
      loras: this.modelsOfKind('lora')
    }
  }

  projectorFor(id: string): { choice: string | null; auto: boolean } {
    const all = this.projectors()
    const set = this.data.projectors?.[id]
    if (set !== undefined) return { choice: set && all.some((p) => p.id === set) ? set : null, auto: false }
    const m = this.data.models.find((x) => x.id === id)
    if (!m || m.remote) return { choice: null, auto: true }
    const dir = path.dirname(m.path).toLowerCase()
    return { choice: all.find((p) => path.dirname(p.path).toLowerCase() === dir)?.id ?? null, auto: true }
  }

  setProjector(id: string, projector: string | null): { choice: string | null; auto: boolean } {
    this.get(id)
    if (projector && !this.projectors().some((p) => p.id === projector)) throw notFound(new Error('That vision adapter is no longer in Models. Pick another, or none.'))
    this.data.projectors = { ...this.data.projectors, [id]: projector }
    this.save()
    return this.projectorFor(id)
  }

  projectorPath(id: string): string | null {
    const choice = this.projectorFor(id).choice
    return choice ? (this.projectors().find((p) => p.id === choice)?.path ?? null) : null
  }

  getTemplate(id: string): ChatTemplate {
    const saved = this.data.templates?.[id]
    return saved?.type === 'jinja' && saved.template.trim() ? saved : { type: 'auto' }
  }

  templateText(id: string): string | null {
    const choice = this.getTemplate(id)
    return choice.type === 'jinja' ? choice.template : null
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
    if (!found) throw notFound(new Error('That model is no longer in Models. Add its file again, or pick another model.'))
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
    if (!fs.existsSync(filePath)) throw new Error(`There is no file at ${filePath}. Pick a supported model file (.gguf, .safetensors, .sft, .ckpt) that exists on this computer.`)
    if (!isModelFile(filePath)) throw new Error('Only .gguf, .safetensors, .sft, and .ckpt files can be added')
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
    if (!model) throw new Error("Give the provider's model name, e.g. gemini-2.5-flash, gpt-4.1-mini, or claude-sonnet-4-5")
    if (!REMOTE_APIS.some((a) => a.id === input.api)) {
      throw new Error(`Pick a supported API: ${REMOTE_APIS.map((a) => a.label).join(', ')}.`)
    }
    const baseUrl = input.baseUrl?.trim() ? input.baseUrl.trim().replace(/\/+$/, '') : null
    if (baseUrl && !/^https?:\/\/\S+$/i.test(baseUrl)) throw new Error('The address must start with http:// or https://')
    const existing = input.id ? this.data.models.find((m) => m.id === input.id && m.remote) : undefined
    if (input.id && !existing) throw new Error('That remote model was removed. Close this form and add it again as a new remote model.')
    const id = existing?.id ?? `remote-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'model'}-${Date.now().toString(36).slice(-4)}`
    const entry: ModelEntry = { id, name, remote: { api: input.api, baseUrl, model, hasKey: false }, path: '', sizeBytes: 0, quant: null, folder: null }
    this.data.models = [...this.data.models.filter((m) => m.id !== id), entry]
    if (input.key !== null) remoteKeys.set(id, input.key.trim() || null)
    if (input.contextSize) this.data.configs[id] = normalize({ ...this.ownConfig(id), contextSize: input.contextSize })
    this.changed()
    return this.list().find((m) => m.id === id)!
  }

  previewRemoteTarget(input: { id?: string | null; api: RemoteApi; baseUrl: string | null; model: string; key: string | null; contextSize: number | null }): ApiTarget {
    if (!REMOTE_APIS.some((a) => a.id === input.api)) throw new Error('Unsupported remote API.')
    const baseUrl = input.baseUrl?.trim() ? input.baseUrl.trim().replace(/\/+$/, '') : null
    if (baseUrl && !/^https?:\/\/\S+$/i.test(baseUrl)) throw new Error('The address must start with http:// or https://')
    const savedKey = input.id ? remoteKeys.get(input.id) : null
    const rawKey = input.key !== null && input.key.trim() ? input.key.trim() : savedKey
    return {
      id: input.id ?? '__probe__',
      spec: { api: input.api, baseUrl, model: input.model.trim(), hasKey: Boolean(rawKey) },
      key: rawKey ?? null,
      contextSize: input.contextSize || 32768
    }
  }

  remoteTarget(id: string): ApiTarget {
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
    if (this.data.projectors) delete this.data.projectors[id]
    if (this.data.packs) delete this.data.packs[id]
    if (this.data.imageConfigs) delete this.data.imageConfigs[id]
    if (this.data.models.length === before) return false
    this.changed()
    return true
  }

  private overlay: ConfigOverlay | null = null

  setOverlay(overlay: ConfigOverlay): void {
    this.overlay = overlay
  }

  ownConfig(id: string): ModelConfig {
    return normalize(this.data.configs[id] ?? {})
  }

  getConfig(id: string): ModelConfig {
    const own = this.ownConfig(id)
    return this.overlay ? this.overlay(id, own) : own
  }

  packsOf(id: string): string[] {
    return this.data.packs?.[id] ?? []
  }

  setPacks(id: string, on: string[]): void {
    this.get(id)
    this.data.packs = { ...this.data.packs, [id]: on }
    this.save()
  }

  infoFor(id: string): ModelInfo | null | undefined {
    const m = this.data.models.find((x) => x.id === id)
    return m ? this.infoOf(m, this.data.info?.[id]) : null
  }

  setConfig(id: string, patch: ModelConfig): ModelConfigResult {
    this.get(id)
    const config = normalize({ ...this.ownConfig(id), ...patch })
    this.data.configs[id] = config
    this.save()
    return { config }
  }

  resetConfig(id: string): ModelConfigResult {
    delete this.data.configs[id]
    this.save()
    return { config: this.ownConfig(id) }
  }

  getImageConfig(id: string): ImageModelConfig {
    this.get(id)
    return normalizeImageConfig(this.data.imageConfigs?.[id])
  }

  setImageConfig(id: string, patch: Partial<ImageModelConfig>): ImageModelConfig {
    this.get(id)
    const next = normalizeImageConfig({ ...this.getImageConfig(id), ...patch })
    this.data.imageConfigs = { ...(this.data.imageConfigs ?? {}), [id]: next }
    this.save()
    return next
  }

  resetImageConfig(id: string): ImageModelConfig {
    this.get(id)
    if (this.data.imageConfigs) delete this.data.imageConfigs[id]
    this.save()
    return normalizeImageConfig(null)
  }

  private resolveCompanionFile(ref: string | null, role: string): string | null {
    if (!ref) return null
    const model = this.data.models.find((m) => m.id === ref)
    const resolved = model ? model.path : path.resolve(ref)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error(`The ${role} file for this image model was not found (${resolved}). Pick another in Models.`)
    }
    return resolved
  }

  resolveImagePipeline(id: string): {
    mode: 'model' | 'diffusion'
    modelPath: string
    vae: string | null
    tae: string | null
    clipL: string | null
    clipG: string | null
    t5xxl: string | null
    llm: string | null
    llmVision: string | null
    loraDir: string | null
    config: ImageModelConfig
  } {
    const entry = this.get(id)
    if (entry.remote) throw new Error(`${entry.name} is a remote model, not a local diffusion file.`)
    if (!fs.existsSync(entry.path)) throw new Error(`Model file not found on disk: ${entry.path}`)
    const config = this.getImageConfig(id)
    const vae = this.resolveCompanionFile(config.vae, 'VAE')
    const tae = this.resolveCompanionFile(config.tae, 'TAE / TAESD')
    const clipL = this.resolveCompanionFile(config.clipL, 'CLIP-L')
    const clipG = this.resolveCompanionFile(config.clipG, 'CLIP-G')
    const t5xxl = this.resolveCompanionFile(config.t5xxl, 'T5XXL')
    const llm = this.resolveCompanionFile(config.llm, 'LLM encoder')
    const llmVision = this.resolveCompanionFile(config.llmVision, 'LLM vision projector')
    let loraDir: string | null = null
    if (config.loraDir) {
      const candidate = this.data.models.find((m) => m.id === config.loraDir)?.path ?? path.resolve(config.loraDir)
      if (!fs.existsSync(candidate)) throw new Error(`The LoRA folder for this image model was not found (${candidate}).`)
      loraDir = fs.statSync(candidate).isDirectory() ? candidate : path.dirname(candidate)
    }
    const info = this.infoFor(id)
    const spec = resolveImageArchSpec(info?.architecture, entry.name)
    const hasEncoders = Boolean(clipL || clipG || t5xxl || llm)
    const mode: 'model' | 'diffusion' = config.mode === 'auto' ? (spec?.modular || hasEncoders ? 'diffusion' : 'model') : config.mode
    if (mode === 'diffusion' && spec) {
      const configured: Record<CompanionSlot, string | null> = { vae, tae, clipL, clipG, t5xxl, llm, llmVision }
      const missing = missingRecipeSlots(spec, configured)
      if (missing.length > 0 && !vae && !tae && !hasEncoders) {
        const names = missing.map((s) => `${s.label} (${s.flag})`).join(', ')
        throw new Error(`${entry.name} (${spec.label}) needs its companion weights configured before starting sd-server: ${names}. Open the model's Companions or Auto-match them first.`)
      }
    }
    return { mode, modelPath: entry.path, vae, tae, clipL, clipG, t5xxl, llm, llmVision, loraDir, config }
  }

  autoMatchImageCompanions(id: string): ImageModelConfig {
    const entry = this.get(id)
    const info = this.infoFor(id)
    const spec = resolveImageArchSpec(info?.architecture, entry.name)
    const current = this.getImageConfig(id)
    if (!spec) return current
    const companions = this.imageCompanions()
    const poolBySlot: Record<CompanionSlot, ImageCompanionRef[]> = {
      vae: companions.vaes,
      tae: companions.vaes,
      clipL: companions.textEncoders,
      clipG: companions.textEncoders,
      t5xxl: companions.textEncoders,
      llm: [...companions.textEncoders, ...this.modelsOfKind('chat')],
      llmVision: companions.projectors
    }
    const patch: Partial<ImageModelConfig> = {}
    for (const slot of spec.slots) {
      if (current[slot.slot]) continue
      if (slot.slot === 'tae' && (current.vae || patch.vae)) continue
      const re = new RegExp(slot.matchPattern, 'i')
      const match = poolBySlot[slot.slot].find((candidate) => re.test(`${candidate.name} ${path.basename(candidate.path)}`))
      if (match) patch[slot.slot] = match.id
    }
    return Object.keys(patch).length ? this.setImageConfig(id, patch) : current
  }
}
