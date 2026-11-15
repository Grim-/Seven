import { useRef, type PointerEvent, type MouseEvent } from 'react'
import { cn } from '../../../lib/cn'

export interface Dials {
  energy: number
  warmth: number
}

export interface PadMark extends Dials {
  name: string
  label: string
  marked?: boolean
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))
const place = (d: Dials) => ({ left: `${((d.energy + 1) / 2) * 100}%`, top: `${((1 - d.warmth) / 2) * 100}%` })

export function MoodPad({ value, marks, active, onChange, onPick, onMenu, className }: { value: Dials | null; marks: PadMark[]; active?: string | null; onChange: (v: Dials) => void; onPick: (name: string) => void; onMenu?: (e: MouseEvent, name: string) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const at = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    onChange({ energy: clamp(((e.clientX - r.left) / r.width) * 2 - 1), warmth: clamp(1 - ((e.clientY - r.top) / r.height) * 2) })
  }
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div
        ref={box}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.target !== e.currentTarget) return
          e.currentTarget.setPointerCapture(e.pointerId)
          at(e)
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && at(e)}
        className="relative aspect-square w-full cursor-crosshair touch-none border border-line bg-black/40 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:50%_50%] bg-center"
      >
        {marks.map((m) => (
          <button
            key={m.name}
            type="button"
            onClick={() => onPick(m.name)}
            onContextMenu={onMenu ? (e) => onMenu(e, m.name) : undefined}
            style={place(m)}
            className={cn('absolute -translate-x-1/2 -translate-y-1/2 border px-1 font-mono text-[9.5px] uppercase leading-4', active === m.name ? 'border-white bg-accent text-black' : m.marked ? 'border-accent bg-black text-accent' : 'border-line bg-black text-dim hover:text-white')}
          >
            {m.label}
          </button>
        ))}
        {value && <span style={place(value)} className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 border border-white bg-accent" />}
      </div>
      <div className="flex justify-between font-mono text-[9.5px] uppercase text-faint">
        <span>calm</span>
        <span>warm ↑ · cold ↓</span>
        <span>intense</span>
      </div>
    </div>
  )
}
