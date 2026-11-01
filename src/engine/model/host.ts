import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { getLlama, type Llama, type LlamaContext, type LlamaContextSequence, type LlamaModel } from 'node-llama-cpp'
import type { CudaInstallProgress, GpuBackend, GpuInfo, ModelConfig, ModelEntry, ModelFacts, ModelHostState } from '@shared/types'
import { contextOptions, loadOptions, sequenceOptions } from './params'
import { CUDA_DOWNLOAD_BYTES, addCudaToPath, cudaDiagnosis, cudaMissing, installCudaRuntime } from './cuda'

const GPU_LABEL: Record<GpuBackend, string> = { auto: 'The GPU backend', cuda: 'CUDA', vulkan: 'Vulkan', cpu: 'The CPU backend' }

function lineOf(args: unknown[]): string {
  return args
    .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .trim()
}

function nvidiaDriver(): boolean {
  if (process.platform !== 'win32') return false
  try {
    return fs.existsSync(path.join(process.env.windir ?? 'C:\\Windows', 'System32', 'nvml.dll'))
  } catch {
    return false
  }
}

interface Loaded {
  entry: ModelEntry
  config: ModelConfig
  model: LlamaModel
  context: LlamaContext
  sequence: LlamaContextSequence
}

export class ModelHost extends EventEmitter {
  private llama: Llama | null = null
  private loaded: Loaded | null = null
  private loading: Promise<void> | null = null
  private state: ModelHostState = { status: 'unloaded', modelId: null, progress: 0, contextSize: null, error: null }
  private lastProgressEmit = 0
  private gpu: GpuBackend
  private fallbackNote: string | null = null

  constructor(gpu: GpuBackend) {
    super()
    this.gpu = gpu
    addCudaToPath()
  }

  get gpuNote(): string | null {
    return this.fallbackNote
  }

  gpuInfo(): GpuInfo {
    return { choice: this.gpu, active: this.activeGpu, note: this.fallbackNote, cudaDownload: nvidiaDriver() && cudaMissing().length ? CUDA_DOWNLOAD_BYTES : null }
  }

  async installCuda(onProgress: (p: CudaInstallProgress) => void): Promise<void> {
    if (this.loading) await this.loading.catch(() => undefined)
    await this.unload()
    await installCudaRuntime(AbortSignal.timeout(60 * 60 * 1000), onProgress)
    this.fallbackNote = null
  }

  get gpuChoice(): GpuBackend {
    return this.gpu
  }

  get activeGpu(): string | null {
    if (!this.llama) return null
    return this.llama.gpu === false ? 'cpu' : this.llama.gpu
  }

  async setGpu(choice: GpuBackend): Promise<void> {
    if (choice === this.gpu) return
    if (this.loading) await this.loading.catch(() => undefined)
    this.gpu = choice
    this.fallbackNote = null
    await this.unload()
    const old = this.llama
    this.llama = null
    await old?.dispose()
  }

  private async startLlama(): Promise<Llama> {
    if (this.llama) return this.llama
    const lines: string[] = []
    const { warn, error } = console
    console.warn = (...args: unknown[]) => {
      lines.push(lineOf(args))
      warn(...args)
    }
    console.error = (...args: unknown[]) => {
      lines.push(lineOf(args))
      error(...args)
    }
    try {
      this.llama = this.gpu === 'auto' ? await getLlama() : await getLlama({ gpu: this.gpu === 'cpu' ? false : this.gpu })
    } catch (err) {
      console.warn = warn
      console.error = error
      const why = lines.filter(Boolean).join('\n')
      const diagnosis = this.gpu === 'cuda' ? await cudaDiagnosis().catch(() => null) : null
      if (diagnosis) this.fallbackNote = `CUDA could not be started.\n${diagnosis}`
      throw new Error(`${GPU_LABEL[this.gpu]} could not be started: ${(err instanceof Error ? err.message : String(err)).replace(/\.$/, '')}.${diagnosis ? `\n${diagnosis}` : ''}${this.gpu === 'cpu' ? '' : '\nPick another GPU backend in Models (CPU works everywhere), then load the model again.'}${why ? `\n${why}` : ''}`)
    } finally {
      console.warn = warn
      console.error = error
    }
    this.fallbackNote = null
    if (this.gpu === 'auto' && this.llama.gpu !== 'cuda' && nvidiaDriver()) {
      const why = lines.filter((l) => /cuda/i.test(l)).join('\n')
      const diagnosis = await cudaDiagnosis().catch(() => null)
      this.fallbackNote = [`Auto skipped CUDA and is using ${this.llama.gpu === false ? 'the CPU' : this.llama.gpu}.`, diagnosis, why].filter(Boolean).join('\n')
    }
    return this.llama
  }

