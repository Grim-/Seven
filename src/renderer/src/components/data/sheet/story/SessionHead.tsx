import type { ReactNode } from 'react'
import { STORY_PHASES, type StoryPhase, type StorySession } from '@shared/story'
import { cn } from '../../../../lib/cn'
import { Eyebrow, InlineEdit } from '../../../ui'

const PHASE_LABEL: Record<StoryPhase, string> = {
  session: 'Session',
  recent: 'Recent past',
  backstory: 'Backstory'
}

export function SessionHead({ session, number, onChange, actions }: { session: StorySession; number: number; onChange?: (patch: Partial<StorySession>) => void; actions?: ReactNode }) {
  const phase: StoryPhase = session.phase ?? 'session'
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {onChange ? (
        <div className="flex items-center gap-1">
          {STORY_PHASES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ phase: p })}
              className={cn(
                'border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                phase === p ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line/40 text-faint hover:text-dim'
              )}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
          <Eyebrow className="ml-1 text-accent">#{number}</Eyebrow>
        </div>
      ) : (
        <Eyebrow className="text-accent">
          {PHASE_LABEL[phase]} #{number}
        </Eyebrow>
      )}
      {onChange ? <InlineEdit value={session.date} placeholder="date" title="Date" onSave={(date) => onChange({ date })} className="font-mono text-[12px] text-faint" /> : <span className="font-mono text-[12px] text-faint">{session.date}</span>}
      {onChange ? <InlineEdit value={session.title} placeholder="Title (optional)" title="Title" onSave={(title) => onChange({ title })} className="text-[16px] font-semibold text-white" /> : session.title && <span className="text-[16px] font-semibold text-white">{session.title}</span>}
      {actions && <span className="ml-auto flex items-center gap-3">{actions}</span>}
    </div>
  )
}
