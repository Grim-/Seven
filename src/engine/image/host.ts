import { EventEmitter } from 'node:events'
import path from 'node:path'
import type { GeneratedImageResult, ImageEditRequest, ImageGenerateRequest, ImageHostState } from '@shared/types'
import { isImageModel } from '@shared/remoteModels'
import { isVaultLocked } from '@shared/sealed'
import { referencePattern, splitLink } from '@shared/text'
import { data } from '../data/hub'
import { resolveEntry, USER } from '../library/kinds'
import { noteFailure } from '../util/report'
import { sdServerBuild, sdServerExe, sdServerLease, sdServerLimits, sdServerVersion } from '../install/helpers/sdServer'
import type { ModelRegistry } from '../model/registry'
import { executeImageRequest, type ResolvedImageParams } from './client'
import { imageHistory } from './history'
import { buildSdServerArgs, ImageServer } from './server'
import { registerPlaceTarget } from '../data/placeTargets'

registerPlaceTarget({ target: 'generate_image', label: 'Generated pictures', home: 'Pictures/Generated', asks: false })
registerPlaceTarget({ target: 'edit_image', label: 'Edited pictures', home: 'Pictures/Generated', asks: false })

export interface ImageRunOptions {
  signal?: AbortSignal
  forceRestoreChat?: boolean
}

function safeSlug(prompt: string): string {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
  return cleaned || 'image'
}

function extForMime(mime: string): string {
  if (mime.includes('jpeg')) return '.jpg'
  if (mime.includes('webp')) return '.webp'
  return '.png'
}

/**
 * Hydrates `@kind:ref` and `@kind:ref#part` links inside an image generation prompt before
 * sending it to `sd-server` or a remote image API (e.g. `@page:art_style @sheet:kaelen#Appearance`).
 * Supports 1 level of nested references so style pages can compose cleanly.
 */
