import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function SquareIcon({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        'notch-sm flex h-[34px] w-[34px] shrink-0 items-center justify-center border tone-well-75 text-accent transition-colors hover:border-accent hover:text-ink [&>svg]:h-4 [&>svg]:w-4',
        active ? 'border-accent shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_calc(30%*var(--glow)),transparent)]' : 'border-line'
      )}
    >
      {children}
    </span>
  )
}

export function SquareButton({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="no-drag flex">
      <SquareIcon active={active}>{children}</SquareIcon>
    </button>
  )
}
