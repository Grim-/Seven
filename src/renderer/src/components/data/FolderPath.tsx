import type { ReactNode } from 'react'
import { CornerLeftUp } from 'lucide-react'
import { showName } from '@shared/ids'
import { InlineEdit } from '../ui'
import { cn } from '../../lib/cn'

export function FolderPath({
  trail,
  current,
  rename,
  onPick,
  up,
  children
}: {
  trail: { id: string | null; title: string }[]
  current: string
  rename?: { value: string; onSave: (title: string) => void }
  onPick: (id: string | null) => void
  up?: string | null
  children?: ReactNode
}) {
  const atRoot = trail.length === 0 && !current
  return (
    <nav className="flex min-w-0 items-center gap-1 font-ui text-[11.5px]">
      {up !== undefined && (
        <button
          type="button"
          title={atRoot ? 'Already at root' : 'Up to parent folder (Alt+Up)'}
          disabled={atRoot}
          onClick={() => onPick(up ?? null)}
          className={cn(
            'mr-0.5 flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold caps-5 transition-colors',
            atRoot
              ? 'cursor-not-allowed border-line/20 tone-panel-20 text-faint opacity-40'
              : 'cursor-pointer border-line/60 tone-well-60 text-accent hover:border-accent hover:bg-accent/10 hover:text-ink'
          )}
        >
          <CornerLeftUp className="h-3 w-3" />
          <span>UP</span>
        </button>
      )}

      {/* Root button */}
      <button
        type="button"
        title="Top level (/)"
        onClick={() => onPick(null)}
        className={cn(
          'flex shrink-0 items-center border px-2 py-0.5 font-bold caps-5 transition-colors',
          atRoot
            ? 'border-accent/60 bg-accent/10 text-ink'
            : 'border-line/40 tone-well-40 text-accent-soft hover:border-accent hover:bg-accent/10 hover:text-ink'
        )}
      >
        <span className="text-[11px]">/</span>
      </button>

      {/* Trail segments */}
      {trail.map((a, i) => (
        <span key={a.id ?? `at-${i}`} className="flex min-w-0 items-center gap-1">
          <span className="text-[10px] text-faint">/</span>
          {a.id === null ? (
            <span className="flex items-center border border-line/30 tone-panel-30 px-2 py-0.5 font-bold caps-5 text-accent-soft">
              <span className="truncate text-[11px]">{showName(a.title)}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onPick(a.id)}
              className="flex min-w-0 items-center border border-line/40 tone-well-40 px-2 py-0.5 font-bold caps-5 text-accent-soft hover:border-accent hover:bg-accent/10 hover:text-ink transition-colors"
            >
              <span className="truncate text-[11px]">{showName(a.title)}</span>
            </button>
          )}
        </span>
      ))}

      {/* Current segment */}
      {current ? (
        <span className="flex min-w-0 items-center gap-1">
          <span className="text-[10px] text-faint">/</span>
          <span className="flex min-w-0 items-center border border-accent/60 bg-accent/10 px-2 py-0.5 font-bold caps-5 text-ink">
            {rename ? (
              <InlineEdit
                value={rename.value}
                shown={current}
                required
                title="Rename"
                onSave={rename.onSave}
                className="truncate text-[11px] font-bold text-ink outline-none"
              />
            ) : (
              <span className="truncate text-[11px] text-ink">{current}</span>
            )}
          </span>
        </span>
      ) : null}

      {children}
    </nav>
  )
}

