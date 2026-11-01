import type { ReactNode } from 'react'
import { Eyebrow } from './Eyebrow'

export function StepSection({ step, label, note, actions, children }: { step: number; label: string; note?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-h-7 items-center gap-2.5">
        <span className="notch-sm flex h-5 min-w-5 items-center justify-center border border-line bg-accent/10 px-1 font-mono text-[10px] font-bold text-accent">{step}</span>
        <Eyebrow>{label}</Eyebrow>
        {note && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{note}</span>}
        <span className="h-px flex-1 bg-gradient-to-r from-line/60 to-transparent" />
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
