import { memo, useEffect, useRef, useMemo } from 'react'
import type { TileLayerData, Tileset, MapData } from '@shared/maps'
import { useData, assetUrl } from '../../../store/data'
import { useLoadedImages } from '../../../lib/useLoadedImages'
import { registerLayerType } from '../layerTypes'
import { paintTiles } from '../../../game/map/paintTiles'

const ID_MASK = 0x1fffffff
const CHUNK_SIZE = 16 // 16x16 tiles per chunk

function tilesetFor(sets: Tileset[], id: number): Tileset | undefined {
  let found: Tileset | undefined
  for (const t of sets) if (t.first <= id && (!found || t.first > found.first)) found = t
  return found
}

interface ChunkCanvasProps {
  chunkX: number
  chunkY: number
  layer: TileLayerData
  map: MapData
  images: Record<string, HTMLImageElement>
  urls: Record<string, string>
}

const ChunkCanvas = memo(
  function ChunkCanvas({ chunkX, chunkY, layer, map, images, urls }: ChunkCanvasProps) {
    const canvas = useRef<HTMLCanvasElement>(null)
    const prevKey = useRef<string>('')

    const tileW = map.tile.w
    const tileH = map.tile.h
    const startCol = chunkX * CHUNK_SIZE
    const startRow = chunkY * CHUNK_SIZE
    const endCol = Math.min(layer.columns, startCol + CHUNK_SIZE)
    const endRow = Math.min(layer.rows, startRow + CHUNK_SIZE)
    const chunkCols = endCol - startCol
    const chunkRows = endRow - startRow

    const pixelW = chunkCols * tileW
    const pixelH = chunkRows * tileH

    // Build a quick key of this chunk's tiles + images to avoid any redraw if unchanged
    const imageKey = Object.keys(images).sort().join(',')
    const currentKey = useMemo(() => {
      let hash = 0
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const gid = layer.tiles[r * layer.columns + c] || 0
          hash = ((hash << 5) - hash + gid) | 0
        }
      }
      return `${hash}:${layer.opacity}:${imageKey}`
    }, [layer.tiles, layer.opacity, startCol, startRow, endCol, endRow, layer.columns, imageKey])

    useEffect(() => {
      if (prevKey.current === currentKey && canvas.current) return

      const g = canvas.current?.getContext('2d')
      if (!g) return

      let skippedAnyImage = false

      g.clearRect(0, 0, pixelW, pixelH)
      g.imageSmoothingEnabled = false

      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const gid = layer.tiles[r * layer.columns + c]
          if (!gid) continue

          const id = gid & ID_MASK
          const set = tilesetFor(map.tilesets, id)
          const img = set && images[urls[set.id]]
          if (!set || !img) {
            if (set && !img) skippedAnyImage = true
            continue
          }

          const local = id - set.first
          const sx = set.margin + (local % set.columns) * (set.tile.w + set.spacing)
          const sy = set.margin + Math.floor(local / set.columns) * (set.tile.h + set.spacing)
          const localX = (c - startCol) * tileW
          const localY = (r - startRow) * tileH + tileH - set.tile.h

          // Check if flips/rotation flags exist
          const hasTransform = gid > ID_MASK
          if (!hasTransform) {
            g.drawImage(img, sx, sy, set.tile.w, set.tile.h, localX, localY, set.tile.w, set.tile.h)
          } else {
            g.save()
            g.translate(localX + set.tile.w / 2, localY + set.tile.h / 2)
            g.scale((gid >>> 31) & 1 ? -1 : 1, (gid >>> 30) & 1 ? -1 : 1)
            if ((gid >>> 29) & 1) {
              g.rotate(Math.PI / 2)
              g.scale(1, -1)
            }
            g.drawImage(img, sx, sy, set.tile.w, set.tile.h, -set.tile.w / 2, -set.tile.h / 2, set.tile.w, set.tile.h)
            g.restore()
          }
        }
      }

      if (!skippedAnyImage) {
        prevKey.current = currentKey
      }
    }, [currentKey, pixelW, pixelH, startRow, endRow, startCol, endCol, layer.tiles, map.tilesets, tileW, tileH, images, urls])

    return (
      <canvas
        ref={canvas}
        width={pixelW}
        height={pixelH}
        className="block [image-rendering:pixelated]"
        style={{
          position: 'absolute',
          left: startCol * tileW,
          top: startRow * tileH,
          width: pixelW,
          height: pixelH,
          contain: 'strict'
        }}
      />
    )
  },
  (prev, next) => {
    return (
      prev.chunkX === next.chunkX &&
      prev.chunkY === next.chunkY &&
      prev.layer === next.layer &&
      prev.map === next.map &&
      prev.images === next.images
    )
  }
)

export function TileLayer({ layer, map }: { layer: TileLayerData; map: MapData }) {
  const assets = useData((s) => s.assets)
  const urls = Object.fromEntries(
    map.tilesets.flatMap((t) => {
      const a = assets.find((x) => x.id === t.image)
      return a ? [[t.id, assetUrl(a)]] : []
    })
  )
  const images = useLoadedImages(Object.values(urls))

  const tileW = map.tile.w || 32
  const tileH = map.tile.h || 32
  const width = layer.columns * tileW
  const height = layer.rows * tileH

  const chunkCols = Math.ceil(layer.columns / CHUNK_SIZE)
  const chunkRows = Math.ceil(layer.rows / CHUNK_SIZE)

  const chunks = useMemo(() => {
    const list: Array<{ cx: number; cy: number; key: string }> = []
    for (let cy = 0; cy < chunkRows; cy++) {
      for (let cx = 0; cx < chunkCols; cx++) {
        list.push({ cx, cy, key: `${cx}_${cy}` })
      }
    }
    return list
  }, [chunkCols, chunkRows])

  return (
    <div
      className="relative pointer-events-none"
      style={{ width, height, contain: 'layout' }}
    >
      {chunks.map(({ cx, cy, key }) => (
        <ChunkCanvas
          key={key}
          chunkX={cx}
          chunkY={cy}
          layer={layer}
          map={map}
          images={images}
          urls={urls}
        />
      ))}
    </div>
  )
}

registerLayerType('tiles', { tag: 'Tiles', Layer: TileLayer, paint: paintTiles })
