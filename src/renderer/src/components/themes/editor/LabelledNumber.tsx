import { NumberField } from '../../ui'
import { cn } from '../../../lib/cn'

export function LabelledNumber({ label, value, onChange, min, max, step, className }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-0.5', className)}>
      <span className="type-label text-[10.5px] text-faint">{label}</span>
      <NumberField value={value} min={min} max={max} step={step} onChange={(v) => onChange(v ?? 0)} className="w-full" />
    </label>
  )
}
