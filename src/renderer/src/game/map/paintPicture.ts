import { Container, Sprite } from 'pixi.js'
import type { LayerBase, PictureLayer } from '@shared/maps'
import type { PaintContext } from './paint'

export function paintPicture(layer: LayerBase & PictureLayer, ctx: PaintContext): Container {
  const root = new Container()
  const texture = ctx.textures.get(layer.image)
  if (!texture) return root
  const w = layer.size.w * layer.scale
  const h = layer.size.h * layer.scale
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5)
  sprite.width = w
  sprite.height = h
  sprite.position.set(w / 2, h / 2)
  sprite.angle = layer.rotation
  sprite.cullable = true
  root.addChild(sprite)
  return root
}
