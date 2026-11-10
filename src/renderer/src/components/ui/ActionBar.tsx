import { Button } from './Button'
import { openMenu, type MenuItem } from './ContextMenu'
import { cn } from '../../lib/cn'

export function ActionBar({ items, row = false, className }: { items: MenuItem[]; row?: boolean; className?: string }) {
  return (
    <div className={cn(row ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-2 gap-1.5', className)}>
      {items
        .filter((i) => !i.separator && i.label)
        .map((i) => {
          const btn = (
            <Button
              key={i.label}
              size="sm"
              variant={i.danger ? 'danger' : 'secondary'}
              icon={i.icon}
              disabled={i.disabled}
              title={i.hint}
              onClick={(e) => (i.children ? openMenu(e, i.label, i.children) : i.onSelect?.())}
              className={cn(row ? 'justify-start' : 'w-full justify-start', i.disabled && i.hint && 'pointer-events-none')}
            >
              <span className="truncate">{i.label}</span>
            </Button>
          )
          if (i.disabled && i.hint) {
            return (
              <span key={i.label} title={i.hint} className={cn('inline-flex cursor-not-allowed', !row && 'w-full')}>
                {btn}
              </span>
            )
          }
          return btn
        })}
    </div>
  )
}
