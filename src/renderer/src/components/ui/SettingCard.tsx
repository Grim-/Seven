import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ShellSweep } from './ShellParts'

const InCard = createContext(false)

export function useInSettingCard(): boolean {
  return useContext(InCard)
}

export function SettingCard({ title, count, actions, intro, className, children }: { title?: ReactNode; count?: number; actions?: ReactNode; intro?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <section className={cn('setting-card', className)}>
      <ShellSweep />
      {(title || actions) && (
        <header className="setting-card-head">
          {title}
          {count !== undefined && <span className="font-normal tracking-[0.1em] text-faint">{count}</span>}
          <span className="ml-auto flex items-center gap-1.5 normal-case tracking-normal">{actions}</span>
        </header>
      )}
      {intro && <div className="border-b border-line/20 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-dim">{intro}</div>}
      <InCard.Provider value={true}>{children}</InCard.Provider>
    </section>
  )
}
