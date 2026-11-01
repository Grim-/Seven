import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/format'
import type { ShellAdd, ShellBinding, ShellItem } from './shellTypes'

export function shellState(b: ShellBinding): { 'data-on': boolean; 'data-drag': boolean } {
  return { 'data-on': b.picked || b.over, 'data-drag': b.dragging }
}

export function ShellIcon({ scale, className, children }: { scale: number; className?: string; children: ReactNode }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center [&_svg]:h-full [&_svg]:w-full', className)} style={{ width: `${scale}rem`, height: `${scale}rem` }}>
      {children}
    </span>
  )
}

export function ShellAddTile({ add }: { add: ShellAdd }) {
  return (
    <button onClick={add.onClick} className="shell-add flex min-w-0 flex-col items-center justify-center gap-1.5">
      <span className="flex aspect-[4/3] w-full items-center justify-center [&_svg]:h-[30%] [&_svg]:w-[30%]">{add.icon}</span>
      <span className="pb-2 font-mono text-[11px] uppercase tracking-[0.1em]">{add.label}</span>
    </button>
  )
}

export function FaceGrid({ scale = 1, children }: { scale?: number; children: ReactNode }) {
  return (
    <div className="grid items-start gap-3.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${200 * scale}px, 1fr))` }}>
      {children}
    </div>
  )
}

export function FaceCount({ count }: { count?: number }) {
  return count ? <span className="shell-count">×{count}</span> : null
}

export function asideOf(item: ShellItem): string | undefined {
  return item.aside ?? (item.updatedAt !== undefined ? formatRelative(item.updatedAt) : undefined)
}

export function ShellSweep() {
  return (
    <span className="shell-sweep-clip">
      <span className="shell-sweep" />
    </span>
  )
}

export function enterStyle(index: number, style?: CSSProperties): CSSProperties {
  return { ...style, '--i': Math.min(index, 14) } as CSSProperties
}
