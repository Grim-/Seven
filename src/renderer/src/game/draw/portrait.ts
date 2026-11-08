import { Rectangle, Texture } from 'pixi.js'

export function squareCrop(texture: Texture): Texture {
  const side = Math.min(texture.width, texture.height)
  return new Texture({ source: texture.source, frame: new Rectangle((texture.width - side) / 2, (texture.height - side) / 2, side, side) })
}
