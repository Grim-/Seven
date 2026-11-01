import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { useEscapeLayer } from '../../lib/escape'
import { fitNear } from '../../lib/fitNear'

export function Popover({
  trigger,
  children,
  className,
  title,
  disabled = false
}: {
  trigger: ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  className?: string
  title?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const close = () => setOpen(false)

  const place = () => {
    const el = box.current
    const anchor = root.current
    if (!el || !anchor) return
    const { left, top } = fitNear(
      anchor.getBoundingClientRect(),
      el.getBoundingClientRect(),
      'bottom',
      'end'
    )
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  }

  useLayoutEffect(() => {
    if (!open || !box.current) return
    place()
    const observer = new ResizeObserver(place)
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [open])

  useEffect(() => {
    if (!open) return
    const inside = (e: Event) =>
      root.current?.contains(e.target as Node) || box.current?.contains(e.target as Node)
    const down = (e: MouseEvent) => !inside(e) && close()
    const scroll = (e: Event) => !inside(e) && close()
    window.addEventListener('mousedown', down)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('mousedown', down)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEscapeLayer(open, close)
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        title={title}
        className="flex items-center"
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={box}
            data-layer
            style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }}
            className={cn(
              'z-[500] flex max-h-[calc(100vh-8px)] flex-col overflow-y-auto border border-line bg-[#0b0b0b] shadow-xl',
              className
            )}
          >
            {typeof children === 'function' ? children(close) : children}
          </div>,
          document.body
        )}
    </div>
  )
}
