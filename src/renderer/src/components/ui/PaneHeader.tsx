import type { MouseEvent, ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

export function PaneHeader({ title, titleHint, count, onTitle, onTitleMenu, back, children }: { title: string; titleHint?: string; count?: number; onTitle?: () => void; onTitleMenu?: (e: MouseEvent) => void; back?: { label: string; onClick: () => void }; children?: ReactNode }) {
  return (
    <>
      {back && (
        <button onClick={back.onClick} className="flex items-center gap-1 border-b border-line/40 px-2.5 py-1.5 text-left font-mono text-[11px] text-accent hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" />
          {back.label}
        </button>
      )}
      <div className="flex items-center gap-1 border-b border-line/40 px-2.5 py-1.5">
        <button title={titleHint} onClick={onTitle} onContextMenu={onTitleMenu} className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white hover:text-accent">
          {title}
        </button>
        {count !== undefined && <span className="ml-1 font-mono text-[10.5px] text-faint">{count}</span>}
        {children && <span className="ml-auto flex items-center">{children}</span>}
      </div>
    </>
  )
}
