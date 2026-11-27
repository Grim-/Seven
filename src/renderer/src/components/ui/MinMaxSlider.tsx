import { type ChangeEvent } from 'react'
import { cn } from '../../lib/cn'

export interface MinMaxSliderProps {
  label: string
  minVal: number
  maxVal: number
  minLimit: number
  maxLimit: number
  step?: number
  unit?: string
  onChange: (min: number, max: number) => void
  className?: string
}

export function MinMaxSlider({
  label,
  minVal,
  maxVal,
  minLimit,
  maxLimit,
  step = 1,
  unit,
  onChange,
  className
}: MinMaxSliderProps) {
  const range = Math.max(1, maxLimit - minLimit)
  const minPercent = Math.min(100, Math.max(0, ((minVal - minLimit) / range) * 100))
  const maxPercent = Math.min(100, Math.max(0, ((maxVal - minLimit) / range) * 100))

  const handleMinChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(Number(e.target.value), maxVal)
    onChange(val, maxVal)
  }

  const handleMaxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(Number(e.target.value), minVal)
    onChange(minVal, val)
  }

  return (
    <div className={cn('flex flex-col gap-1 select-none', className)}>
      <div className="flex items-center justify-between font-label text-[10px] caps-5 text-dim">
        <span>{label}</span>
        <span className="text-secondary-ink font-bold">
          {minVal} – {maxVal}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div className="relative flex h-5 w-full items-center">
        {/* Track Background */}
        <div className="absolute inset-x-0 h-1 border border-line/40 tone-well-60" />
        {/* Active Range Track */}
        <div
          className="absolute h-1 bg-accent/80 shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent)_calc(40%*var(--glow)),transparent)]"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(0, maxPercent - minPercent)}%`
          }}
        />
        {/* Min Input Slider */}
        <input
          type="range"
          min={minLimit}
          max={maxLimit}
          step={step}
          value={minVal}
          onChange={handleMinChange}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full appearance-none bg-transparent outline-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:w-2
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:border
            [&::-webkit-slider-thumb]:border-line
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:shadow-[0_0_4px_color-mix(in_srgb,var(--color-accent)_calc(60%*var(--glow)),transparent)]
            [&::-webkit-slider-thumb]:hover:bg-ink
            [&::-webkit-slider-thumb]:cursor-ew-resize
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:w-2
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:border
            [&::-moz-range-thumb]:border-line
            [&::-moz-range-thumb]:bg-accent
            [&::-moz-range-thumb]:cursor-ew-resize"
        />
        {/* Max Input Slider */}
        <input
          type="range"
          min={minLimit}
          max={maxLimit}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          className="pointer-events-none absolute inset-0 z-20 h-full w-full appearance-none bg-transparent outline-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:w-2
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:border
            [&::-webkit-slider-thumb]:border-line
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:shadow-[0_0_4px_color-mix(in_srgb,var(--color-accent)_calc(60%*var(--glow)),transparent)]
            [&::-webkit-slider-thumb]:hover:bg-ink
            [&::-webkit-slider-thumb]:cursor-ew-resize
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:h-3.5
            [&::-moz-range-thumb]:w-2
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:border
            [&::-moz-range-thumb]:border-line
            [&::-moz-range-thumb]:bg-accent
            [&::-moz-range-thumb]:cursor-ew-resize"
        />
      </div>
    </div>
  )
}
