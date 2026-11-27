import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'

const BIG_STEP = 10

export function CountStepper({ value, onChange, onDone, min = 0, max, small = false, autoFocus = false }: { value: number; onChange: (n: number) => void; onDone?: () => void; min?: number; max?: number; small?: boolean; autoFocus?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const box = small ? 'h-5 w-5' : 'h-7 w-7'
  const icon = small ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n))
  const shown = draft ?? String(value)
  const typed = (text: string) => {
    setDraft(text)
    const n = Math.round(Number(text))
    if (text.trim() && Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n))
  }
  const step = (by: number) => {
    setDraft(null)
    onChange(clamp(value + by))
  }
  const by = (e: { shiftKey: boolean }, sign: number) => sign * (e.shiftKey ? BIG_STEP : 1)
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    const run = [
      { key: 'ArrowUp', act: () => step(by(e, 1)) },
      { key: 'ArrowDown', act: () => step(by(e, -1)) },
      {
        key: 'Enter',
        act: () => {
          setDraft(null)
          onDone?.()
        }
      }
    ].find((k) => k.key === e.key)
    if (!run) return
    e.preventDefault()
    run.act()
  }
  return (
    <div className="flex shrink-0 items-center border border-line/60">
      <button type="button" title={`Fewer (Shift: ${BIG_STEP})`} disabled={value <= min} onClick={(e: MouseEvent) => step(by(e, -1))} className={cn('flex items-center justify-center text-dim hover:text-ink disabled:opacity-30', box)}>
        <Minus className={icon} />
      </button>
      <input
        value={shown}
        inputMode="numeric"
        autoFocus={autoFocus}
        size={Math.max(2, shown.length)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => typed(e.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={keys}
        className={cn('min-w-6 bg-transparent px-0.5 text-center font-data text-ink outline-none focus:bg-accent/10', small ? 'text-[12px]' : 'text-[13px]')}
      />
      <button type="button" title={`More (Shift: ${BIG_STEP})`} disabled={max !== undefined && value >= max} onClick={(e: MouseEvent) => step(by(e, 1))} className={cn('flex items-center justify-center text-dim hover:text-ink disabled:opacity-30', box)}>
        <Plus className={icon} />
      </button>
    </div>
  )
}
