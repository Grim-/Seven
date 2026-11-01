import type { ReactNode } from 'react'
import type { StorySession } from '@shared/story'
import { Eyebrow, InlineEdit } from '../../../ui'

export function SessionHead({ session, number, onChange, actions }: { session: StorySession; number: number; onChange?: (patch: Partial<StorySession>) => void; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <Eyebrow className="text-accent">Session {number}</Eyebrow>
      {onChange ? <InlineEdit value={session.date} placeholder="date" title="Date" onSave={(date) => onChange({ date })} className="font-mono text-[12px] text-faint" /> : <span className="font-mono text-[12px] text-faint">{session.date}</span>}
      {onChange ? <InlineEdit value={session.title} placeholder="Title (optional)" title="Title" onSave={(title) => onChange({ title })} className="text-[16px] font-semibold text-white" /> : session.title && <span className="text-[16px] font-semibold text-white">{session.title}</span>}
      {actions && <span className="ml-auto flex items-center gap-3">{actions}</span>}
    </div>
  )
}
