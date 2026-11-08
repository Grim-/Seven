import type { ReactNode } from 'react'
import { Eyebrow } from '../../components/ui'
import { cn } from '../../lib/cn'

export function GamePanel({ title, aside, action, className, bodyClassName, children }: { title: string; aside?: ReactNode; action?: ReactNode; className?: string; bodyClassName?: string; children: ReactNode }) {
  return (
    <section className={cn('flex min-w-0 flex-col border border-line/45 bg-white/[0.015]', className)}>
      <header className="flex min-h-8 items-center gap-3 border-b border-line/35 bg-black/40 px-3">
        <Eyebrow>{title}</Eyebrow>
        {aside && <span className="font-mono text-[11px] text-dim">{aside}</span>}
        {action && <span className="ml-auto flex items-center gap-2">{action}</span>}
      </header>
      <div className={cn('flex flex-col gap-1.5 p-3', bodyClassName)}>{children}</div>
    </section>
  )
}
