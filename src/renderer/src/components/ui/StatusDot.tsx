import { cn } from '../../lib/cn'
import type { Tone } from './feedback'

const DOT: Record<Tone, string> = {
  ok: 'bg-ok shadow-[0_0_6px_color-mix(in_srgb,var(--color-ok)_calc(100%*var(--glow)),transparent)]',
  busy: 'bg-secondary-ink animate-pulse shadow-[0_0_6px_color-mix(in_srgb,var(--color-secondary-ink)_calc(100%*var(--glow)),transparent)]',
  warn: 'bg-accent',
  error: 'bg-alert shadow-[0_0_6px_color-mix(in_srgb,var(--color-alert)_calc(100%*var(--glow)),transparent)]',
  idle: 'bg-faint'
}

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return <span className={cn('h-1.5 w-1.5 shrink-0', DOT[tone], className)} />
}
