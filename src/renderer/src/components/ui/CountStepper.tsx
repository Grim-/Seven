import { Minus, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'

export function CountStepper({ value, onChange, min = 0, max, small = false }: { value: number; onChange: (n: number) => void; min?: number; max?: number; small?: boolean }) {
  const box = small ? 'h-5 w-5' : 'h-7 w-7'
  const icon = small ? 'h-3 w-3' : 'h-3.5 w-3.5'
  return (
    <div className="flex shrink-0 items-center border border-line/60">
      <button type="button" title="Fewer" disabled={value <= min} onClick={() => onChange(value - 1)} className={cn('flex items-center justify-center text-dim hover:text-white disabled:opacity-30', box)}>
        <Minus className={icon} />
      </button>
      <span className={cn('text-center font-mono text-white', small ? 'w-6 text-[12px]' : 'w-6 text-[13px]')}>{value}</span>
      <button type="button" title="More" disabled={max !== undefined && value >= max} onClick={() => onChange(value + 1)} className={cn('flex items-center justify-center text-dim hover:text-white disabled:opacity-30', box)}>
        <Plus className={icon} />
      </button>
    </div>
  )
}
