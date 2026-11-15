import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { refsIn, type StorySession } from '@shared/story'
import { askConfirm } from '../../../ui'
import { openEntry } from '../../../../lib/library'
import { Markdown } from '../../../chat/Markdown'
import { RefChip } from './RefChip'
import { SessionEditor } from './SessionEditor'
import { SessionHead } from './SessionHead'

export function SessionCard({ session, number, editing, onEdit, onChange, onRemove }: { session: StorySession; number: number; editing: boolean; onEdit: (on: boolean) => void; onChange: (patch: Partial<StorySession>) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(!session.summary?.trim())
  const action = 'font-mono text-[11px] text-faint hover:text-accent'
  if (editing)
    return (
      <div className="border-t border-line/40 py-4">
        <SessionEditor session={session} number={number} onChange={onChange} actions={<button onClick={() => onEdit(false)} className={action}>Done</button>} />
      </div>
    )
  const refs = refsIn([session.title, session.summary ?? '', session.where ?? '', ...(session.who ?? []), session.notes].join('\n'))
  return (
    <div className="group flex flex-col gap-1.5 border-t border-line/40 py-4">
      <SessionHead
        session={session}
        number={number}
        actions={
          <span className="flex gap-3 opacity-0 group-hover:opacity-100">
            <button onClick={() => onEdit(true)} className={action}>Edit</button>
            <button onClick={() => askConfirm(`Delete session ${number}?`, 'Its notes are removed from the story.', 'Delete', onRemove)} className="font-mono text-[11px] text-faint hover:text-alert">Delete</button>
          </span>
        }
      />
      {(session.where || session.who?.length || session.tags?.length) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {session.where && <span className="font-mono text-[11px] text-cyan/90">@ {session.where}</span>}
          {session.who?.map((person) => (
            <span key={person} className="border border-line/40 px-1.5 py-0.5 font-mono text-[10.5px] text-dim">{person}</span>
          ))}
          {session.tags?.map((tag) => (
            <span key={tag} className="font-mono text-[10.5px] text-faint">#{tag}</span>
          ))}
        </div>
      )}
      {session.summary?.trim() && (
        <div className="flex items-center gap-2 text-[13.5px] text-white/90">
          <span>{session.summary}</span>
          {session.notes.trim() && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[11px] text-accent/90 hover:text-accent">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {expanded ? 'Hide log' : 'Full log'}
            </button>
          )}
        </div>
      )}
      {expanded && (
        <div className="max-w-[70ch] text-[14px] leading-relaxed text-white/85">
          {session.notes.trim() ? <Markdown text={session.notes} onEntry={(k, ref) => (openEntry(k, ref), true)} /> : <span className="text-faint">No notes.</span>}
        </div>
      )}
      {refs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {refs.map((r) => (
            <RefChip key={`${r.kind}:${r.ref}`} kind={r.kind} ref={r.ref} />
          ))}
        </div>
      )}
    </div>
  )
}
