import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from './Button'

export function BackBar({ onBack, kind, children }: { onBack: () => void; kind?: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line/50 pb-2">
      <Button size="sm" variant="primary" icon={<ChevronLeft />} onClick={onBack} className="pl-1.5 pr-3">
        Back
      </Button>
      {kind && <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{kind}</span>}
      {children}
    </div>
  )
}
