import type { MouseEvent, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function ComposerTool({ title, active, onClick, children }: { title: string; active?: boolean; onClick: (e: MouseEvent) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn('notch-sm flex h-10 w-9 shrink-0 items-center justify-center border bg-black/60 hover:border-accent hover:text-accent [&>svg]:h-4 [&>svg]:w-4', active ? 'border-accent text-accent' : 'border-line text-dim')}
    >
      {children}
    </button>
  )
}
