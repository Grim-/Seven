import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const COMMAND_TONE = { '--tone': 'var(--color-tint-orange)' } as CSSProperties

export function CommandLine({ compact = false, children }: { compact?: boolean; children: ReactNode }) {
  return (
    <div style={COMMAND_TONE} className={cn('notch-sm border border-card-hover border-l-[3px] border-l-[var(--tone)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--tone)_7%,var(--color-card)),var(--color-card)_60%)] px-3 py-2 text-ink/90', compact ? 'text-[13.5px] leading-[28px]' : 'text-[14px] leading-[30px]')}>
      {children}
    </div>
  )
}
