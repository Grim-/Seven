import { Texture } from 'pixi.js'

export type ImageSource = (id: string) => Promise<ImageBitmap | null>

interface Entry {
  users: number
  texture: Promise<Texture | null>
}

function free(texture: Texture | null): void {
  if (!texture) return
  const bitmap = texture.source.resource
  texture.destroy(true)
  if (bitmap instanceof ImageBitmap) bitmap.close()
}

export class AssetManager {
  private entries = new Map<string, Entry>()

  constructor(private source: ImageSource) {}

  use(id: string): Promise<Texture | null> {
    let entry = this.entries.get(id)
    if (!entry) {
      entry = { users: 0, texture: this.load(id) }
      this.entries.set(id, entry)
    }
    entry.users++
    return entry.texture
  }

  async useAll(ids: string[]): Promise<Map<string, Texture>> {
    const loaded = await Promise.all(ids.map(async (id) => [id, await this.use(id)] as const))
    return new Map(loaded.filter((pair): pair is readonly [string, Texture] => pair[1] !== null))
  }

  release(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.users--
    if (entry.users > 0) return
    this.entries.delete(id)
    void entry.texture.then(free)
  }

  releaseAll(ids: Iterable<string>): void {
    for (const id of ids) this.release(id)
  }

  destroy(): void {
    for (const entry of this.entries.values()) void entry.texture.then(free)
    this.entries.clear()
  }

  private async load(id: string): Promise<Texture | null> {
    const bitmap = await this.source(id).catch(() => null)
    if (!bitmap) return null
    const texture = Texture.from(bitmap)
    texture.source.scaleMode = 'nearest'
    return texture
  }
}
