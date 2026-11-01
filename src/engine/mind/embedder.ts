import { getLlama, type LlamaEmbeddingContext, type LlamaModel } from 'node-llama-cpp'

export interface Embedding {
  model: string
  vector: Float32Array
}

const MAX_CHARS = 4000

export class Embedder {
  private modelId: string | null = null
  private path: string | null = null
  private model: LlamaModel | null = null
  private context: LlamaEmbeddingContext | null = null
  private loading: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  error: string | null = null

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
    return this.context !== null
  }

  private async ensure(): Promise<void> {
    if (this.context || !this.path) return
    this.loading ??= (async () => {
      try {
        const llama = await getLlama({ gpu: false })
        this.model = await llama.loadModel({ modelPath: this.path!, gpuLayers: 0 })
        this.context = await this.model.createEmbeddingContext({ contextSize: Math.min(2048, this.model.trainContextSize) })
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

  async embed(text: string): Promise<Embedding | null> {
    const modelId = this.id
    if (!modelId) return null
    const run = this.queue.then(async () => {
      await this.ensure()
      if (!this.context || this.id !== modelId) return null
      const result = await this.context.getEmbeddingFor(text.slice(0, MAX_CHARS))
      return { model: modelId, vector: Float32Array.from(result.vector) }
    })
    this.queue = run.catch(() => undefined)
    try {
      return await run
    } catch {
      return null
    }
  }

  async unload(): Promise<void> {
    const context = this.context
    const model = this.model
    this.context = null
    this.model = null
    await context?.dispose().catch(() => undefined)
    await model?.dispose().catch(() => undefined)
  }
}
