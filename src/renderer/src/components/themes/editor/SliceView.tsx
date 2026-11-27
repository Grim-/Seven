import { useRef, useState } from 'react'
import { assetUrl, useAsset } from '../../../store/data'
import type { Sides } from './SidesField'

export function SliceView({ asset, slice, onChange }: { asset: string; slice: Sides; onChange: (next: Sides) => void }) {
  const meta = useAsset(asset)
  const svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const drag = (side: number) => (e: React.PointerEvent) => {
    const el = svg.current
    if (!el || !size) return
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = ((ev.clientX - r.left) / r.width) * size.w
      const y = ((ev.clientY - r.top) / r.height) * size.h
      const at = [y, size.w - x, size.h - y, x][side]
      const full = side % 2 ? size.w : size.h
      onChange(slice.map((v, i) => (i === side ? Math.round(Math.min(full, Math.max(0, at))) : v)) as Sides)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const lines = size
    ? [
        { x1: 0, y1: slice[0], x2: size.w, y2: slice[0], cursor: 'cursor-ns-resize' },
        { x1: size.w - slice[1], y1: 0, x2: size.w - slice[1], y2: size.h, cursor: 'cursor-ew-resize' },
        { x1: 0, y1: size.h - slice[2], x2: size.w, y2: size.h - slice[2], cursor: 'cursor-ns-resize' },
        { x1: slice[3], y1: 0, x2: slice[3], y2: size.h, cursor: 'cursor-ew-resize' }
      ]
    : []
  return (
    <div className="relative w-full max-w-72 select-none border border-line/60">
      {meta && (
        <img src={assetUrl(meta)} alt="" draggable={false} className="block w-full" onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      )}
      {size && (
        <svg ref={svg} viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {lines.map(({ cursor, ...l }, side) => (
            <g key={side} className={cursor} onPointerDown={drag(side)}>
              <line {...l} className="stroke-transparent" strokeWidth={12} vectorEffect="non-scaling-stroke" />
              <line {...l} className="stroke-accent" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
