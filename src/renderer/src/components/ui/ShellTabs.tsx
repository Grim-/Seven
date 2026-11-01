import type { MouseEvent, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface ShellTab<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  count?: number
}

export function ShellTabs<T extends string>({ value, options, onChange, onMenu, children, className }: { value: T; options: ShellTab<T>[]; onChange: (value: T) => void; onMenu?: (e: MouseEvent, value: T) => void; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('shell-tabs', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" data-on={o.value === value} onClick={() => onChange(o.value)} onContextMenu={onMenu && ((e) => onMenu(e, o.value))} className="shell-tab">
          {o.icon && <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full">{o.icon}</span>}
          {o.label}
          {o.count !== undefined && <span className="font-normal text-faint">{o.count}</span>}
        </button>
      ))}
      {children && <span className="ml-auto flex items-center gap-1.5 pb-1">{children}</span>}
    </div>
  )
}
