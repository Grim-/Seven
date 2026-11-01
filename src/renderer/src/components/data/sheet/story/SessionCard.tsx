import { refsIn, type StorySession } from '@shared/story'
import { askConfirm } from '../../../ui'
import { openEntry } from '../../../../lib/library'
import { Markdown } from '../../../chat/Markdown'
import { RefChip } from './RefChip'
import { SessionEditor } from './SessionEditor'
import { SessionHead } from './SessionHead'

export function SessionCard({ session, number, editing, onEdit, onChange, onRemove }: { session: StorySession; number: number; editing: boolean; onEdit: (on: boolean) => void; onChange: (patch: Partial<StorySession>) => void; onRemove: () => void }) {
  const action = 'font-mono text-[11px] text-faint hover:text-accent'
  if (editing)
    return (
      <div className="border-t border-line/40 py-4">
        <SessionEditor session={session} number={number} onChange={onChange} actions={<button onClick={() => onEdit(false)} className={action}>Done</button>} />
      </div>
    )
  const refs = refsIn(`${session.title}\n${session.notes}`)
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
      <div className="max-w-[70ch] text-[14px] leading-relaxed text-white/85">{session.notes.trim() ? <Markdown text={session.notes} onEntry={(k, ref) => (openEntry(k, ref), true)} /> : <span className="text-faint">No notes.</span>}</div>
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
