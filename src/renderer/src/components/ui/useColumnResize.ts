import { useEffect, useMemo, useRef, useState } from 'react'
import { readStored, writeStored } from '../../lib/stored'

export interface ResizableCol {
  id: string
  defaultWidth: string
  minPx?: number
  flex?: boolean
}

const DEFAULT_MIN_PX = 48

export function useColumnResize(storageKey: string, cols: ResizableCol[]) {
  const fullKey = `seven.cols.${storageKey}`
  const [widths, setWidths] = useState<Record<string, number>>(() => readStored<Record<string, number>>(fullKey, {}))
  const [dragging, setDragging] = useState<number | null>(null)
  const headerRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    setWidths(readStored<Record<string, number>>(fullKey, {}))
  }, [fullKey])

  const setHeaderRef = (index: number) => (el: HTMLElement | null) => {
    headerRefs.current[index] = el
  }

  const lastFlexIndex = useMemo(() => {
    for (let i = cols.length - 1; i >= 0; i--) {
      if (cols[i].flex) return i
    }
    return -1
  }, [cols])

  const template = useMemo(() => {
    return cols
      .map((c, i) => {
        const px = widths[c.id]
        if (typeof px === 'number' && Number.isFinite(px) && px > 0) {
          if (i === lastFlexIndex) return `minmax(${px}px, 1fr)`
          return `${px}px`
        }
        return c.defaultWidth
      })
      .join(' ')
  }, [cols, widths, lastFlexIndex])

  const startResize = (index: number, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const col = cols[index]
    const el = headerRefs.current[index]
    if (!col || !el) return

    const startX = e.clientX
    const startW = el.getBoundingClientRect().width
    const minPx = col.minPx ?? DEFAULT_MIN_PX
    setDragging(index)

    const prevSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(minPx, Math.round(startW + (ev.clientX - startX)))
      setWidths((prev) => ({ ...prev, [col.id]: next }))
    }

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = prevSelect
      document.body.style.cursor = prevCursor
      setDragging(null)
      const next = Math.max(minPx, Math.round(startW + (ev.clientX - startX)))
      setWidths((prev) => {
        const merged = { ...prev, [col.id]: next }
        writeStored(fullKey, merged)
        return merged
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const resetWidths = () => {
    setWidths({})
    writeStored(fullKey, {})
  }

  return { template, setHeaderRef, startResize, resetWidths, dragging }
}
