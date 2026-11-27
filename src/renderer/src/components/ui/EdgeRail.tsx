import type { ReactNode } from 'react'
import { SquareButton } from './SquareIcon'

export function EdgeRail({ children }: { children: ReactNode }) {
  return (
    <div className="group/rail absolute inset-y-0 right-0 z-30 flex w-24 items-center justify-end pr-6">
      <div className="flex flex-col items-end gap-1.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/rail:opacity-100 has-[[data-layer]]:opacity-100">
        {children}
      </div>
    </div>
  )
}

export function RailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="border border-line/50 tone-panel-75 px-1.5 py-0.5 font-label text-[9.5px] caps-18 text-dim">{label}</span>
      {children}
    </div>
  )
}

export function RailButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <RailItem label={label}>
      <SquareButton title={label} onClick={onClick} active={active}>
        {children}
      </SquareButton>
    </RailItem>
  )
}
