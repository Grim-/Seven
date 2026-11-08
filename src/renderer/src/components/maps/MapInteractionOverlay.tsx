import { useState, useRef, useEffect, type PointerEvent } from 'react'
import type { MapData, TileLayerData } from '@shared/maps'
import type { Point } from '@shared/shapes'
import type { MapTool } from './OverlayToolbar'

interface MapInteractionOverlayProps {
  map: MapData
  tool: MapTool
  activeTileLayer: TileLayerData | null
  selectedGid: number
  brushSize: number
  zoom?: number
  onPaintTiles: (layerId: string, tiles: number[]) => void
  onAddShape: (start: Point, end: Point) => void
  onPlaceObject: (at: Point) => void
}

export function MapInteractionOverlay({
  map,
  tool,
  activeTileLayer,
  selectedGid,
  brushSize,
  zoom = 1,
  onPaintTiles,
  onAddShape,
  onPlaceObject
}: MapInteractionOverlayProps) {
  const [hoverTile, setHoverTile] = useState<{ col: number; row: number } | null>(null)
  const isPainting = useRef(false)
  // Sparse map of index -> new Gid for the active stroke (NO 65k array allocations on mousedown)
  const strokeChanges = useRef<Map<number, number>>(new Map())
  const previewCanvas = useRef<HTMLCanvasElement>(null)

  const shapeStart = useRef<Point | null>(null)
  const [currentShapeEnd, setCurrentShapeEnd] = useState<Point | null>(null)

  const tileW = map.tile.w || 32
  const tileH = map.tile.h || 32

  useEffect(() => {
    strokeChanges.current.clear()
    isPainting.current = false
  }, [activeTileLayer?.id, tool])

  if (tool === 'select') return null

  const getTileCoords = (e: PointerEvent): { col: number; row: number; point: Point } => {
    const rect = e.currentTarget.getBoundingClientRect()
    const activeZoom = zoom > 0 ? zoom : (rect.width > 0 ? rect.width / map.size.w : 1)
    const x = (e.clientX - rect.left) / activeZoom
    const y = (e.clientY - rect.top) / activeZoom
    const col = Math.floor(x / tileW)
    const row = Math.floor(y / tileH)
    return { col, row, point: { x, y } }
  }

  const stampIntoWorkingBuffer = (centerCol: number, centerRow: number) => {
    if (!activeTileLayer) return
    const { columns, rows, tiles } = activeTileLayer

    const gidToStamp = tool === 'erase' ? 0 : selectedGid
    const offset = Math.floor(brushSize / 2)
    const pCtx = previewCanvas.current?.getContext('2d')

    for (let dy = 0; dy < brushSize; dy++) {
      for (let dx = 0; dx < brushSize; dx++) {
        const c = centerCol - offset + dx
        const r = centerRow - offset + dy
        if (c >= 0 && c < columns && r >= 0 && r < rows) {
          const idx = r * columns + c
          const currentVal = strokeChanges.current.has(idx)
            ? strokeChanges.current.get(idx)
            : tiles[idx]

          if (currentVal !== gidToStamp) {
            strokeChanges.current.set(idx, gidToStamp)

            // Draw instant local stroke feedback on preview canvas
            if (pCtx) {
              pCtx.fillStyle = tool === 'erase' ? 'rgba(0,0,0,0.8)' : 'rgba(102, 252, 241, 0.45)'
              pCtx.fillRect(c * tileW, r * tileH, tileW, tileH)
            }
          }
        }
      }
    }
  }

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { col, row, point } = getTileCoords(e)

    if (tool === 'paint' || tool === 'erase') {
      isPainting.current = true
      strokeChanges.current.clear()

      // Clear preview canvas
      const pCtx = previewCanvas.current?.getContext('2d')
      if (pCtx) pCtx.clearRect(0, 0, map.size.w, map.size.h)

      stampIntoWorkingBuffer(col, row)
    } else if (tool === 'shape') {
      shapeStart.current = point
      setCurrentShapeEnd(point)
    } else if (tool === 'object') {
      onPlaceObject(point)
    }
  }

  const handlePointerMove = (e: PointerEvent) => {
    const { col, row, point } = getTileCoords(e)
    setHoverTile({ col, row })

    if (isPainting.current && (tool === 'paint' || tool === 'erase')) {
      stampIntoWorkingBuffer(col, row)
    } else if (shapeStart.current && tool === 'shape') {
      setCurrentShapeEnd(point)
    }
  }

  const handlePointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return

    if (isPainting.current) {
      isPainting.current = false
      // Commit stroke if any tiles changed
      if (strokeChanges.current.size > 0 && activeTileLayer) {
        const nextTiles = activeTileLayer.tiles.slice()
        for (const [idx, gid] of strokeChanges.current.entries()) {
          nextTiles[idx] = gid
        }
        onPaintTiles(activeTileLayer.id, nextTiles)
      }
      strokeChanges.current.clear()

      // Clear preview canvas
      const pCtx = previewCanvas.current?.getContext('2d')
      if (pCtx) pCtx.clearRect(0, 0, map.size.w, map.size.h)
    }

    if (shapeStart.current && currentShapeEnd && tool === 'shape') {
      const start = shapeStart.current
      const end = currentShapeEnd
      shapeStart.current = null
      setCurrentShapeEnd(null)
      const w = Math.abs(end.x - start.x)
      const h = Math.abs(end.y - start.y)
      if (w > 10 && h > 10) {
        onAddShape(
          { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
          { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) }
        )
      }
    }
  }

  const handlePointerLeave = () => {
    setHoverTile(null)
  }

  // Calculate box preview for zone/shape drawing
  const shapeBox =
    shapeStart.current && currentShapeEnd
      ? {
          x: Math.min(shapeStart.current.x, currentShapeEnd.x),
          y: Math.min(shapeStart.current.y, currentShapeEnd.y),
          w: Math.abs(currentShapeEnd.x - shapeStart.current.x),
          h: Math.abs(currentShapeEnd.y - shapeStart.current.y)
        }
      : null

  const offset = Math.floor(brushSize / 2)

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className="absolute inset-0 z-10 cursor-crosshair select-none touch-none"
      style={{ width: map.size.w, height: map.size.h }}
    >
      {/* High-speed preview canvas for paint strokes */}
      <canvas
        ref={previewCanvas}
        width={map.size.w}
        height={map.size.h}
        className="pointer-events-none absolute inset-0 [image-rendering:pixelated]"
      />

      {/* Hover Brush Indicator */}
      {hoverTile && (tool === 'paint' || tool === 'erase') && (
        <div
          className="pointer-events-none absolute border"
          style={{
            left: (hoverTile.col - offset) * tileW,
            top: (hoverTile.row - offset) * tileH,
            width: brushSize * tileW,
            height: brushSize * tileH,
            borderColor: tool === 'erase' ? 'rgba(255, 74, 110, 0.9)' : 'rgba(102, 252, 241, 0.9)',
            backgroundColor:
              tool === 'erase' ? 'rgba(255, 74, 110, 0.2)' : 'rgba(102, 252, 241, 0.2)'
          }}
        />
      )}

      {/* Box Drag Indicator */}
      {shapeBox && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/15"
          style={{
            left: shapeBox.x,
            top: shapeBox.y,
            width: shapeBox.w,
            height: shapeBox.h
          }}
        >
          <span className="absolute -top-5 left-0 bg-black/90 px-1 font-mono text-[10px] text-accent">
            {Math.round(shapeBox.w)} × {Math.round(shapeBox.h)}
          </span>
        </div>
      )}
    </div>
  )
}
