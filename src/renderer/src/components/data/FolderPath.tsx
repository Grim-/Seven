import type { ReactNode } from 'react'
import { showName } from '@shared/ids'
import { InlineEdit } from '../ui'

export function FolderPath({
  trail,
  current,
  rename,
  onPick,
  children
}: {
  trail: { id: string | null; title: string }[]
  current: string
  rename?: { value: string; onSave: (title: string) => void }
  onPick: (id: string | null) => void
  children?: ReactNode
}) {
  return (
    <nav className="flex min-w-0 items-center gap-0.5 font-mono text-[12px]">
      <button title="Top level" onClick={() => onPick(null)} className="shrink-0 px-0.5 text-accent-soft hover:text-white">
        /
      </button>
      {trail.map((a, i) => (
        <span key={a.id ?? `at-${i}`} className="flex min-w-0 items-center gap-0.5">
          {a.id === null ? (
            <span className="truncate text-accent-soft">{showName(a.title)}</span>
          ) : (
            <button onClick={() => onPick(a.id)} className="truncate text-accent-soft hover:text-white">
              {showName(a.title)}
            </button>
          )}
          <span className="shrink-0 text-faint">/</span>
        </span>
      ))}
      {rename ? <InlineEdit value={rename.value} shown={current} required title="Rename" onSave={rename.onSave} className="font-semibold text-white" /> : <span className="truncate text-white">{current}</span>}
      {children}
    </nav>
  )
}
