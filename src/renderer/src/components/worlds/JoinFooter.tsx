import type { ReactNode } from 'react'
import { Button } from '../ui'
import { cn } from '../../lib/cn'

export function JoinFooter({ note, loud = false, busy, onCancel, children }: { note: string; loud?: boolean; busy: boolean; onCancel: () => void; children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-line/60 pt-3 phone:flex-wrap">
      <span className={cn('mr-auto min-w-0 truncate text-[12px]', loud ? 'text-accent' : 'text-dim')} title={note}>
        {note}
      </span>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      {children}
    </div>
  )
}
