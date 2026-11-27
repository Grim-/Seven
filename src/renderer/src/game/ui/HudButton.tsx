import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function HudButton({ icon, label, keyHint, active, onClick }: { icon: ReactNode; label: string; keyHint?: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" title={keyHint ? `${label} (${keyHint})` : label} onClick={onClick} className={cn('relative flex h-10 w-10 items-center justify-center border tone-well-90 transition-colors [&_svg]:h-[18px] [&_svg]:w-[18px]', active ? 'border-accent bg-accent/20 text-accent' : 'border-line/60 text-dim hover:border-accent/60 hover:text-ink')}>
      {icon}
      {keyHint && <span className="absolute bottom-0 right-0.5 font-ui text-[9px] font-bold text-faint">{keyHint}</span>}
    </button>
  )
}
