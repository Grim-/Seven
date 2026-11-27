import { Check, Dices } from 'lucide-react'
import type { ResolvedWorldEvent } from '@shared/game/worldEvents'
import { Button } from '../ui'

export function OutcomeChoices({ ev, busy, onResolve }: { ev: ResolvedWorldEvent; busy: boolean; onResolve: (outcomeId: string | null) => void }) {
  if (ev.resolution)
    return (
      <div className="flex flex-col gap-1 border border-ok/50 bg-ok/10 px-3 py-2">
        <span className="font-label text-[11px] caps-5 text-ok">{ev.resolution.outcomeLabel}</span>
        {ev.resolution.breakdown.length > 0 && <span className="text-[11px] text-dim">{ev.resolution.breakdown.map((b) => `${b.label} ${b.total}`).join(' · ')}</span>}
      </div>
    )
  if (!ev.hasSave)
    return (
      <div className="border border-line/50 tone-well-60 px-3 py-2 text-[11px] text-dim">
        Start or select a save for this world to resolve this event.
      </div>
    )
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {ev.outcomes.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={busy}
          onClick={() => onResolve(o.id)}
          title="Decide this outcome"
          className="flex min-w-40 flex-1 flex-col gap-0.5 border border-line/60 tone-well-60 px-3 py-2 text-left hover:border-accent disabled:opacity-50"
        >
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
            <Check className="h-3 w-3 text-accent" />
            {o.label}
          </span>
          {o.summary && <span className="text-[11px] text-dim">{o.summary}</span>}
        </button>
      ))}
      {ev.outcomes.length > 0 && (
        <Button variant="secondary" icon={<Dices />} disabled={busy} onClick={() => onResolve(null)}>
          Let fate decide
        </Button>
      )}
    </div>
  )
}
