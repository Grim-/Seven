import type { ReactNode } from 'react'
import { cn } from '../../../../lib/cn'
import { Eyebrow } from '../../../ui'

export function Section({ title, aside, action, className, children }: { title: string; aside?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-1.5 border border-line/40 tone-panel-50 px-3 py-2.5', className)}>
      <div className="flex min-h-5 items-center gap-3">
        <Eyebrow>{title}</Eyebrow>
        {aside && <span className="font-ui text-[11px] text-dim">{aside}</span>}
        {action && <span className="ml-auto flex items-center gap-2">{action}</span>}
      </div>
      {children}
    </section>
  )
}
