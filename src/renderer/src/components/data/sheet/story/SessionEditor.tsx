import type { ReactNode } from 'react'
import type { StorySession } from '@shared/story'
import { MarkdownEditor } from '../../MarkdownEditor'
import { SessionHead } from './SessionHead'

export function SessionEditor({ session, number, onChange, actions }: { session: StorySession; number: number; onChange: (patch: Partial<StorySession>) => void; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <SessionHead session={session} number={number} onChange={onChange} actions={actions} />
      <MarkdownEditor key={session.id} value={session.notes} onValue={(notes) => onChange({ notes })} placeholder="What happened? Write as much or as little as you like. @ links people, places, pages and files." className="min-h-48" />
    </div>
  )
}
