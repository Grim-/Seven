import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'

export type ImageViewFitMode = 'fit' | 'actual' | 'fill' | 'custom'

export interface ZoomableImageViewportProps {
  /** Unique key (e.g. asset.id) so switching images cleanly resets view to Fit. */
  imageKey: string
  src: string
  alt: string
  /** Disable left-click pan while an overlay tool (like area marking) is active. */
  suspendPan?: boolean
  /** Optional wrapper around the `<img>` inside the transformed coordinate plane (e.g. ShapeEditor). */
  wrapImage?: (img: ReactNode, naturalSize: { w: number; h: number } | null) => ReactNode
  onDimensions?: (dims: { w: number; h: number }) => void
  /** Extra right offset in px for the bottom-right zoom HUD (e.g. when a floating overlay drawer is open). */
  hudRightOffsetPx?: number
  /** Extra controls appended to the bottom-right HUD bar. */
  hudExtra?: ReactNode
  /** Click handler on empty background (e.g. lightbox backdrop click-to-close). */
  onBackdropClick?: () => void
  className?: string
}

const MIN_ZOOM = 0.05
const MAX_ZOOM = 16

/**
 * Full-bleed pan & zoom image canvas built for extreme dimensions and unusual aspect ratios
 * (panoramas, tall vertical strips, 4K+ maps, and tiny pixel-art sprites).
 */
