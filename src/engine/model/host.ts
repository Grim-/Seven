import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import type { ChatServerStatus, ModelConfig, ModelEntry, ModelFacts, ModelHostState, ServerInfo, ServerInstallProgress } from '@shared/types'
import { readBytes, removePath, writeBytes, writeUserFile } from '../util/fs'
import { serverArgs, templateFile, type ServerModel } from './params'
import { LlamaServer } from './server/process'
import { installServer, installed, serverExe } from './server/install'
import type { ApiTarget } from './apiChat'

function smiMemory(): Promise<{ used: number; total: number } | null> {
  return new Promise((resolve) => {
    execFile('nvidia-smi', ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'], { windowsHide: true }, (err, stdout) => {
      const [used, total] = err ? [] : stdout.split(/\r?\n/)[0].split(',').map((v) => Number(v.trim()) * 1024 * 1024)
      resolve(Number.isFinite(used) && Number.isFinite(total) && total > 0 ? { used, total } : null)
    })
  })
}

interface Served {
  entry: ModelEntry
  config: ModelConfig
  server: LlamaServer
}

export class ModelHost extends EventEmitter {
  private served: Served | null = null
  private starting: AbortController | null = null
  private loading: Promise<void> | null = null
  private state: ModelHostState = { status: 'unloaded', modelId: null, progress: 0, contextSize: null, error: null }

  constructor(private serverModel: (entry: ModelEntry) => ServerModel) {
    super()
  }

  serverInfo(): ServerInfo {
    return { installed: installed()?.tag ?? null }
  }

  async installServer(onProgress: (p: ServerInstallProgress) => void): Promise<ServerInfo> {
    if (this.loading) await this.loading.catch(() => undefined)
    await this.unload()
    await installServer(new AbortController().signal, onProgress)
    return this.serverInfo()
  }

  serverTarget(): ApiTarget {
    const s = this.served
    if (!s) throw new Error('No model is loaded. Load one in Models first.')
    return {
      id: s.entry.id,
      spec: { api: 'openai', baseUrl: s.server.baseUrl, model: s.entry.name, hasKey: true },
      key: s.server.key,
      contextSize: s.server.contextSize,
      local: true,
      vision: s.server.args.includes('--mmproj'),
      keepThinking: s.server.args.includes('--reasoning-preserve'),
      onTimings: (timings) => {
        s.server.timings = timings
      }
    }
  }

  needsRestart(config: ModelConfig): boolean {
    const s = this.served
    return s !== null && serverArgs(config, this.serverModel(s.entry)).join('\u0000') !== s.server.args.join('\u0000')
  }

  async saveState(file: string): Promise<void> {
    if (!this.served) return
    const { server } = this.served
    const name = `state-${Date.now().toString(36)}.bin`
    const temp = path.join(server.slotDir, name)
    try {
      await server.slot('save', name)
      writeBytes(file, fs.readFileSync(temp))
    } finally {
      removePath(temp)
    }
  }

  async loadState(file: string): Promise<void> {
    if (!this.served) return
    const { server } = this.served
    const name = `state-${Date.now().toString(36)}.bin`
    const temp = path.join(server.slotDir, name)
    try {
      writeUserFile(temp, readBytes(file))
      await server.slot('restore', name)
    } finally {
      removePath(temp)
    }
  }

  async clearContext(): Promise<void> {
    await this.served?.server.erase()
  }

  get contextSize(): number | null {
    return this.served?.server.contextSize || null
  }

