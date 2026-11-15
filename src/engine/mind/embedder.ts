import { noteFailure } from '../util/report'
import type { MemoryServerStatus } from '@shared/types'
import { LlamaServer } from '../model/server/process'
import { llamaLimits, serverExe, serverLease, serverVersion } from '../model/server/install'
import { readHeader } from '../model/gguf/read'

export interface Embedding {
  model: string
  vector: Float32Array
}

const MAX_CHARS = 4000
const MAX_CONTEXT = 2048

let current: Embedder | null = null

export function memoryServer(): MemoryServerStatus {
  return current ? current.status() : { modelId: null, running: false, pid: null, error: null, log: [] }
}

export class Embedder {
  private modelId: string | null = null
  private path: string | null = null
  private server: LlamaServer | null = null
  private loading: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  error: string | null = null

  constructor() {
    current = this
  }

  status(): MemoryServerStatus {
    return { modelId: this.id, running: this.server !== null, pid: this.server?.pid ?? null, error: this.error, log: this.server?.log() ?? [] }
  }

  configure(modelId: string | null, path: string | null): void {
    if (modelId === this.modelId && path === this.path) return
    this.modelId = modelId
    this.path = path
    this.error = null
    void this.unload()
  }

  get id(): string | null {
    return this.path ? this.modelId : null
  }

  get loaded(): boolean {
    return this.server !== null
  }

  private async startServer(modelPath: string): Promise<void> {
    const exe = serverExe()
    const version = serverVersion()
    if (!exe || !version) throw new Error('llama-server is not set up yet. Install or pick a version in Models > llama-server.')
    const info = await readHeader(modelPath, { size: false }).catch((err: unknown) => (noteFailure(err, 'memory', "Could not read the embedding model's file header"), null))
    const size = String(Math.min(MAX_CONTEXT, info?.contextLength ?? MAX_CONTEXT))
    this.server = await LlamaServer.start({
      exe,
      version,
      modelPath,
      args: ['--embedding', '--no-webui', '-np', '1', '-ngl', '0', '--device', 'none', '-c', size, '-b', size, '-ub', size],
      signal: new AbortController().signal,
      limits: llamaLimits(),
      hold: () => serverLease(version, 'Memory search'),
      onExit: (message) => {
        this.error = message
        this.server = null
      }
    })
  }

  private async ensure(): Promise<void> {
    if (this.server || !this.path) return
    this.loading ??= (async () => {
      try {
        await this.startServer(this.path!)
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
        await this.unload()
        throw err
      } finally {
        this.loading = null
      }
    })()
    await this.loading
  }

  private async serverVector(text: string): Promise<number[]> {
    const server = this.server!
    const res = await fetch(`${server.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text })
    })
    if (!res.ok) throw new Error(`The embedding server answered ${res.status}: ${await res.text().catch(() => '')}`)
    const body = (await res.json()) as { data?: { embedding?: number[] }[] }
    const vector = body.data?.[0]?.embedding
    if (!vector) throw new Error('The embedding server sent no vector.')
    return vector
  }

  async embed(text: string): Promise<Embedding | null> {
    const modelId = this.id
    if (!modelId) return null
    const run = this.queue.then(async () => {
      await this.ensure()
      if (this.id !== modelId) return null
      const input = text.slice(0, MAX_CHARS)
      if (!this.server) return null
      return { model: modelId, vector: Float32Array.from(await this.serverVector(input)) }
    })
    this.queue = run.catch(() => undefined)
    try {
      return await run
    } catch (err) {
      noteFailure(err, 'memory', 'Could not embed text')
      return null
    }
  }

  async restartOnActive(): Promise<void> {
    if (this.server && this.server.version !== serverVersion()) await this.unload()
  }

  async unload(): Promise<void> {
    const server = this.server
    this.server = null
    await server?.stop().catch((err: unknown) => noteFailure(err, 'memory', 'Could not stop the embedding server'))
  }
}
