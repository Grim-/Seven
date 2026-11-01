import type { MouseEvent, ReactNode } from 'react'

export function EntryHeader({ title, kind, onMenu, children }: { title: string; kind: string; onMenu?: (e: MouseEvent) => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line/40 pb-2">
      <span onContextMenu={onMenu} className="text-[16px] font-semibold text-white">
        {title}
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">{kind}</span>
      <div className="ml-auto flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