  getState(): ModelHostState {
    return { ...this.state }
  }

  get loadedId(): string | null {
    return this.loaded?.entry.id ?? null
  }

  get loadedConfig(): ModelConfig | null {
    return this.loaded?.config ?? null
  }

  get sequence(): LlamaContextSequence {
    if (!this.loaded) throw new Error('No model is loaded. Load one in Models first.')
    return this.loaded.sequence
  }

  get model(): LlamaModel {
    if (!this.loaded) throw new Error('No model is loaded. Load one in Models first.')
    return this.loaded.model
  }

  facts(wrapperName: string): ModelFacts | null {
    if (!this.loaded) return null
    const { model, sequence, context } = this.loaded
    return {
      wrapper: wrapperName,
      contextSize: context.contextSize,
      trainContextSize: model.trainContextSize,
      swaSize: model.fileInsights.swaSize ?? null,
      needsCheckpoints: sequence.needsCheckpoints,
      checkpointMemory: sequence.checkpointsMemoryUsage
    }
  }

  get isLoaded(): boolean {
    return this.loaded !== null
  }

  countTokens(text: string): number | null {
    return this.loaded ? this.loaded.model.tokenize(text, false, 'trimLeadingSpace').length : null
  }

  private setState(patch: Partial<ModelHostState>): void {
    this.state = { ...this.state, ...patch }
    this.emit('state', this.getState())
  }

  async load(entry: ModelEntry, config: ModelConfig): Promise<ModelHostState> {
    if (this.loading) await this.loading.catch(() => undefined)
    if (this.loaded?.entry.id === entry.id && this.state.status === 'ready') return this.getState()
    this.loading = this.doLoad(entry, config)
    try {
      await this.loading
    } finally {
      this.loading = null
    }
    return this.getState()
  }

  private async doLoad(entry: ModelEntry, config: ModelConfig): Promise<void> {
    await this.unload()
    this.setState({ status: 'loading', modelId: entry.id, progress: 0, contextSize: null, error: null })
    try {
      const llama = await this.startLlama()
      const model = await llama.loadModel({
        modelPath: entry.path,
        ...loadOptions(config),
        onLoadProgress: (progress) => {
          const now = Date.now()
          if (now - this.lastProgressEmit < 100 && progress < 1) return
          this.lastProgressEmit = now
          this.setState({ progress })
        }
      })
      let context: LlamaContext
      try {
        context = await model.createContext({ ...contextOptions(config), sequences: 1 })
      } catch (err) {
        await model.dispose()
        throw err
      }
      const sequence = context.getSequence(sequenceOptions(config))
      this.loaded = { entry, config, model, context, sequence }
      this.setState({ status: 'ready', progress: 1, contextSize: context.contextSize, error: null })
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const message = /too large for the available|insufficient memory|not enough (v)?ram/i.test(raw)
        ? `${raw}. Lower GPU layers to keep more of the model in RAM, or turn on Skip memory checks in this model's settings.`
        : raw
      this.loaded = null
      this.setState({ status: 'error', progress: 0, error: message })
      throw new Error(`Failed to load ${entry.name}: ${message}`)
    }
  }

  async unload(): Promise<ModelHostState> {
    const current = this.loaded
    if (!current) {
      if (this.state.status !== 'error') this.setState({ status: 'unloaded', modelId: null, progress: 0, contextSize: null })
      return this.getState()
    }
    this.emit('unloading', current.entry.id)
    this.loaded = null
    try {
      await current.context.dispose()
      await current.model.dispose()
    } finally {
      this.setState({ status: 'unloaded', modelId: null, progress: 0, contextSize: null, error: null })
    }
    return this.getState()
  }

  async vram(): Promise<{ used: number; total: number } | null> {
    if (!this.llama) return null
    try {
      const state = await this.llama.getVramState()
      return state.total > 0 ? { used: state.used, total: state.total } : null
    } catch {
      return null
    }
  }

  async dispose(): Promise<void> {
    await this.unload()
    await this.llama?.dispose()
    this.llama = null
  }
}
