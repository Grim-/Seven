import { Container, Sprite } from 'pixi.js'
import type { TileLayerData } from '@shared/maps'
import type { PaintContext } from './paint'

export const CHUNK = 32
const FLIP_H = 0x80000000
const FLIP_V = 0x40000000
const DIAGONAL = 0x20000000

export function paintTiles(layer: TileLayerData, ctx: PaintContext): Container {
  const root = new Container()
  const { tile } = ctx.map
  const chunks = new Map<number, Container>()
  const chunkOf = (col: number, row: number): Container => {
    const key = Math.floor(row / CHUNK) * 100000 + Math.floor(col / CHUNK)
    let chunk = chunks.get(key)
    if (!chunk) {
      chunk = new Container()
      chunk.cullable = true
      chunks.set(key, chunk)
      root.addChild(chunk)
    }
    return chunk
  }
  layer.tiles.forEach((gid, i) => {
    if (!gid) return
    const texture = ctx.tile(gid)
    if (!texture) return
    const col = i % layer.columns
    const row = Math.floor(i / layer.columns)
    const fh = gid & FLIP_H ? -1 : 1
    const fv = gid & FLIP_V ? -1 : 1
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(col * tile.w + texture.width / 2, row * tile.h + tile.h - texture.height / 2)
    if (gid & DIAGONAL) {
      sprite.rotation = Math.PI / 2
      sprite.scale.set(fv, -fh)
    } else sprite.scale.set(fh, fv)
    chunkOf(col, row).addChild(sprite)
  })
  for (const chunk of chunks.values()) chunk.cacheAsTexture({ scaleMode: 'nearest', resolution: 1, antialias: false })
  return root
}
