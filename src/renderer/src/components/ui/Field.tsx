import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { InfoTip } from './InfoTip'

interface FieldProps {
  label: string
  hint?: ReactNode
  tip?: string
  error?: string | null
  className?: string
  aside?: ReactNode
  group?: boolean
  children: ReactNode
}

export function Field({ label, hint, tip, error, className, aside, group = false, children }: FieldProps) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">{label}</span>
          <InfoTip title={label} text={tip} />
        </span>
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