  get gpuLayers(): number | null {
    const offload = this.served?.server.offload
    if (offload) return offload.gpu
    const n = Number(this.served?.config.gpuLayers)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  getState(): ModelHostState {
    return { ...this.state }
  }

  get loadedId(): string | null {
    return this.served?.entry.id ?? null
  }

  get loadedConfig(): ModelConfig | null {
    return this.served?.config ?? null
  }

  get isLoaded(): boolean {
    return this.served !== null
  }

  facts(): ModelFacts | null {
    if (!this.served) return null
    const { server } = this.served
    return {
      server: { tag: installed()?.tag ?? null, mtp: server.args.some((a) => a.split(',').includes('draft-mtp')), vision: server.args.includes('--mmproj'), device: server.device, offload: server.offload, last: server.timings },
      wrapper: 'llama-server',
      contextSize: server.contextSize,
      trainContextSize: server.trainContextSize ?? 0,
      swaSize: null,
      needsCheckpoints: false,
      checkpointMemory: 0
    }
  }

  private setState(patch: Partial<ModelHostState>): void {
    this.state = { ...this.state, ...patch }
    this.emit('state', this.getState())
  }

  async load(entry: ModelEntry, config: ModelConfig): Promise<ModelHostState> {
    if (this.loading) await this.loading.catch(() => undefined)
    if (this.served?.entry.id === entry.id && this.state.status === 'ready' && !this.needsRestart(config)) return this.getState()
    this.loading = this.serve(entry, config)
    try {
      await this.loading
    } finally {
      this.loading = null
    }
    return this.getState()
  }

  private async serve(entry: ModelEntry, config: ModelConfig): Promise<void> {
    await this.unload()
    this.setState({ status: 'loading', modelId: entry.id, progress: 0, contextSize: null, error: null })
    const controller = new AbortController()
    this.starting = controller
    try {
      const exe = serverExe()
      if (!exe) throw new Error('llama-server is not installed yet. Install it in Models, then load the model again.')
      const model = this.serverModel(entry)
      if (model.template) writeUserFile(templateFile(model.template), model.template)
      const server = await LlamaServer.start({
        exe,
        modelPath: entry.path,
        args: serverArgs(config, model),
        signal: controller.signal,
        onExit: (message) => {
          if (this.served?.server !== server) return
          this.emit('unloading', entry.id)
          this.served = null
          this.setState({ status: 'error', modelId: null, progress: 0, contextSize: null, error: message })
        }
      })
      this.served = { entry, config, server }
      this.setState({ status: 'ready', progress: 1, contextSize: server.contextSize || null, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.served = null
      if (controller.signal.aborted) {
        this.setState({ status: 'unloaded', modelId: null, progress: 0, contextSize: null, error: null })
        throw new Error(`Loading ${entry.name} was cancelled`)
      }
      this.setState({ status: 'error', progress: 0, error: message })
      throw new Error(`Failed to load ${entry.name}: ${message}`)
    } finally {
      if (this.starting === controller) this.starting = null
    }
  }

  async unload(): Promise<ModelHostState> {
    this.starting?.abort()
    const served = this.served
    if (!served) {
      if (this.state.status !== 'error' && this.state.status !== 'loading') this.setState({ status: 'unloaded', modelId: null, progress: 0, contextSize: null })
      return this.getState()
    }
    this.emit('unloading', served.entry.id)
    this.served = null
    try {
      await served.server.stop()
    } finally {
      this.setState({ status: 'unloaded', modelId: null, progress: 0, contextSize: null, error: null })
    }
    return this.getState()
  }

  async processing(): Promise<boolean> {
    return (await this.served?.server.processing().catch(() => false)) ?? false
  }

  async chatServer(): Promise<ChatServerStatus | null> {
    const s = this.served
    if (!s) return null
    return {
      modelId: s.entry.id,
      modelName: s.entry.name,
      pid: s.server.pid,
      startedAt: s.server.startedAt,
      args: s.server.args,
      contextSize: s.server.contextSize,
      device: s.server.device,
      offload: s.server.offload,
      mtp: s.server.args.some((a) => a.split(',').includes('draft-mtp')),
      vision: s.server.args.includes('--mmproj'),
      last: s.server.timings,
      writing: await this.processing(),
      log: s.server.log()
    }
  }

  vram(): Promise<{ used: number; total: number } | null> {
    return smiMemory()
  }

  async dispose(): Promise<void> {
    await this.unload()
  }
}
