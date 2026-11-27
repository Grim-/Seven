import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { useEscapeLayer } from '../../lib/escape'
import { fitNear, type NearAlign, type NearSide } from '../../lib/fitNear'

export function FloatLayer({
  anchor,
  onClose,
  className,
  side = 'bottom',
  align = 'end',
  children
}: {
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  className?: string
  side?: NearSide
  align?: NearAlign
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  const place = () => {
    const el = box.current
    const at = anchor.current
    if (!el || !at) return
    const { left, top } = fitNear(at.getBoundingClientRect(), el.getBoundingClientRect(), side, align)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  }

  useLayoutEffect(() => {
    if (!box.current) return
    place()
    const observer = new ResizeObserver(place)
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [side, align])

  useEffect(() => {
    const inside = (e: Event) => anchor.current?.contains(e.target as Node) || box.current?.contains(e.target as Node) || !!(e.target as Element | null)?.closest?.('[data-layer]')
    const away = (e: Event) => !inside(e) && close.current()
    window.addEventListener('pointerdown', away)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('scroll', away, true)
      window.removeEventListener('resize', place)
    }
  }, [])

  useEscapeLayer(true, () => close.current())
  return createPortal(
    <div
      ref={box}
      data-layer
      style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }}
      className={cn('z-[500] flex max-h-[calc(100vh-8px)] tablet:max-h-[calc(100%-12px)] tablet:max-w-[calc(100%-8px)] flex-col overflow-y-auto border border-line bg-surface shadow-xl', className)}
    >
      {children}
    </div>,
    document.body
  )
}
