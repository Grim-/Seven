import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Point, Size } from '@shared/shapes'
import { thingsAt, type MapThing } from './registry'

export interface PickChipState {
  at: Point
  index: number
  count: number
  label: string
}

interface Options {
  area: Size
  enabled: boolean
  things: () => MapThing[]
  selection: string[]
  onSelection?: (keys: string[]) => void
  onSelectionMenu?: (e: MouseEvent, keys: string[]) => void
  intercept?: (thing: MapThing) => boolean
}

const SAME_SPOT = 5
const CLICK_SLOP = 4

export function useThingPicking({ area, enabled, things, selection, onSelection, onSelectionMenu, intercept }: Options) {
  const down = useRef<{ x: number; y: number } | null>(null)
  const last = useRef<{ x: number; y: number; keys: string; index: number } | null>(null)
  const [chip, setChip] = useState<PickChipState | null>(null)

  useEffect(() => {
    if (!onSelection || !selection.length) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelection([])
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onSelection, selection.length])

  const mapPoint = (e: MouseEvent): Point => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const k = r.width / Math.max(1, area.w)
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }
  }
  const skip = (e: MouseEvent) => !enabled || Boolean((e.target as Element).closest('[data-keep]'))
  const choose = (e: MouseEvent, list: MapThing[], advance: boolean): number => {
    const keys = list.map((t) => t.key).join('|')
    const l = last.current
    const same = l !== null && l.keys === keys && Math.hypot(e.clientX - l.x, e.clientY - l.y) < SAME_SPOT
    const index = same ? (advance ? (l.index + 1) % list.length : l.index) : 0
    last.current = { x: e.clientX, y: e.clientY, keys, index }
    return index
  }

  const onPointerDownCapture = (e: PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY }
  }

  const onClickCapture = (e: MouseEvent) => {
    if (skip(e)) return
    const d = down.current
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_SLOP) return
    const list = thingsAt(things(), mapPoint(e))
    if (!list.length) {
      last.current = null
      setChip(null)
      return
    }
    e.stopPropagation()
    const index = choose(e, list, true)
    const thing = list[index]
    setChip(list.length > 1 ? { at: mapPoint(e), index, count: list.length, label: thing.label } : null)
    if (intercept?.(thing)) return
    if ((e.ctrlKey || e.metaKey) && onSelection) {
      onSelection(selection.includes(thing.key) ? selection.filter((k) => k !== thing.key) : [...selection, thing.key])
      return
    }
    thing.pick(e)
    onSelection?.([thing.key])
  }

  const onContextMenuCapture = (e: MouseEvent) => {
    if (skip(e)) return
    const list = thingsAt(things(), mapPoint(e))
    if (!list.length) return
    e.preventDefault()
    e.stopPropagation()
    const thing = list[choose(e, list, false)]
    if (onSelectionMenu && selection.length > 1 && selection.includes(thing.key)) {
      onSelectionMenu(e, selection)
      return
    }
    thing.menu?.(e)
  }

  const clearChip = () => {
    last.current = null
    setChip(null)
  }

  return { handlers: { onPointerDownCapture, onClickCapture, onContextMenuCapture }, chip, clearChip }
}
