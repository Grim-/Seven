import { useState, useRef, useEffect, type MouseEvent } from 'react'
import { Images, ImagePlus, Check } from 'lucide-react'
import { Button, Modal, Segmented } from '../ui'
import { pickPicture } from '../data/PicturePicker'
import { choosePictures } from '../../lib/importFiles'
import { readImage } from '../../lib/assetSource'

export interface TilePickResult {
  assetId: string
  col: number
  row: number
  tileW: number
  tileH: number
  gid?: number
  croppedDataUrl: string
}

interface TilePickerProps {
  open: boolean
  onClose: () => void
  onPick: (result: TilePickResult) => void
  initialAssetId?: string
  initialTileW?: number
  initialTileH?: number
}

const TILE_SIZES = [
  { value: '16', label: '16px' },
  { value: '24', label: '24px' },
  { value: '32', label: '32px' },
  { value: '48', label: '48px' },
  { value: '64', label: '64px' }
]

export function TilePicker({
  open,
  onClose,
  onPick,
  initialAssetId = '',
  initialTileW = 32,
  initialTileH = 32
}: TilePickerProps) {
  const [assetId, setAssetId] = useState<string>(initialAssetId)
  const [tileW, setTileW] = useState<number>(initialTileW)
  const [tileH, setTileH] = useState<number>(initialTileH)
  const [hoverTile, setHoverTile] = useState<{ col: number; row: number } | null>(null)
  const [selectedTile, setSelectedTile] = useState<{ col: number; row: number } | null>(null)
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null)
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Load image whenever assetId changes
  useEffect(() => {
    if (!assetId) {
      setImageBitmap(null)
      return
    }
    let active = true
    void readImage(assetId)
      .then((bmp) => {
        if (active) setImageBitmap(bmp)
      })
      .catch(() => {
        if (active) setImageBitmap(null)
      })
    return () => {
      active = false
    }
  }, [assetId])

  // Extract cropped tile preview when selection changes
  useEffect(() => {
    if (!imageBitmap || !selectedTile) {
      setCroppedPreview(null)
      return
    }
    const offscreen = document.createElement('canvas')
    offscreen.width = tileW
    offscreen.height = tileH
    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    const sx = selectedTile.col * tileW
    const sy = selectedTile.row * tileH
    ctx.drawImage(imageBitmap, sx, sy, tileW, tileH, 0, 0, tileW, tileH)
    setCroppedPreview(offscreen.toDataURL('image/png'))
  }, [imageBitmap, selectedTile, tileW, tileH])

  // Draw tilesheet and grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageBitmap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = imageBitmap.width
    canvas.height = imageBitmap.height

    // 1. Draw base tilesheet
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imageBitmap, 0, 0)

    // 2. Draw subtle grid overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    for (let x = 0; x <= canvas.width; x += tileW) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y <= canvas.height; y += tileH) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(canvas.width, y + 0.5)
      ctx.stroke()
    }

    // 3. Draw hover tile outline
    if (hoverTile) {
      ctx.strokeStyle = 'rgba(102, 252, 241, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(hoverTile.col * tileW + 1, hoverTile.row * tileH + 1, tileW - 2, tileH - 2)
    }

    // 4. Draw selected tile outline
    if (selectedTile) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2
      ctx.strokeRect(selectedTile.col * tileW + 1, selectedTile.row * tileH + 1, tileW - 2, tileH - 2)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)'
      ctx.fillRect(selectedTile.col * tileW + 1, selectedTile.row * tileH + 1, tileW - 2, tileH - 2)
    }
  }, [imageBitmap, tileW, tileH, hoverTile, selectedTile])

  if (!open) return null

  const handleCanvasMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !imageBitmap) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const col = Math.floor(x / tileW)
    const row = Math.floor(y / tileH)
    const maxCols = Math.floor(canvas.width / tileW)
    const maxRows = Math.floor(canvas.height / tileH)

    if (col >= 0 && col < maxCols && row >= 0 && row < maxRows) {
      setHoverTile({ col, row })
    } else {
      setHoverTile(null)
    }
  }

  const handleCanvasClick = () => {
    if (hoverTile) {
      setSelectedTile(hoverTile)
    }
  }

  const handlePickSevenAsset = async () => {
    const res = await pickPicture(assetId || null, { what: 'a tilesheet' })
    if (res?.id) {
      setAssetId(res.id)
      setSelectedTile(null)
    }
  }

  const handlePickDiskFile = async () => {
    const [added] = await choosePictures(['image'], false, 'a tilesheet')
    if (added?.id) {
      setAssetId(added.id)
      setSelectedTile(null)
    }
  }

  const handleConfirm = () => {
    if (!selectedTile || !croppedPreview) return
    const cols = imageBitmap ? Math.floor(imageBitmap.width / tileW) : 1
    const gid = selectedTile.row * cols + selectedTile.col + 1

    onPick({
      assetId,
      col: selectedTile.col,
      row: selectedTile.row,
      tileW,
      tileH,
      gid,
      croppedDataUrl: croppedPreview
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="SELECT TILE FROM TILESHEET" wide>
      <div className="flex flex-col gap-3 font-mono text-[12px] select-none p-1">
        {/* Top Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Images className="h-3.5 w-3.5" />} onClick={handlePickSevenAsset}>
              Tilesheet from Seven
            </Button>
            <Button size="sm" variant="secondary" icon={<ImagePlus className="h-3.5 w-3.5" />} onClick={() => void handlePickDiskFile()}>
              Tilesheet from Disk...
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-dim font-bold">Tile Grid:</span>
            <Segmented
              value={String(tileW)}
              options={TILE_SIZES}
              onChange={(val) => {
                const n = Number(val)
                setTileW(n)
                setTileH(n)
                setSelectedTile(null)
              }}
            />
          </div>
        </div>

        {/* Tilesheet Canvas Viewport */}
        <div className="relative flex h-[420px] w-full flex-col items-center justify-center overflow-auto border border-line/60 bg-black/90 p-4">
          {!assetId ? (
            <div className="flex flex-col items-center gap-2 text-dim text-[11px]">
              <span>No tilesheet selected.</span>
              <span className="text-faint text-[10px]">Select a tilesheet image above to pick a tile sprite.</span>
            </div>
          ) : !imageBitmap ? (
            <span className="text-faint text-[11px]">Loading tilesheet...</span>
          ) : (
            <div className="relative inline-block cursor-crosshair border border-line/40 [image-rendering:pixelated]">
              <canvas
                ref={canvasRef}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setHoverTile(null)}
                onClick={handleCanvasClick}
                className="max-h-full max-w-full block"
              />
            </div>
          )}
        </div>

        {/* Footer: Selection Readout & Confirm */}
        <div className="flex items-center justify-between border-t border-line pt-2.5">
          <div className="flex items-center gap-3">
            {croppedPreview && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-accent bg-black p-0.5">
                <img src={croppedPreview} alt="Selected tile" className="h-full w-full object-contain [image-rendering:pixelated]" />
              </div>
            )}
            <div className="flex flex-col">
              {selectedTile ? (
                <span className="text-[11px] font-bold text-accent">
                  Tile: Col {selectedTile.col}, Row {selectedTile.row} · {tileW}×{tileH}px
                </span>
              ) : (
                <span className="text-[11px] text-faint">Click any tile in the grid to select.</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Check className="h-3.5 w-3.5" />}
              disabled={!selectedTile || !croppedPreview}
              onClick={handleConfirm}
            >
              Use This Tile
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
