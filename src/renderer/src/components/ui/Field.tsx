import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string | null
  className?: string
  aside?: ReactNode
  group?: boolean
  children: ReactNode
}

export function Field({ label, hint, error, className, aside, group = false, children }: FieldProps) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">{label}</span>
        {aside}
      </span>
      {children}
      {error ? (
        <span className="text-[12px] text-alert">{error}</span>
      ) : hint ? (
        <span className="text-[12px] leading-snug text-dim">{hint}</span>
      ) : null}
    </Tag>
  )
}
