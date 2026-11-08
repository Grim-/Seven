import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-0.5', wide && 'col-span-full')}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal/70">{label}</span>
      <span className="break-all text-[13px] text-white">{children}</span>
    </div>
  )
}

export function FactGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-5 gap-y-3 border border-line/50 bg-black/40 p-3.5">{children}</div>
}
