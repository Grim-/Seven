import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function NavButton({ label, title, active, lit, onClick, children }: { label: string; title?: string; active?: boolean; lit?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      className={cn(
        'relative flex h-full w-10 items-center justify-center transition-colors phone:w-11 [&>svg]:h-4 [&>svg]:w-4 phone:[&>svg]:h-5 phone:[&>svg]:w-5',
        active ? 'bg-accent/[0.07] text-accent' : lit ? 'text-accent hover:bg-white/[0.03]' : 'text-dim hover:bg-white/[0.03] hover:text-white'
      )}
    >
      {children}
    </button>
  )
}
