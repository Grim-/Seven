import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function ReadingPane({ on = true, className, children }: { on?: boolean; className?: string; children: ReactNode }) {
  return <div className={cn('flex min-h-0 flex-1 flex-col', on && 'reading-pane', className)}>{children}</div>
}
