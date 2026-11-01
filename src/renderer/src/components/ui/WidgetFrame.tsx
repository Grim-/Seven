import type { ReactNode } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ShellSweep } from './ShellParts'

export function WidgetFrame({ title, tools, editing = false, compact = false, flush = false, onContextMenu, children }: { title: ReactNode; tools?: ReactNode; editing?: boolean; compact?: boolean; flush?: boolean; onContextMenu?: (e: React.MouseEvent) => void; children: ReactNode }) {
  return (
    <div className="widget-frame" data-editing={editing} onContextMenu={onContextMenu}>
      <ShellSweep />
      <header className={cn('widget-handle', compact ? 'h-6 px-2' : 'h-7 px-2.5', editing && 'cursor-grab active:cursor-grabbing')}>
        {editing && <GripVertical className="h-3.5 w-3.5 shrink-0 text-faint" />}
        {title}
        {tools && <div className="widget-actions widget-tools flex items-center gap-0.5">{tools}</div>}
      </header>
      <div className={cn('min-h-0 flex-1 overflow-auto', flush ? 'p-0' : compact ? 'px-2 pb-2 pt-1' : 'px-3 pb-3 pt-1.5')}>{children}</div>
    </div>
  )
}
