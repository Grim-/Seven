import type { ReactNode } from 'react'
import { showName } from '@shared/ids'

export function FolderPath({ trail, current, onPick, children }: { trail: { id: string; title: string }[]; current: string; onPick: (id: string | null) => void; children?: ReactNode }) {
  return (
    <nav className="flex min-w-0 items-center gap-0.5 font-mono text-[12px]">
      <button title="Top level" onClick={() => onPick(null)} className="shrink-0 px-0.5 text-accent-soft hover:text-white">
        /
      </button>
      {trail.map((a) => (
        <span key={a.id} className="flex min-w-0 items-center gap-0.5">
          <button onClick={() => onPick(a.id)} className="truncate text-accent-soft hover:text-white">
            {showName(a.title)}
          </button>
          <span className="shrink-0 text-faint">/</span>
        </span>
      ))}
      <span className="truncate text-white">{current}</span>
      {children}
    </nav>
  )
}
