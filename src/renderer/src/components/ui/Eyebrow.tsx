import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('type-eyebrow text-accent-soft', className)}>{children}</span>
}
