import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { hitDetail, type LibraryHit } from '@shared/types'
import { showName } from '@shared/ids'
import { engine } from '../../lib/ipc'
import { cn } from '../../lib/cn'
import { kindUi } from '../../registries/kinds'
import { useEscapeLayer } from '../../lib/escape'

export function EntryPicker({ kind, title, onPick, onClose, inline = false }: { kind: string | null; title: string; onPick: (hit: LibraryHit) => void; onClose: () => void; inline?: boolean }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LibraryHit[] | null>(null)
  const [pick, setPick] = useState(0)
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      void engine('library.find', { query, kind })
        .then((h) => live && (setHits(h.slice(0, 12)), setPick(0)))
        .catch(() => live && setHits([]))
    }, 120)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, kind])
  const list = hits ?? []
  useEscapeLayer(true, onClose)
  return (
    <div data-layer className={cn('flex flex-col border border-accent/70 bg-black/95 shadow-[0_8px_24px_rgba(0,0,0,0.6)]', inline ? 'notch w-full' : 'absolute right-0 top-full z-40 mt-1 w-80')} onMouseDown={(e) => e.preventDefault()}>
      <div className="flex items-center gap-2 border-b border-line/50 px-2 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-soft">{title}</span>
        <button title="Close" onClick={onClose} className="ml-auto text-dim hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (list.length) setPick((pick + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length)
          } else if (e.key === 'Enter' && list[pick]) {
            e.preventDefault()
            onPick(list[pick])
          }
        }}
        placeholder="Search…"
        className="border-b border-line/40 bg-transparent px-2.5 py-2 text-[13px] text-white outline-none"
      />
      <div className="max-h-72 overflow-y-auto py-1">
        {hits === null && <div className="px-2.5 py-1.5 font-mono text-[11px] text-dim">Looking…</div>}
        {hits !== null && !list.length && <div className="px-2.5 py-1.5 text-[12px] text-faint">{(kind && kindUi(kind).emptyText) || 'Nothing matches.'}</div>}
        {list.map((h, i) => (
          <button
            key={`${h.kind}/${h.id}`}
            onMouseEnter={() => setPick(i)}
            onClick={() => onPick(h)}
            className={cn('flex w-full flex-col border-l-2 px-2.5 py-1 text-left', i === pick ? 'border-l-accent bg-accent/15' : 'border-l-transparent')}
          >
            <span className="truncate text-[13px] text-white">{showName(h.title)}</span>
            <span className="truncate text-[11px] text-dim">{kind ? hitDetail(h) : `${h.kind}${hitDetail(h) ? ` · ${hitDetail(h)}` : ''}`}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
