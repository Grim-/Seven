import { NumberField, Slider } from './inputs'
import { cn } from '../../lib/cn'

export function SliderNumber({ value, onChange, min, max, step = 1, openMax = false, className }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; openMax?: boolean; className?: string }) {
  return (
    <span className={cn('flex w-60 items-center gap-2.5', className)}>
      <span className="min-w-0 flex-1">
        <Slider value={value} min={min} max={openMax ? Math.max(max, value) : max} step={step} onChange={onChange} />
      </span>
      <NumberField value={value} min={min} max={openMax ? undefined : max} step={step} onChange={(v) => v !== undefined && onChange(v)} className="h-7 w-20 text-[12px]" />
    </span>
  )
}
