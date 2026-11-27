import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import type { Point, Size } from '@shared/shapes'
import { useViewPlace } from '../../lib/viewPlace'
import { cn } from '../../lib/cn'
import { ZoomControls } from './ZoomControls'
import { ViewZoom } from './viewZoom'

interface View {
  x: number
  y: number
  scale: number
}

interface Props {
  size: Size
  place?: string
  controls?: boolean
  still?: boolean
  /** Increment `seq` to pan the camera smoothly to center `at` (map coordinates). */
  focus?: { at: Point; seq: number } | null
  onBlank?: (at: Point) => void
  onBlankMenu?: (e: MouseEvent, at: Point) => void
  onBoxSelect?: (from: Point, to: Point, add: boolean) => void
  onZoom?: (scale: number) => void
  children: ReactNode
  className?: string
}

const STEP = 1.25
const SLOP = 3

function fitView(size: Size, frame: Size): View {
  const scale = Math.min(frame.w / size.w, frame.h / size.h) * 0.96
  return { scale, x: (frame.w - size.w * scale) / 2, y: (frame.h - size.h * scale) / 2 }
}

export function Viewport({ size, place, controls = true, still = false, focus = null, onBlank, onBlankMenu, onBoxSelect, onZoom, children, className }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<Size | null>(null)
  const [saved, save] = useViewPlace<View | null>(`viewport.${place ?? ''}`, null)
  const [moved, setMoved] = useState<View | null>(place ? saved : null)
  const pan = useRef<{ start: { x: number; y: number }; origin: View; id: number; live: boolean } | null>(null)
  const fit = frame ? fitView(size, frame) : null
  const view = moved ?? fit
  const viewRef = useRef(view)
  viewRef.current = view
  const panned = useRef(false)
  const boxing = useRef<{ start: { x: number; y: number }; id: number; add: boolean } | null>(null)
  const [band, setBand] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
  const scale = view?.scale ?? 1

  useEffect(() => {
    onZoom?.(scale)
  }, [scale])

  useEffect(() => {
    if (place && saved && !moved) setMoved(saved)
  }, [saved])

  const lastFocusSeq = useRef<number>(0)
  useEffect(() => {
    if (!focus || !frame || focus.seq === lastFocusSeq.current) return
    lastFocusSeq.current = focus.seq
    const cur = viewRef.current ?? fitView(size, frame)
    const minComfortable = fit ? fit.scale * 1.15 : 1
    const nextScale = Math.max(cur.scale, minComfortable)
    commit({
      scale: nextScale,
      x: frame.w / 2 - focus.at.x * nextScale,
      y: frame.h / 2 - focus.at.y * nextScale
    })
  }, [focus?.seq, frame])

  const commit = (next: View | null) => {
    setMoved(next)
    if (place) save(next)
  }

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => setFrame({ w: el.clientWidth, h: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const zoomAt = (factor: number, at: { x: number; y: number }) => {
    const v = viewRef.current
    if (!v || !fit) return
    const scale = Math.min(fit.scale * 40, Math.max(fit.scale / 4, v.scale * factor))
    const k = scale / v.scale
    commit({ scale, x: at.x - (at.x - v.x) * k, y: at.y - (at.y - v.y) * k })
  }
  const zoomRef = useRef(zoomAt)
  zoomRef.current = zoomAt

  useEffect(() => {
    const el = box.current
    if (!el || still) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomRef.current(Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [still])

  const framePoint = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const toMap = (p: { x: number; y: number }): Point => {
    const v = viewRef.current ?? { x: 0, y: 0, scale: 1 }
    return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale }
  }
  const onDown = (e: PointerEvent) => {
    if (e.button === 0 && e.shiftKey && onBoxSelect && view && !still) {
      const at = framePoint(e)
      boxing.current = { start: at, id: e.pointerId, add: e.ctrlKey || e.metaKey }
      box.current?.setPointerCapture(e.pointerId)
      setBand({ a: at, b: at })
      return
    }
    if ((e.button !== 0 && e.button !== 1) || !view || still) return
    pan.current = { start: { x: e.clientX, y: e.clientY }, origin: view, id: e.pointerId, live: false }
  }
  const onMove = (e: PointerEvent) => {
    if (boxing.current) {
      setBand({ a: boxing.current.start, b: framePoint(e) })
      return
    }
    const p = pan.current
    if (!p) return
    const dx = e.clientX - p.start.x
    const dy = e.clientY - p.start.y
    if (!p.live) {
      if (Math.hypot(dx, dy) < SLOP) return
      p.live = true
      box.current?.setPointerCapture(p.id)
    }
    setMoved({ ...p.origin, x: p.origin.x + dx, y: p.origin.y + dy })
  }
  const onUp = (e: PointerEvent) => {
    const b = boxing.current
    if (b) {
      boxing.current = null
      setBand(null)
      const end = framePoint(e)
      panned.current = Math.hypot(end.x - b.start.x, end.y - b.start.y) >= SLOP
      if (panned.current) onBoxSelect?.(toMap(b.start), toMap(end), b.add)
      return
    }
    const p = pan.current
    pan.current = null
    panned.current = Boolean(p?.live)
    if (p?.live) commit(viewRef.current)
  }
  const blank = (e: MouseEvent) => !(e.target as Element).closest('button, a, input, textarea, select, [data-layer], [data-hit]')
  const pointAt = (e: MouseEvent): Point => toMap(framePoint(e))
  const onClick = (e: MouseEvent) => {
    if (onBlank && !panned.current && blank(e)) onBlank(pointAt(e))
  }
  const onMenu = (e: MouseEvent) => {
    if (onBlankMenu && blank(e)) onBlankMenu(e, pointAt(e))
  }

  const center = () => ({ x: (frame?.w ?? 0) / 2, y: (frame?.h ?? 0) / 2 })
  const style = view ? ({ width: size.w, height: size.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, '--zoom': view.scale } as CSSProperties) : { visibility: 'hidden' as const }

  return (
    <div ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={onClick} onContextMenu={onMenu} className={cn('relative min-h-0 overflow-hidden', className)}>
      <div className="space-content absolute left-0 top-0 origin-top-left" style={style}>
        <ViewZoom.Provider value={scale}>{children}</ViewZoom.Provider>
      </div>
      {band && (
        <div
          style={{ left: Math.min(band.a.x, band.b.x), top: Math.min(band.a.y, band.b.y), width: Math.abs(band.b.x - band.a.x), height: Math.abs(band.b.y - band.a.y) }}
          className="pointer-events-none absolute z-30 border border-accent bg-accent/10"
        />
      )}
      {controls && !still && <ZoomControls onIn={() => zoomAt(STEP, center())} onOut={() => zoomAt(1 / STEP, center())} onFit={() => commit(null)} />}
    </div>
  )
}
