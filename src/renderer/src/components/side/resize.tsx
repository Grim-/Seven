import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export function useResizable(saved: number, min: number, max: number, edge: 'left' | 'right', commit: (width: number) => void, reset: number) {
  const [width, setWidth] = useState(saved)
  const drag = useRef<{ x: number; w: number } | null>(null)
  useEffect(() => setWidth(saved), [saved])
  const handle = (
    <div
      className={cn('absolute top-0 z-10 h-full w-2 cursor-col-resize hover:bg-accent/30', edge === 'left' ? '-left-2' : '-right-2')}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, w: width }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const delta = edge === 'left' ? drag.current.x - e.clientX : e.clientX - drag.current.x
        setWidth(Math.min(max, Math.max(min, drag.current.w + delta)))
      }}
      onPointerUp={() => {
        if (!drag.current) return
        drag.current = null
        if (width !== saved) commit(width)
      }}
      onDoubleClick={() => commit(reset)}
    />
  )
  return { width, handle }
}
