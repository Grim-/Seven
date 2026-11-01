import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Props {
  count: number
  scroller: RefObject<HTMLElement | null>
  estimate: number
  keyOf?: (index: number) => string | number
  overscan?: number
  rowClassName?: (index: number) => string | undefined
  children: (index: number) => ReactNode
}

function offsetIn(el: HTMLElement | null, scroller: HTMLElement | null): number {
  if (!el || !scroller) return 0
  return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
}

export function VirtualList({ count, scroller, estimate, keyOf, overscan = 8, rowClassName, children }: Props) {
  const list = useRef<HTMLDivElement>(null)
  const [, attach] = useState(0)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scroller.current,
    estimateSize: () => estimate,
    getItemKey: keyOf ?? ((i) => i),
    overscan,
    scrollMargin: offsetIn(list.current, scroller.current)
  })
  useEffect(() => {
    if (scroller.current && virtualizer.scrollElement !== scroller.current) attach((n) => n + 1)
  })
  const items = virtualizer.getVirtualItems()
  const margin = virtualizer.options.scrollMargin
  const top = items.length ? items[0].start - margin : 0
  const bottom = items.length ? virtualizer.getTotalSize() - (items[items.length - 1].end - margin) : 0
  return (
    <div ref={list} className="shrink-0" style={{ paddingTop: Math.max(0, top), paddingBottom: Math.max(0, bottom) }}>
      {items.map((v) => (
        <div key={v.key} data-index={v.index} ref={virtualizer.measureElement} className={rowClassName?.(v.index)}>
          {children(v.index)}
        </div>
      ))}
    </div>
  )
}