export function ZoomableImageViewport({
  imageKey,
  src,
  alt,
  suspendPan = false,
  wrapImage,
  onDimensions,
  hudRightOffsetPx = 12,
  hudExtra,
  onBackdropClick,
  className
}: ZoomableImageViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [viewSize, setViewSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [mode, setMode] = useState<ImageViewFitMode>('fit')
  const [cam, setCam] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 })
  const [panning, setPanning] = useState(false)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  const computeFit = useCallback(
    (nat: { w: number; h: number }, vp: { w: number; h: number }, targetMode: 'fit' | 'actual' | 'fill') => {
      if (vp.w <= 0 || vp.h <= 0 || nat.w <= 0 || nat.h <= 0) return { x: 0, y: 0, zoom: 1 }
      const pad = targetMode === 'fill' ? 0 : 16
      const availW = Math.max(1, vp.w - pad * 2)
      const availH = Math.max(1, vp.h - pad * 2)
      const zoom =
        targetMode === 'actual'
          ? 1
          : targetMode === 'fill'
            ? Math.max(availW / nat.w, availH / nat.h)
            : Math.min(availW / nat.w, availH / nat.h)
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      return {
        zoom: clampedZoom,
        x: (vp.w - nat.w * clampedZoom) / 2,
        y: (vp.h - nat.h * clampedZoom) / 2
      }
    },
    []
  )

  // Reset to fit whenever imageKey changes
  useEffect(() => {
    setNatural(null)
    setMode('fit')
  }, [imageKey])

  // Observe viewport size without ever being pushed by floating overlays
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setViewSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Auto-recompute camera when natural dimensions or viewport change in fit/fill mode
  useEffect(() => {
    if (!natural || viewSize.w <= 0 || viewSize.h <= 0) return
    if (mode === 'fit' || mode === 'fill') {
      setCam(computeFit(natural, viewSize, mode))
    }
  }, [natural, viewSize, mode, computeFit])

  const applyPreset = (nextMode: 'fit' | 'actual' | 'fill') => {
    setMode(nextMode)
    if (natural && viewSize.w > 0 && viewSize.h > 0) {
      setCam(computeFit(natural, viewSize, nextMode))
    }
  }

  const zoomAt = (factor: number, anchorX: number, anchorY: number) => {
    setMode('custom')
    setCam((prev) => {
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor))
      const ratio = nextZoom / prev.zoom
      return {
        zoom: nextZoom,
        x: anchorX - (anchorX - prev.x) * ratio,
        y: anchorY - (anchorY - prev.y) * ratio
      }
    })
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement | null)?.closest('[data-viewer-hud]')) return
    e.preventDefault()
    const rect = viewportRef.current?.getBoundingClientRect()
    const ax = rect ? e.clientX - rect.left : e.clientX
    const ay = rect ? e.clientY - rect.top : e.clientY
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    zoomAt(factor, ax, ay)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-viewer-hud]')) return
    if (target?.closest('[data-hit]')) return
    const isMiddle = e.button === 1
    const isLeft = e.button === 0 && !suspendPan
    if (!isMiddle && !isLeft) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: cam.x,
      originY: cam.y,
      moved: false
    }
    setPanning(true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) > 3) d.moved = true
    if (d.moved) {
      setMode('custom')
      setCam((prev) => ({ ...prev, x: d.originX + dx, y: d.originY + dy }))
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    dragRef.current = null
    setPanning(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!d.moved && onBackdropClick && e.target === e.currentTarget) {
      onBackdropClick()
    }
  }

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-viewer-hud]') || target?.closest('[data-hit]') || suspendPan) return
    if (!natural || viewSize.w <= 0 || viewSize.h <= 0) return
    if (mode === 'fit') {
      const fitZoom = computeFit(natural, viewSize, 'fit').zoom
      const targetZoom = fitZoom >= 0.95 ? 2 : 1
      const rect = viewportRef.current?.getBoundingClientRect()
      const ax = rect ? e.clientX - rect.left : viewSize.w / 2
      const ay = rect ? e.clientY - rect.top : viewSize.h / 2
      zoomAt(targetZoom / cam.zoom, ax, ay)
    } else {
      applyPreset('fit')
    }
  }

  const isPixelArtZoom = Boolean(natural && natural.w <= 512 && natural.h <= 512 && cam.zoom >= 2)

  const imgEl = (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onLoad={(e) => {
        const dims = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }
        setNatural((prev) => (prev && prev.w === dims.w && prev.h === dims.h ? prev : dims))
        onDimensions?.(dims)
      }}
      style={natural ? { width: natural.w, height: natural.h } : undefined}
      className={cn(
        'block max-w-none select-none shadow-2xl',
        isPixelArtZoom && '[image-rendering:pixelated]'
      )}
    />
  )

  return (
    <div
      ref={viewportRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      className={cn(
        'absolute inset-0 overflow-hidden select-none',
        suspendPan ? 'cursor-crosshair' : panning ? 'cursor-grabbing' : 'cursor-grab',
        className
      )}
    >
      {/* TRANSFORMED FULL-PRECISION IMAGE STAGE */}
      <div
        style={{
          transform: `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.zoom})`,
          transformOrigin: '0 0',
          visibility: natural ? 'visible' : 'hidden'
        }}
        className="absolute left-0 top-0 will-change-transform"
      >
        {wrapImage ? wrapImage(imgEl, natural) : imgEl}
      </div>

      {/* FLOATING ZOOM & ACTION HUD (BOTTOM-RIGHT) */}
      <div
        data-viewer-hud
        style={{ right: hudRightOffsetPx }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-3 z-20 flex items-center gap-1.5 transition-[right] duration-150"
      >
        <div className="flex items-center border border-line/60 tone-well-85 font-data text-[10.5px] text-dim shadow-panel backdrop-blur-[var(--panel-blur)]">
          <button
            type="button"
            title="Zoom out"
            onClick={() => zoomAt(1 / 1.25, viewSize.w / 2, viewSize.h / 2)}
            className="flex h-7 w-7 items-center justify-center hover:text-ink cursor-pointer"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="min-w-11 text-center font-semibold text-ink">{Math.round(cam.zoom * 100)}%</span>
          <button
            type="button"
            title="Zoom in"
            onClick={() => zoomAt(1.25, viewSize.w / 2, viewSize.h / 2)}
            className="flex h-7 w-7 items-center justify-center border-r border-line/40 hover:text-ink cursor-pointer"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Fit entire image inside viewer"
            onClick={() => applyPreset('fit')}
            className={cn(
              'h-7 px-2 font-label text-[10px] font-bold caps-5 transition-colors cursor-pointer',
              mode === 'fit' ? 'bg-accent/20 text-accent' : 'hover:text-ink'
            )}
          >
            FIT
          </button>
          <button
            type="button"
            title="Actual 1:1 pixel size"
            onClick={() => applyPreset('actual')}
            className={cn(
              'h-7 border-l border-line/40 px-2 font-label text-[10px] font-bold caps-5 transition-colors cursor-pointer',
              mode === 'actual' ? 'bg-accent/20 text-accent' : 'hover:text-ink'
            )}
          >
            1:1
          </button>
          <button
            type="button"
            title="Fill viewport (useful for wide panoramas or tall vertical strips)"
            onClick={() => applyPreset('fill')}
            className={cn(
              'flex h-7 items-center gap-1 border-l border-line/40 px-2 font-label text-[10px] font-bold caps-5 transition-colors cursor-pointer',
              mode === 'fill' ? 'bg-accent/20 text-accent' : 'hover:text-ink'
            )}
          >
            <Maximize2 className="h-2.5 w-2.5" />
            <span>FILL</span>
          </button>
        </div>
        {hudExtra}
      </div>
    </div>
  )
}
