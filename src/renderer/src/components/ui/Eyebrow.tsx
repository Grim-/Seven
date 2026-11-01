import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent-soft', className)}>{children}</span>
}
