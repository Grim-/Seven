import { useMemo, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { NamedIcon } from '../../ui'
import { EffectSentence } from './EffectSentence'
import { groupsOf, newPiece, type PieceChoice } from './pieces'

export function EffectPalette({ choices, onPick, onClose }: { choices: PieceChoice[]; onPick: (type: string) => void; onClose: () => void }) {
  const groups = useMemo(() => groupsOf(choices), [choices])
  const [group, setGroup] = useState(groups[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const q = query.trim().toLowerCase()
  const shown = choices.filter((c) => (q ? `${c.Class.SENTENCE} ${c.Class.DESCRIPTION}`.toLowerCase().includes(q) : c.Class.GROUP?.id === group))
  const usable = shown.filter((c) => c.fits === true)
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setAt((n) => Math.max(0, Math.min(usable.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1))))
    }
    if (e.key === 'Enter' && usable[at]) onPick(usable[at].Class.type)
  }
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line/50 px-3 py-2">
        <span className="flex-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent-soft">Add an effect</span>
        <button type="button" title="Close" onClick={onClose} className="text-dim hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 phone:flex-col">
        <nav className="flex w-40 shrink-0 flex-col border-r border-line/50 py-1 phone:w-auto phone:flex-row phone:overflow-x-auto phone:border-b phone:border-r-0">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setGroup(g.id)
                setQuery('')
                setAt(0)
              }}
              style={{ ['--tone' as string]: g.tone }}
              className={cn('flex items-center gap-2 whitespace-nowrap border-l-2 px-3 py-2 text-left text-[12.5px]', !q && g.id === group ? 'border-l-[var(--tone)] bg-white/[0.03] text-white' : 'border-l-transparent text-dim hover:text-white')}
            >
              <i className="h-2 w-2 bg-[var(--tone)]" />
              {g.label}
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
          <input
            autoFocus
            value={query}
            placeholder="Search all effects"
            onChange={(e) => {
              setQuery(e.target.value)
              setAt(0)
            }}
            onKeyDown={keys}
            className="mb-1 h-8 border border-line/60 bg-black/40 px-2.5 text-[13px] text-white outline-none placeholder:text-faint focus:border-accent/70"
          />
          <div className="flex max-h-[22rem] flex-col gap-1 overflow-y-auto">
            {shown.map((c) => {
              const why = c.fits === true ? null : c.fits
              return (
                <button
                  key={c.Class.type}
                  type="button"
                  disabled={why !== null}
                  onClick={() => onPick(c.Class.type)}
                  style={{ ['--tone' as string]: c.Class.GROUP?.tone ?? 'var(--color-line)' }}
                  className={cn('flex gap-3 border px-3 py-2 text-left', why ? 'cursor-not-allowed border-transparent opacity-45' : usable[at] === c ? 'border-[color-mix(in_srgb,var(--tone)_55%,transparent)] bg-[color-mix(in_srgb,var(--tone)_8%,transparent)]' : 'border-transparent hover:border-[color-mix(in_srgb,var(--tone)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--tone)_8%,transparent)]')}
                >
                  <NamedIcon name={c.Class.ICON} className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--tone)]" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] leading-6 text-white/85">
                      <EffectSentence def={newPiece(c.Class.type)} />
                    </span>
                    <span className="text-[12px] text-dim">{c.Class.DESCRIPTION}</span>
                    {why && <span className="font-mono text-[11px] text-alert">Can't go here: {why}.</span>}
                  </span>
                </button>
              )
            })}
            {!shown.length && <span className="px-2 py-2 text-[12.5px] text-dim">No effect matches.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
