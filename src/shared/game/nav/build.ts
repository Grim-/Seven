import { placedKey } from '../../effects'
import { mapArea, mapObjects, resolveObjectState, type MapData } from '../../maps'
import type { Point } from '../../shapes'
import { NavGrid } from './grid'

/** Builds a navigation grid from a map, marking visible solid placed objects as blocked. */
export function buildNavGrid(map: MapData, thingFlags: Record<string, Record<string, string | number | boolean>> = {}): NavGrid {
  const grid = NavGrid.covering(mapArea(map), map.tile)
  const tileW = Math.max(1, map.tile.w)
  const tileH = Math.max(1, map.tile.h)
  for (const obj of mapObjects(map.layers)) {
    const flags = thingFlags[placedKey({ map: map.id, id: obj.id })] ?? {}
    const state = resolveObjectState(obj, flags)
    if (!state.visible || state.collision !== 'solid') continue
    const w = Math.max(1, obj.size.w * (obj.scale || 1))
    const h = Math.max(1, obj.size.h * (obj.scale || 1))
    const minC = Math.floor((obj.offset.x - w / 2) / tileW)
    const maxC = Math.floor((obj.offset.x + w / 2) / tileW)
    const minR = Math.floor((obj.offset.y - h / 2) / tileH)
    const maxR = Math.floor((obj.offset.y + h / 2) / tileH)
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        grid.block(c, r, true)
      }
    }
  }
  return grid
}

/** Converts Euclidean pixel distance between two map points to in-world feet. */
export function pointsDistanceFeet(a: Point, b: Point, tileWidth: number, tileFeet: number): number {
  return (Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, tileWidth)) * Math.max(1, tileFeet)
}
