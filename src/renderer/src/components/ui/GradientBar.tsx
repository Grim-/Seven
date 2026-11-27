import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import type { GradientStop } from '@shared/gradient'
import { cn } from '../../lib/cn'
import { stopsFill } from '../../lib/gradients'

export const CHECKER = 'bg-[repeating-conic-gradient(var(--color-well)_0_25%,var(--color-panel)_0_50%)] bg-[length:10px_10px]'

function percent(e: { clientX: number }, bar: HTMLElement | null): number {
  if (!bar) return 0
  const rect = bar.getBoundingClientRect()
  return Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)))
}

export function GradientBar({
  stops,
  selected,
  onSelect,
  onMove,
  onAdd,
  onRemove,
  onStopMenu,
  onBarMenu
}: {
  stops: GradientStop[]
  selected: number
  onSelect: (i: number) => void
  onMove: (i: number, at: number) => void
  onAdd: (at: number) => void
  onRemove: (i: number) => void
  onStopMenu: (e: MouseEvent, i: number) => void
  onBarMenu: (e: MouseEvent, at: number) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)

  const down = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    onSelect(i)
    dragging.current = i
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragging.current !== null) onMove(dragging.current, percent(e, bar.current))
  }
  const up = () => {
    dragging.current = null
  }
  const key = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 10 : 1
    const moves: Record<string, () => void> = {
      ArrowLeft: () => onMove(i, Math.max(0, stops[i].at - step)),
      ArrowRight: () => onMove(i, Math.min(100, stops[i].at + step)),
      Home: () => onMove(i, 0),
      End: () => onMove(i, 100),
      Delete: () => onRemove(i),
      Backspace: () => onRemove(i)
    }
    const run = moves[e.key]
    if (!run) return
    e.preventDefault()
    run()
  }

  return (
    <div className="flex w-full min-w-0 select-none flex-col">
      <div
        ref={bar}
        title="Click to add a colour here"
        onClick={(e) => onAdd(percent(e, bar.current))}
        onContextMenu={(e) => onBarMenu(e, percent(e, bar.current))}
        className={cn('relative h-10 cursor-copy border border-line/60', CHECKER)}
      >
        <div className="absolute inset-0" style={{ background: stopsFill(stops, 90) }} />
      </div>
      <div className="relative mx-0 h-7">
        {stops.map((stop, i) => (
          <button
            key={i}
            type="button"
            title={`Colour ${i + 1} at ${stop.at}%. Drag to move, arrows to nudge, Delete to remove.`}
            onPointerDown={down(i)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={key(i)}
            onContextMenu={(e) => {
              onSelect(i)
              onStopMenu(e, i)
            }}
            className={cn('absolute top-0 flex -translate-x-1/2 cursor-ew-resize touch-none flex-col items-center focus-visible:outline-none', i === selected ? 'z-10' : 'z-0')}
            style={{ left: `${stop.at}%` }}
          >
            <span className={cn('h-0 w-0 border-x-[5px] border-b-[6px] border-x-transparent', i === selected ? 'border-b-accent' : 'border-b-line-strong')} />
            <span className={cn('h-5 w-5 border-2', CHECKER, i === selected ? 'border-accent shadow-glow' : 'border-line-strong')}>
              <span className="block h-full w-full" style={{ background: stop.color }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
