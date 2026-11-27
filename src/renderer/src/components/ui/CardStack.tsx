import { useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type WheelEvent } from 'react'
import { cn } from '../../lib/cn'
import { isTypingTarget } from '../../store/keybinds'
import { LEFT_RIGHT, stepByKey } from '../../lib/stepKeys'

const PEEK = 3
const STEP = 18
const WHEEL_STEP = 60

function placed(offset: number): CSSProperties {
  const far = Math.abs(offset)
  return {
    transform: `translate(${offset * STEP}px, ${far * 5}px) scale(${1 - far * 0.05})`,
    zIndex: PEEK + 1 - far,
    opacity: far ? Math.max(0.25, 0.8 - far * 0.18) : 1
  }
}

export function CardStack({
  count,
  current,
  onCurrent,
  card,
  label,
  onMenu,
  onKeyDown,
  className,
  cardClassName = 'max-w-sm'
}: {
  count: number
  current: number
  onCurrent: (index: number) => void
  card: (index: number, front: boolean) => ReactNode
  label: (index: number) => string
  onMenu?: (e: MouseEvent, index: number) => void
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
  className?: string
  cardClassName?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const wheel = useRef(0)
  const go = (index: number) => onCurrent(Math.max(0, Math.min(count - 1, index)))
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = stepByKey(e, current, count, LEFT_RIGHT)
    if (next !== null) go(next)
    else if (!isTypingTarget(e)) onKeyDown?.(e)
  }
  const flip = (e: WheelEvent) => {
    const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0
    if (!delta) return
    wheel.current += delta
    if (Math.abs(wheel.current) < WHEEL_STEP) return
    go(current + Math.sign(wheel.current))
    wheel.current = 0
  }
  const pick = (index: number) => {
    go(index)
    root.current?.focus()
  }
  return (
    <div ref={root} tabIndex={0} onKeyDown={keys} onWheel={flip} className={cn('grid grid-cols-1 grid-rows-1 justify-items-center px-14 py-2 outline-none', className)}>
      {Array.from({ length: count }, (_, i) => i).map((i) => {
        const offset = i - current
        if (Math.abs(offset) > PEEK) return null
        const front = offset === 0
        return (
          <div key={i} style={placed(offset)} inert={!front || undefined} onContextMenu={onMenu ? (e) => onMenu(e, i) : undefined} className={cn('group/card relative col-start-1 row-start-1 w-full min-w-0 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none', cardClassName)}>
            {card(i, front)}
          </div>
        )
      })}
      {Array.from({ length: count }, (_, i) => i)
        .filter((i) => i !== current && Math.abs(i - current) <= PEEK)
        .map((i) => (
          <div
            key={`peek-${i}`}
            role="button"
            title={label(i)}
            onClick={() => pick(i)}
            onContextMenu={onMenu ? (e) => onMenu(e, i) : undefined}
            style={{ ...placed(i - current), opacity: 0 }}
            className={cn('col-start-1 row-start-1 h-full w-full cursor-pointer', cardClassName)}
          />
        ))}
    </div>
  )
}
