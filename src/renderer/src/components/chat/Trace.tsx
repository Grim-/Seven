import { ChevronRight } from 'lucide-react'
import type { ToolPart } from '@shared/types'
import { cn } from '../../lib/cn'

export type TraceTone = 'live' | 'done' | 'ask' | 'fail' | 'quiet' | 'mind'

const DOT: Record<TraceTone, string> = {
  live: 'animate-pulse bg-secondary-ink shadow-[0_0_6px_color-mix(in_srgb,var(--color-cyan)_calc(100%*var(--glow)),transparent)]',
  done: 'bg-secondary-ink shadow-[0_0_6px_color-mix(in_srgb,var(--color-cyan)_calc(100%*var(--glow)),transparent)]',
  ask: 'animate-pulse bg-accent shadow-[0_0_6px_color-mix(in_srgb,var(--color-accent)_calc(100%*var(--glow)),transparent)]',
  fail: 'bg-alert shadow-[0_0_6px_color-mix(in_srgb,var(--color-alert)_calc(100%*var(--glow)),transparent)]',
  quiet: 'bg-faint',
  mind: 'bg-tint-purple shadow-[0_0_6px_color-mix(in_srgb,var(--color-purple)_calc(100%*var(--glow)),transparent)]'
}

const LABEL: Record<TraceTone, string> = {
  live: 'text-secondary-ink',
  done: 'text-accent-soft',
  ask: 'text-accent',
  fail: 'text-alert',
  quiet: 'text-faint',
  mind: 'text-tint-purple'
}

export function partTone(part: ToolPart): TraceTone {
  if (part.ui?.status === 'pending') return 'ask'
  if (part.status === 'running') return 'live'
  if (part.status === 'error' || part.status === 'blocked') return 'fail'
  if (part.status === 'cancelled') return 'quiet'
  return 'done'
}

export function Trace({ tone, label, text, aside, open, onToggle }: { tone: TraceTone; label: string; text?: string; aside?: string; open: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      disabled={!onToggle}
      onClick={onToggle}
      className="group my-1 flex w-full min-w-0 items-center gap-2 py-0.5 text-left font-ui text-[11px] text-faint enabled:hover:text-dim disabled:cursor-default"
    >
      <span className={cn('h-[5px] w-[5px] shrink-0', DOT[tone])} />
      <span className={cn('shrink-0 font-semibold caps-8 ', LABEL[tone])}>{label.replace(/_/g, ' ')}</span>
      {text && <span className="min-w-0 truncate">{text}</span>}
      {aside && <span className="shrink-0 opacity-70">// {aside}</span>}
      {onToggle && <ChevronRight className={cn('h-3 w-3 shrink-0 opacity-60 transition-transform group-hover:opacity-100', open && 'rotate-90')} />}
    </button>
  )
}
