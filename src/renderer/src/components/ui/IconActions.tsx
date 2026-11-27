import { cn } from '../../lib/cn'
import { usableItems, type MenuItem } from './ContextMenu'
import { RowAction } from './ListRow'

export function IconActions({ items, className }: { items: MenuItem[]; className?: string }) {
  return (
    <span className={cn('flex items-center', className)}>
      {usableItems(items)
        .filter((i) => i.icon && i.onSelect)
        .map((i) => (
          <RowAction key={i.label} title={i.hint ? `${i.label} (${i.hint})` : i.label} icon={i.icon} danger={i.danger} disabled={i.disabled} onClick={() => i.onSelect?.()} />
        ))}
    </span>
  )
}
