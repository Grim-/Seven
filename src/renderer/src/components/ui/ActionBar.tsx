import { Button } from './Button'
import { openMenu, type MenuItem } from './ContextMenu'
import { cn } from '../../lib/cn'

export function ActionBar({ items, className }: { items: MenuItem[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-1.5', className)}>
      {items
        .filter((i) => !i.separator && i.label)
        .map((i) => (
          <Button key={i.label} size="sm" variant={i.danger ? 'danger' : 'secondary'} icon={i.icon} disabled={i.disabled} onClick={(e) => (i.children ? openMenu(e, i.label, i.children) : i.onSelect?.())} className="justify-start">
            <span className="truncate">{i.label}</span>
          </Button>
        ))}
    </div>
  )
}
