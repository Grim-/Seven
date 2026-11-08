import { Button } from './Button'
import { openMenu, type MenuItem } from './ContextMenu'
import { cn } from '../../lib/cn'

export function ActionBar({ items, className }: { items: MenuItem[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-1.5', className)}>
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
              className={cn('w-full justify-start', i.disabled && i.hint && 'pointer-events-none')}
            >
              <span className="truncate">{i.label}</span>
            </Button>
          )
          if (i.disabled && i.hint) {
            return (
              <span key={i.label} title={i.hint} className="inline-flex w-full cursor-not-allowed">
                {btn}
              </span>
            )
          }
          return btn
        })}
    </div>
  )
}