function hydratePromptLinks(raw: string, depth = 0): string {
  if (!raw || !raw.includes('@') || depth > 2) return raw
  const pattern = referencePattern()
  const out = raw.replace(pattern, (match) => {
    try {
      const link = splitLink(match)
      if (!link.kind || !link.ref) return match
      const { kind, id } = resolveEntry(match, null, USER)
      let resolved = ''
      if (link.part) {
        const want = link.part.trim().toLowerCase()
        const field = kind.fields?.(id, USER)?.find((f) => f.name.trim().toLowerCase() === want)
        resolved = field ? field.text : kind.full(id, { part: link.part }, USER)
      } else if (kind.kind === 'page' && data.pages.metaFor(id)) {
        resolved = data.pages.get(id).body
      } else {
        resolved = kind.full(id, {}, USER)
      }
      const cleaned = resolved
        .replace(/^#+\s+.*$/gm, '')
        .replace(/\r?\n+/g, ', ')
        .replace(/\s+/g, ' ')
        .replace(/,\s*,+/g, ', ')
        .replace(/^\s*,\s*|\s*,\s*$/g, '')
        .trim()
      if (!cleaned) return match
      return hydratePromptLinks(cleaned, depth + 1)
    } catch {
      return match
    }
  })
  return out.replace(/\s+/g, ' ').trim()
}

export class ImageHost extends EventEmitter {
  private server: ImageServer | null = null
  private loadedKey: string | null = null
  private starting: AbortController | null = null
  private activeJob: AbortController | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private queue: Promise<void> = Promise.resolve()
  private state: ImageHostState = {
    status: 'unloaded',
    residency: 'ephemeral',
    modelId: null,
    modelName: null,
    pid: null,
    startedAt: null,
    version: null,
    args: [],
    busyCount: 0,
    progress: null,
    error: null,
    log: []
  }

  constructor(
    private models: ModelRegistry,
    private chatLoadedModelId: () => string | null,
    private yieldChatVram?: () => Promise<(() => Promise<void>) | null>
  ) {
    super()
  }

  getState(): ImageHostState {
    return { ...this.state, args: [...this.state.args], log: [...this.state.log] }
  }

  private setState(patch: Partial<ImageHostState>): ImageHostState {
    this.state = { ...this.state, ...patch }
    this.emit('changed', this.getState())
    return this.getState()
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task)
    this.queue = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private clearIdle(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  private touchIdle(): void {
    this.clearIdle()
    if (!this.server) return
    const minutes = sdServerLimits().idleUnloadMinutes
    if (minutes <= 0) return
    this.idleTimer = setTimeout(() => {
      if (this.state.busyCount === 0) void this.unload()
    }, minutes * 60_000)
  }

  private withVramHint(err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err)
    const lower = msg.toLowerCase()
    const chatId = this.chatLoadedModelId()
    if (chatId && (lower.includes('out of memory') || lower.includes('cuda') || lower.includes('vram') || lower.includes('alloc'))) {
      const chatName = this.models.list().find((m) => m.id === chatId)?.name ?? 'a local chat model'
      return new Error(`${msg}\n\nNote: "${chatName}" is currently loaded in llama-server and using GPU VRAM. Unload it or enable CPU offload options in the image model settings if needed.`)
    }
    if (this.server && (lower.includes('fetch failed') || lower.includes('connection failed') || lower.includes('econnreset') || lower.includes('econnrefused'))) {
      const tail = this.server.lastLines().trim()
      if (tail) return new Error(`${msg}\n\nsd-server log:\n${tail}`)
    }
    return err instanceof Error ? err : new Error(msg)
  }

  async load(id: string): Promise<ImageHostState> {
    return this.enqueue(() => this.loadInner(id, { alreadyYielded: false, resident: true }))
  }

  private async loadInner(
    id: string,
    opts: { alreadyYielded: boolean; resident: boolean; runtimeLoraDir?: string | null }
  ): Promise<ImageHostState> {
    const entry = this.models.get(id)
    if (entry.remote) throw new Error(`${entry.name} is a remote model and runs directly via its API without starting sd-server.`)
    if (this.models.infoFor(id)?.kind !== 'image') throw new Error(`${entry.name} is not an image diffusion model.`)

    const exe = sdServerExe()
    const version = sdServerVersion()
    if (!exe || !version) {
      throw new Error('sd-server is not installed or selected yet. Download or point to sd-server.exe under Models › Servers › sd-server first.')
    }
    const pipeline = this.models.resolveImagePipeline(id)
    const args = buildSdServerArgs(pipeline, sdServerBuild()?.flags ?? null, opts.runtimeLoraDir ?? null)
    const key = [id, version, ...args].join('\u0000')
    if (this.server && this.loadedKey === key) {
      if (opts.resident && this.state.residency !== 'resident') this.setState({ residency: 'resident' })
      if (this.state.residency === 'resident') this.touchIdle()
      return this.getState()
    }

    if (!opts.alreadyYielded && sdServerLimits().autoSwapChatModel && this.yieldChatVram) {
      this.setState({ progress: { stage: 'unloading_chat', detail: 'Unloading chat model…', completed: null, total: null, elapsedMs: 0 } })
      await this.yieldChatVram()
    }

    await this.stopServerOnly()
    this.starting?.abort()
    const ctl = new AbortController()
    this.starting = ctl
    const residency = opts.resident ? 'resident' : 'ephemeral'
    this.setState({ status: 'loading', residency, modelId: entry.id, modelName: entry.name, pid: null, progress: null, error: null, args, log: [] })

    try {
      let server: ImageServer | null = null
      server = await ImageServer.start({
        exe,
        version,
        args,
        signal: ctl.signal,
        limits: sdServerLimits(),
        hold: () => sdServerLease(version, entry.name),
        onLog: (log) => {
          this.state = { ...this.state, log }
          this.emit('changed', this.getState())
        },
        onExit: (message) => {
          if (!server || this.server !== server) return
          this.server = null
          this.loadedKey = null
          this.clearIdle()
          this.setState({ status: 'error', residency: 'ephemeral', pid: null, startedAt: null, progress: null, error: message, log: server.logLines() })
        }
      })
      if (ctl.signal.aborted) {
        await server.stop()
        return this.getState()
      }
      this.server = server
      this.loadedKey = key
      if (residency === 'resident') this.touchIdle()
      return this.setState({
        status: 'ready',
        residency,
        modelId: entry.id,
        modelName: entry.name,
        pid: server.pid,
        startedAt: server.startedAt,
        version,
        args,
        progress: null,
        error: null,
        log: server.logLines()
      })
    } catch (err) {
      if (ctl.signal.aborted) {
        this.setState({ status: 'unloaded', residency: 'ephemeral', modelId: null, modelName: null, pid: null, startedAt: null, progress: null, error: null })
      } else {
        const wrapped = this.withVramHint(err)
        this.setState({ status: 'error', residency: 'ephemeral', pid: null, startedAt: null, progress: null, error: wrapped.message })
        throw wrapped
      }
      throw new Error('Image model loading was cancelled.')
    } finally {
      if (this.starting === ctl) this.starting = null
    }
  }

  private async stopServerOnly(): Promise<void> {
    this.clearIdle()
    this.starting?.abort()
    this.starting = null
    const server = this.server
    this.server = null
    this.loadedKey = null
    if (server) await server.stop()
  }

  async unload(): Promise<ImageHostState> {
    this.activeJob?.abort()
    await this.stopServerOnly()
    return this.setState({ status: 'unloaded', residency: 'ephemeral', modelId: null, modelName: null, pid: null, startedAt: null, version: null, args: [], progress: null, error: null })
  }

  async restartOnActive(): Promise<void> {
    if (this.server && this.state.residency === 'resident' && this.state.modelId && this.server.version !== sdServerVersion()) {
      await this.load(this.state.modelId)
    }
  }

  cancel(): boolean {
    let cancelled = false
    if (this.starting) {
      this.starting.abort()
      cancelled = true
    }
    if (this.activeJob) {
      this.activeJob.abort()
      cancelled = true
    }
    return cancelled
  }

  private pickModelId(requested?: string | null): string {
    if (requested?.trim()) {
      const entry = this.models.get(requested.trim())
      if (!entry.remote && this.models.infoFor(entry.id)?.kind !== 'image') {
        throw new Error(`${entry.name} is not an image model. Pick an image model instead.`)
      }
      return entry.id
    }
    const defaultId = this.models.getDefaultImageModel()
    if (defaultId && this.models.has(defaultId)) return defaultId
    if (this.state.modelId && this.models.has(this.state.modelId)) return this.state.modelId
    const imageModels = this.models.list().filter((m) => isImageModel(m))
    if (imageModels.length === 1) return imageModels[0].id
    const favImage = imageModels.find((m) => m.favourite)
    if (favImage) return favImage.id
    if (imageModels.length > 1) throw new Error('Multiple image models are configured. Set a Default image model in the Image tab or specify which model to use.')
    throw new Error('No image model is available yet. Add a diffusion checkpoint in Models or configure a remote image model first.')
  }

  generate(req: ImageGenerateRequest, opts?: ImageRunOptions): Promise<GeneratedImageResult> {
    return this.runImageJob(req, opts)
  }

  edit(req: ImageEditRequest, opts?: ImageRunOptions): Promise<GeneratedImageResult> {
    return this.runImageJob(req, opts)
  }

  private runImageJob(req: ImageGenerateRequest & { sourceAssetId?: string; maskAssetId?: string }, opts?: ImageRunOptions): Promise<GeneratedImageResult> {
    const prompt = req.prompt?.trim()
    if (!prompt) throw new Error('Give a prompt describing the image to generate.')
    this.setState({ busyCount: this.state.busyCount + 1 })
    return this.enqueue(async () => {
      const started = Date.now()
      const ctl = new AbortController()
      const onCallerAbort = () => {
        ctl.abort()
        this.starting?.abort()
      }
      if (opts?.signal?.aborted) onCallerAbort()
      opts?.signal?.addEventListener('abort', onCallerAbort, { once: true })
      this.activeJob = ctl
      this.clearIdle()
      let restoreChat: (() => Promise<void>) | null = null
      const stayLoaded = (this.server !== null && this.state.residency === 'resident') || sdServerLimits().keepServerLoaded
      try {
        const modelId = this.pickModelId(req.modelId)
        const entry = this.models.get(modelId)
        const cfg = entry.remote ? null : this.models.getImageConfig(modelId)
        const hydratedPrompt = hydratePromptLinks(prompt)
        const hydratedNegative = req.negativePrompt?.trim() ? hydratePromptLinks(req.negativePrompt.trim()) : undefined
        const resolvedLoras = entry.remote ? [] : this.models.resolveLoraFiles(req.loras)
        const runtimeLoraDir = resolvedLoras[0]?.dir ?? null
        const params: ResolvedImageParams = {
          prompt: hydratedPrompt,
          negativePrompt: hydratedNegative,
          width: Math.round(req.width ?? cfg?.width ?? 1024),
          height: Math.round(req.height ?? cfg?.height ?? 1024),
          steps: Math.round(req.steps ?? cfg?.steps ?? 20),
          cfgScale: req.cfgScale ?? cfg?.cfgScale ?? 7,
          seed: req.seed,
          sampler: req.sampler?.trim() || cfg?.sampler || undefined,
          loras: resolvedLoras.length ? resolvedLoras.map((l) => ({ stem: l.stem, weight: l.weight })) : undefined,
          sourceAssetId: req.sourceAssetId,
          maskAssetId: req.maskAssetId
        }

        let output
        if (entry.remote) {
          const remote = this.models.remoteTarget(modelId)
          this.setState({ status: 'generating', modelId, modelName: entry.name, progress: null, error: null })
          output = await executeImageRequest({ kind: 'remote', spec: remote.spec, key: remote.key }, params, ctl.signal)
          this.setState({ status: this.server ? 'ready' : 'unloaded', progress: null, error: null })
        } else {
          const limits = sdServerLimits()
          if (limits.chatSwapMode !== 'keep' && this.yieldChatVram) {
            this.setState({ progress: { stage: 'unloading_chat', detail: 'Unloading chat model to free memory…', completed: null, total: null, elapsedMs: 0 } })
            const yielded = await this.yieldChatVram()
            if (yielded && (limits.chatSwapMode === 'swap' || opts?.forceRestoreChat === true)) {
              restoreChat = yielded
            }
          }
          await this.loadInner(modelId, { alreadyYielded: true, resident: stayLoaded && !restoreChat, runtimeLoraDir })
          const server = this.server
          if (!server) throw new Error('sd-server stopped before starting image generation.')
          this.setState({ status: 'generating', progress: { stage: 'queued', detail: '', completed: null, total: null, elapsedMs: 0 }, error: null })
          output = await executeImageRequest(
            { kind: 'sd-server', baseUrl: server.baseUrl, modelName: path.basename(entry.path) },
            params,
            ctl.signal,
            (progress) => this.setState({ progress })
          )
          this.setState({ status: 'ready', progress: null, log: server.logLines(), error: null })
        }

        this.models.touch(modelId)
        const fileName = `${safeSlug(req.name || prompt)}${extForMime(output.mime)}`
        const asset = data.assets.registerBytes(fileName, output.bytes, {
          tool: req.originTool ?? (req.sourceAssetId ? 'edit_image' : 'generate_image'),
          sessionId: req.sessionId ?? null,
          original: prompt.slice(0, 140)
        })
        const durationMs = Date.now() - started
        const seed = output.seed ?? (req.seed ?? null)
        try {
          imageHistory.record({
            kind: req.sourceAssetId ? 'edit' : 'generate',
            prompt,
            negativePrompt: params.negativePrompt ?? null,
            modelId,
            modelName: entry.name,
            assetId: asset.id,
            sourceAssetId: req.sourceAssetId ?? null,
            width: output.width,
            height: output.height,
            steps: params.steps,
            cfgScale: params.cfgScale,
            seed,
            sampler: params.sampler ?? null,
            durationMs,
            contextTitle: req.contextTitle?.trim() || null,
            originTool: req.originTool ?? null
          })
        } catch (err) {
          if (!isVaultLocked(err)) noteFailure(err, 'image', 'Could not save prompt history')
        }
        return {
          asset,
          seed,
          width: output.width,
          height: output.height,
          modelId,
          durationMs
        }
      } catch (err) {
        const wrapped = this.withVramHint(err)
        this.setState({
          status: this.server ? (ctl.signal.aborted ? 'ready' : 'error') : 'unloaded',
          progress: null,
          error: ctl.signal.aborted ? null : wrapped.message,
          ...(this.server ? { log: this.server.logLines() } : {})
        })
        throw wrapped
      } finally {
        opts?.signal?.removeEventListener('abort', onCallerAbort)
        if (!stayLoaded || restoreChat) {
          await this.stopServerOnly()
          this.setState({ status: 'unloaded', residency: 'ephemeral', modelId: null, modelName: null, pid: null, startedAt: null, version: null, args: [], progress: null })
        } else {
          this.setState({ progress: null })
        }
        if (restoreChat) {
          this.setState({ progress: { stage: 'restoring_chat', detail: 'Reloading chat model…', completed: null, total: null, elapsedMs: 0 } })
          await restoreChat().catch((err: unknown) => noteFailure(err, 'server', 'Could not reload llama-server after image generation'))
          this.setState({ progress: null })
        }
        if (this.activeJob === ctl) this.activeJob = null
        this.setState({ busyCount: Math.max(0, this.state.busyCount - 1) })
        if (this.server && this.state.residency === 'resident' && this.state.busyCount === 0) this.touchIdle()
      }
    })
  }
}
