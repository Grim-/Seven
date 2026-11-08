import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function FieldGrid({ dense = false, className, children }: { dense?: boolean; className?: string; children: ReactNode }) {
  return <div className={cn('grid gap-x-4', dense ? 'grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-y-3.5' : 'grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-y-3', className)}>{children}</div>
}
