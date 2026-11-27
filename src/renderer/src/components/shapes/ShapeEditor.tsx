import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { boxForm, movedForm, shapeBounds, tooSmall, type Point, type Shape, type ShapeForm, type ShapeKind, type Size } from '@shared/shapes'
import { cn } from '../../lib/cn'
import { boundsStyle } from './boundsStyle'
import { OutlinePath } from './OutlinePath'

interface Drag {
  mode: 'draw' | 'move' | 'size' | 'point'
  id: string
  start: Point
  origin: ShapeForm
  index?: number
  made?: Shape
  el: Element
}

interface Props {
  size: Size
  shapes: Shape[]
  onChange: (shapes: Shape[]) => void
  selected: string | null
  onSelect: (id: string | null) => void
  drawing: ShapeKind | null
  onDrawn: (id: string | null) => void
  newLabel: string
  newId?: () => string
  from?: Point
  passThrough?: boolean
  onMenu?: (e: MouseEvent, id: string) => void
  marks?: (shape: Shape) => ReactNode
  children: ReactNode
  className?: string
}

const MIN = 0.015
const CLOSE = 0.02

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n))

export function ShapeEditor({ size, shapes, onChange, selected, onSelect, drawing, onDrawn, newLabel, newId = () => crypto.randomUUID(), from, passThrough = false, onMenu, marks, children, className }: Props) {
  const box = useRef<HTMLSpanElement>(null)
  const drag = useRef<Drag | null>(null)
  const [pending, setPending] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [live, setLive] = useState<Shape | null>(null)
  const shown = live ? [...shapes.filter((s) => s.id !== live.id), live] : shapes
  const min = Math.min(size.w, size.h) * MIN

  useEffect(() => {
    setPending(drawing === 'outline' && from ? [from] : [])
  }, [drawing, from])

  useEffect(() => {
    if (!drawing) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPending([])
      onDrawn(null)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [drawing, onDrawn])

  const point = (e: PointerEvent): Point => {
    const r = box.current!.getBoundingClientRect()
    return { x: clamp(((e.clientX - r.left) / r.width) * size.w, size.w), y: clamp(((e.clientY - r.top) / r.height) * size.h, size.h) }
  }
  const setForm = (id: string, form: ShapeForm) => onChange(shapes.map((s) => (s.id === id ? { ...s, form } : s)))
  const drawForm = (d: Drag, form: ShapeForm) => {
    d.made = { ...d.made!, form }
    setLive(d.made)
    onChange([...shapes.filter((s) => s.id !== d.id), d.made])
  }

  const begin = (e: PointerEvent, d: Omit<Drag, 'el'>) => {
    e.stopPropagation()
    const el = e.currentTarget as Element
    el.setPointerCapture(e.pointerId)
    drag.current = { ...d, el }
    onSelect(d.id)
  }

  const finishOutline = (all: Point[]) => {
    const points = all.filter((p, i) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y) >= min)
    setPending([])
    if (points.length < 3) return onDrawn(null)
    const shape: Shape = { id: newId(), label: newLabel, form: { kind: 'outline', points } }
    onChange([...shapes, shape])
    onSelect(shape.id)
    onDrawn(shape.id)
  }

  const onDown = (e: PointerEvent) => {
    if (!drawing) return onSelect(null)
    if (e.button !== 0) return
    e.stopPropagation()
    const p = point(e)
    if (drawing === 'outline') {
      const first = pending[0]
      if (first && pending.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) < Math.min(size.w, size.h) * CLOSE) return finishOutline(pending)
      return setPending([...pending, p])
    }
    const shape: Shape = { id: newId(), label: newLabel, form: boxForm(p, p) }
    onChange([...shapes, shape])
    begin(e, { mode: 'draw', id: shape.id, start: p, origin: shape.form, made: shape })
  }

  const onMove = (e: PointerEvent) => {
    if (drawing === 'outline') setCursor(point(e))
    const d = drag.current
    if (!d) return
    const p = point(e)
    const o = d.origin
    if (d.mode === 'draw') drawForm(d, boxForm(d.start, p))
    else if (d.mode === 'move') setForm(d.id, movedForm(o, p.x - d.start.x, p.y - d.start.y, size))
    else if (d.mode === 'size' && o.kind === 'box') setForm(d.id, { ...o, w: Math.max(min, Math.min(p.x - o.x, size.w - o.x)), h: Math.max(min, Math.min(p.y - o.y, size.h - o.y)) })
    else if (d.mode === 'point' && o.kind === 'outline') setForm(d.id, { kind: 'outline', points: o.points.map((q, i) => (i === d.index ? p : q)) })
  }

  const onUp = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (d.el.hasPointerCapture(e.pointerId)) d.el.releasePointerCapture(e.pointerId)
    drag.current = null
    setLive(null)
    if (d.mode !== 'draw') return
    if (d.made && tooSmall(d.made.form, min)) {
      onChange(shapes.filter((s) => s.id !== d.id))
      return onDrawn(null)
    }
    onDrawn(d.id)
  }

  const onDouble = (e: MouseEvent) => {
    if (drawing !== 'outline') return
    e.stopPropagation()
    finishOutline(pending)
  }

  const handle = (p: Point) => ({ left: `${(p.x / size.w) * 100}%`, top: `${(p.y / size.h) * 100}%` })

  return (
    <span
      ref={box}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={onDouble}
      onContextMenuCapture={
        drawing
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              setPending([])
              onDrawn(null)
            }
          : undefined
      }
      className={cn(
        'relative inline-block select-none',
        drawing ? 'z-[24] pointer-events-auto cursor-crosshair' : cn('z-[6]', passThrough && 'pointer-events-none'),
        className
      )}
    >
      {children}
      {shown.map((s) => {
        const on = s.id === selected
        const b = shapeBounds(s.form)
        return (
          <span
            key={s.id}
            style={boundsStyle(b, size)}
            data-hit
            onPointerDown={(e) => !drawing && s.form.kind === 'box' && begin(e, { mode: 'move', id: s.id, start: point(e), origin: s.form })}
            onContextMenu={onMenu && ((e) => onMenu(e, s.id))}
            className={cn(
              'shape-edit absolute',
              drawing ? 'pointer-events-none' : s.form.kind === 'box' ? 'pointer-events-auto cursor-move' : 'pointer-events-none',
              s.form.kind === 'outline' && 'shape-edit-outline'
            )}
            data-on={on || undefined}
          >
            {s.form.kind === 'outline' && (
              <span className={cn('absolute inset-0', !drawing && 'pointer-events-auto')} onPointerDown={(e) => !drawing && begin(e, { mode: 'move', id: s.id, start: point(e), origin: s.form })}>
                <OutlinePath points={s.form.points} bounds={b} />
              </span>
            )}
            <span className="shape-edit-tag">{s.label}</span>
            {marks && <span className="shape-marks">{marks(s)}</span>}
            {on && !drawing && s.form.kind === 'box' && <span onPointerDown={(e) => begin(e, { mode: 'size', id: s.id, start: point(e), origin: s.form })} data-hit className="shape-handle pointer-events-auto -bottom-1 -right-1 cursor-nwse-resize" />}
          </span>
        )
      })}
      {!drawing &&
        shapes
          .filter((s) => s.id === selected && s.form.kind === 'outline')
          .flatMap((s) => (s.form.kind === 'outline' ? s.form.points.map((p, i) => ({ s, p, i })) : []))
          .map(({ s, p, i }) => (
            <span
              key={`${s.id}:${i}`}
              style={handle(p)}
              data-hit
              onPointerDown={(e) => begin(e, { mode: 'point', id: s.id, start: p, origin: s.form, index: i })}
              className="shape-handle shape-point pointer-events-auto cursor-move"
            />
          ))}
      {drawing === 'outline' && pending.length > 0 && (
        <span className="pointer-events-none absolute inset-0">
          <OutlinePath points={cursor ? [...pending, cursor] : pending} bounds={{ x: 0, y: 0, ...size }} closed={false} />
          {pending.map((p, i) => (
            <span key={i} style={handle(p)} className="shape-handle shape-point" />
          ))}
        </span>
      )}
    </span>
  )
}
