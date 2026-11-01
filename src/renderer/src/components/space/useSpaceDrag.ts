import { useRef, useState, type PointerEvent, type RefObject } from 'react'
import type { Point } from '@shared/shapes'

const SLOP = 6

export interface SpaceDrag<M extends string> {
  mode: M
  delta: Point
  pointer: Point
  center: Point
  shift: boolean
}

export function useSpaceDrag<M extends string>(enabled: boolean, onDrop: (drag: SpaceDrag<M>) => void, onTap: (e: PointerEvent, mode: M) => void) {
  const start = useRef<{ mode: M; at: Point; center: Point; moved: boolean } | null>(null)
  const [live, setLive] = useState<SpaceDrag<M> | null>(null)
  const info = (e: PointerEvent): SpaceDrag<M> | null => {
    const s = start.current
    return s ? { mode: s.mode, delta: { x: e.clientX - s.at.x, y: e.clientY - s.at.y }, pointer: { x: e.clientX, y: e.clientY }, center: s.center, shift: e.shiftKey } : null
  }
  const begin = (mode: M, box?: RefObject<HTMLElement | null>) => (e: PointerEvent) => {
    if (!enabled || e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = (box?.current ?? (e.currentTarget as HTMLElement)).getBoundingClientRect()
    start.current = { mode, at: { x: e.clientX, y: e.clientY }, center: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, moved: false }
  }
  const move = (e: PointerEvent) => {
    const s = start.current
    const d = info(e)
    if (!s || !d) return
    if (!s.moved && Math.hypot(d.delta.x, d.delta.y) < SLOP) return
    s.moved = true
    setLive(d)
  }
  const end = (e: PointerEvent) => {
    const s = start.current
    const d = info(e)
    start.current = null
    setLive(null)
    if (!s || !d) return
    if (s.moved) onDrop(d)
    else onTap(e, s.mode)
  }
  return { live, begin, move, end }
}
