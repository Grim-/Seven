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
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-dim">
        <span>{label}</span>
        <span className="text-cyan font-bold">
          {minVal} – {maxVal}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div className="relative flex h-5 w-full items-center">
        {/* Track Background */}
        <div className="absolute inset-x-0 h-1 border border-line/40 bg-black/60" />
        {/* Active Range Track */}
        <div
          className="absolute h-1 bg-accent/80 shadow-[0_0_6px_rgba(255,201,25,0.4)]"
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
            [&::-webkit-slider-thumb]:shadow-[0_0_4px_rgba(255,201,25,0.6)]
            [&::-webkit-slider-thumb]:hover:bg-white
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
            [&::-webkit-slider-thumb]:shadow-[0_0_4px_rgba(255,201,25,0.6)]
            [&::-webkit-slider-thumb]:hover:bg-white
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
