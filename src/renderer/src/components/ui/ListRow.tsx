import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function ListRow({
  active,
  onClick,
  onMenu,
  icon,
  title,
  subtitle,
  tone = 'plain',
  wrap = false,
  mono = false,
  meta,
  actions,
  accent,
  tooltip,
  disabled = false,
  children
}: {
  active: boolean
  onClick: () => void
  onMenu?: (e: React.MouseEvent) => void
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  tone?: 'plain' | 'tag'
  wrap?: boolean
  mono?: boolean
  meta?: ReactNode
  actions?: ReactNode
  accent?: string
  tooltip?: string
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <div
      onContextMenu={onMenu}
      style={active && accent ? { borderLeftColor: accent } : undefined}
      className={cn('group flex flex-col border-l-2', active ? 'border-l-accent bg-accent/10' : 'border-l-transparent hover:bg-ink/[0.03]')}
    >
      <div className="flex items-center">
        <button onClick={onClick} title={tooltip} disabled={disabled} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-left disabled:cursor-wait disabled:opacity-60">
          {icon && <span className={cn('flex shrink-0 items-center [&>svg]:h-4 [&>svg]:w-4', active ? 'text-accent' : 'text-accent-soft/80')}>{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[13px]', active ? 'text-ink' : 'text-ink/85', mono && 'font-mono')}>{title}</span>
            {subtitle && <span className={cn('block', wrap ? 'line-clamp-2' : 'truncate', tone === 'tag' ? 'font-label text-[10.5px] caps-10 text-secondary/70' : 'text-[11.5px] text-dim')}>{subtitle}</span>}
          </span>
          {meta !== undefined && <span className="shrink-0 font-data text-[10.5px] text-faint">{meta}</span>}
        </button>
        {actions && <span className="flex shrink-0 items-center pr-1.5 opacity-0 group-hover:opacity-100">{actions}</span>}
      </div>
      {children && <div className={cn('pb-1.5 pr-2.5', icon ? 'pl-9' : 'pl-2.5')}>{children}</div>}
    </div>
  )
}

export function RowAction({ title, icon, onClick, danger = false, disabled = false }: { title: string; icon: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={cn('flex h-6 w-6 items-center justify-center text-dim disabled:pointer-events-none disabled:opacity-30 [&>svg]:h-3.5 [&>svg]:w-3.5', danger ? 'hover:text-alert' : 'hover:text-ink')}>
      {icon}
    </button>
  )
}
