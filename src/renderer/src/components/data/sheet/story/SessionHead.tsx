import type { ReactNode } from 'react'
import { STORY_ENTRY_KINDS, STORY_PHASES, type StoryEntryKind, type StoryPhase, type StorySession } from '@shared/story'
import { cn } from '../../../../lib/cn'
import { Eyebrow, InlineEdit, StatusBadge } from '../../../ui'

const PHASE_LABEL: Record<StoryPhase, string> = {
  session: 'Session',
  recent: 'Recent past',
  backstory: 'Backstory'
}

const ENTRY_KIND_LABEL: Record<StoryEntryKind, string> = {
  scene: 'Scene',
  interaction: 'Interaction',
  milestone: 'Milestone',
  downtime: 'Downtime'
}

export function SessionHead({
  session,
  number,
  onChange,
  actions
}: {
  session: StorySession
  number: number
  onChange?: (patch: Partial<StorySession>) => void
  actions?: ReactNode
}) {
  const phase: StoryPhase = session.phase ?? 'session'
  const entryKind: StoryEntryKind = session.kind ?? 'scene'
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {onChange ? (
        <div className="flex flex-wrap items-center gap-1.5">
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
          </div>
          {phase !== 'backstory' && (
            <div className="flex items-center gap-1 border-l border-line/35 pl-2">
              {STORY_ENTRY_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChange({ kind: k })}
                  className={cn(
                    'border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                    entryKind === k ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-line/40 text-faint hover:text-dim'
                  )}
                >
                  {ENTRY_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          )}
          <Eyebrow className="ml-1 text-accent">#{number}</Eyebrow>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <StatusBadge tone={phase === 'backstory' ? 'busy' : entryKind === 'interaction' ? 'ok' : 'idle'}>
            {phase === 'backstory' ? 'Backstory' : ENTRY_KIND_LABEL[entryKind]}
          </StatusBadge>
          <Eyebrow className="text-accent">#{number}</Eyebrow>
        </div>
      )}

      {onChange ? (
        <InlineEdit
          value={session.date}
          placeholder="date / era"
          title="Date or timeframe"
          onSave={(date) => onChange({ date })}
          className="font-mono text-[12px] text-faint"
        />
      ) : (
        session.date && <span className="font-mono text-[11.5px] text-faint">{session.date}</span>
      )}

      {onChange ? (
        <InlineEdit
          value={session.title}
          placeholder="Title (optional)"
          title="Title"
          onSave={(title) => onChange({ title })}
          className="text-[15px] font-semibold text-white"
        />
      ) : (
        session.title && <span className="text-[15px] font-semibold text-white">{session.title}</span>
      )}

      {actions && <span className="ml-auto flex items-center gap-2">{actions}</span>}
    </div>
  )
}
