import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { SearchBox } from './inputs'

export function SearchListPanel({
  query,
  onQuery,
  placeholder,
  count,
  aside,
  onKeyDown,
  className,
  children
}: {
  query: string
  onQuery: (query: string) => void
  placeholder: string
  count: ReactNode
  aside?: ReactNode
  onKeyDown?: (e: KeyboardEvent) => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex min-h-0 flex-col gap-2 border border-line tone-panel-40 p-3', className)}>
      <div onKeyDown={onKeyDown}>
        <SearchBox value={query} onChange={onQuery} placeholder={placeholder} />
      </div>
      <div className="flex items-center justify-between px-1 text-[10px] text-dim">
        <span>{count}</span>
        {aside && <span>{aside}</span>}
      </div>
      <div className="max-h-[380px] flex-1 overflow-y-auto border border-line/40">{children}</div>
    </div>
  )
}
