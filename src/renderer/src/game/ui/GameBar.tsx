import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function barColour(colour: string | null): string {
  return colour ? `var(--color-${colour})` : 'var(--color-accent)'
}

const HEIGHT = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5', lg: 'h-5' }

export function GameBar({ value, max, colour, size = 'sm', text, className }: { value: number; max: number; colour: string | null; size?: keyof typeof HEIGHT; text?: ReactNode; className?: string }) {
  const part = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className={cn('relative tone-panel-60', HEIGHT[size], size === 'lg' && 'border border-line/40', className)}>
      <div className="h-full transition-[width] duration-300" style={{ width: `${part * 100}%`, background: barColour(colour) }} />
      {text && <span className="absolute inset-0 flex items-center justify-between gap-2 px-2 font-ui text-[11px] text-ink [text-shadow:0_1px_2px_black]">{text}</span>}
    </div>
  )
}
