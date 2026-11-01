import { useEffect, useRef } from 'react'
import type { TileLayerData, Tileset, MapData } from '@shared/maps'
import { useData, assetUrl } from '../../../store/data'
import { useLoadedImages } from '../../../lib/useLoadedImages'
import { registerLayerType } from '../layerTypes'

const ID_MASK = 0x1fffffff

function tilesetFor(sets: Tileset[], id: number): Tileset | undefined {
  let found: Tileset | undefined
  for (const t of sets) if (t.first <= id && (!found || t.first > found.first)) found = t
  return found
}

export function TileLayer({ layer, map }: { layer: TileLayerData; map: MapData }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const assets = useData((s) => s.assets)
  const urls = Object.fromEntries(map.tilesets.flatMap((t) => {
    const a = assets.find((x) => x.id === t.image)
    return a ? [[t.id, assetUrl(a)]] : []
  }))
  const images = useLoadedImages(Object.values(urls))
  const width = layer.columns * map.tile.w
  const height = layer.rows * map.tile.h

  useEffect(() => {
    const g = canvas.current?.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, width, height)
    g.imageSmoothingEnabled = false
    layer.tiles.forEach((gid, i) => {
      if (!gid) return
      const id = gid & ID_MASK
      const set = tilesetFor(map.tilesets, id)
      const img = set && images[urls[set.id]]
      if (!set || !img) return
      const local = id - set.first
      const sx = set.margin + (local % set.columns) * (set.tile.w + set.spacing)
      const sy = set.margin + Math.floor(local / set.columns) * (set.tile.h + set.spacing)
      const x = (i % layer.columns) * map.tile.w
      const y = Math.floor(i / layer.columns) * map.tile.h + map.tile.h - set.tile.h
      g.save()
      g.translate(x + set.tile.w / 2, y + set.tile.h / 2)
      g.scale((gid >>> 31) & 1 ? -1 : 1, (gid >>> 30) & 1 ? -1 : 1)
      if ((gid >>> 29) & 1) {
        g.rotate(Math.PI / 2)
        g.scale(1, -1)
      }
      g.drawImage(img, sx, sy, set.tile.w, set.tile.h, -set.tile.w / 2, -set.tile.h / 2, set.tile.w, set.tile.h)
      g.restore()
    })
  }, [layer, map.tilesets, map.tile, images])

  return <canvas ref={canvas} width={width} height={height} className="block [image-rendering:pixelated]" />
}

registerLayerType('tiles', { tag: 'Tiles', Layer: TileLayer })
