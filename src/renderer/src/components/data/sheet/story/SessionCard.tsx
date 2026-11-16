import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Pin, Trash2 } from 'lucide-react'
import { refsIn, type StorySession } from '@shared/story'
import { Button, RowAction, askConfirm } from '../../../ui'
import { openEntry } from '../../../../lib/library'
import { cn } from '../../../../lib/cn'
import { Markdown } from '../../../chat/Markdown'
import { RefChip } from './RefChip'
import { SessionEditor } from './SessionEditor'
import { SessionHead } from './SessionHead'

export function SessionCard({
  session,
  number,
  editing,
  defaultExpanded = false,
  onEdit,
  onChange,
  onRemove
}: {
  session: StorySession
  number: number
  editing: boolean
  defaultExpanded?: boolean
  onEdit: (on: boolean) => void
  onChange: (patch: Partial<StorySession>) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(defaultExpanded || !session.summary?.trim())
  if (editing) {
    return (
      <div className="border border-accent/50 bg-black/55 p-3.5">
        <SessionEditor
          session={session}
          number={number}
          onChange={onChange}
          actions={
            <Button size="sm" variant="primary" onClick={() => onEdit(false)}>
              Done
            </Button>
          }
        />
      </div>
    )
  }

  const refs = refsIn([session.title, session.summary ?? '', session.outcome ?? '', session.where ?? '', ...(session.who ?? []), session.notes].join('\n'))
  const hasNotes = Boolean(session.notes.trim())

  return (
    <article
      className={cn(
        'group flex flex-col gap-2 border bg-black/45 p-3.5 transition-colors',
        session.pinned ? 'border-accent/45 shadow-[inset_2px_0_0_var(--color-accent)]' : 'border-line/40 hover:border-line/65'
      )}
    >
      <SessionHead
        session={session}
        number={number}
        actions={
          <div className="flex items-center gap-0.5">
            <RowAction
              icon={<Pin className={cn(session.pinned && 'text-accent')} />}
              title={session.pinned ? 'Pinned summary in prompt' : 'Pin summary to prompt'}
              onClick={() => onChange({ pinned: !session.pinned })}
            />
            <RowAction icon={<Pencil />} title="Edit entry" onClick={() => onEdit(true)} />
            <RowAction
              danger
              icon={<Trash2 />}
              title="Delete entry"
              onClick={() => askConfirm(`Delete entry #${number}?`, 'Its notes will be removed from the story.', 'Delete', onRemove)}
            />
          </div>
        }
      />

      {(session.where || session.who?.length || session.tags?.length) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {session.where && <span className="border border-cyan/30 bg-cyan/5 px-1.5 py-0.5 font-mono text-[10.5px] text-cyan">@ {session.where}</span>}
          {session.who?.map((person) => (
            <span key={person} className="border border-line/45 bg-black/60 px-1.5 py-0.5 font-mono text-[10.5px] text-white/80">
              {person}
            </span>
          ))}
          {session.tags?.map((tag) => (
            <span key={tag} className="font-mono text-[10.5px] text-faint">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {session.summary?.trim() && (
        <div className="flex items-baseline gap-2 border-l-2 border-cyan/40 pl-2.5 text-[13.5px] font-medium text-white">
          <span className="min-w-0 flex-1">{session.summary}</span>
          {hasNotes && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-accent hover:text-white"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {expanded ? 'Collapse' : 'Read full notes'}
            </button>
          )}
        </div>
      )}

      {session.outcome?.trim() && (
        <div className="border border-ok/30 bg-ok/[0.06] px-2.5 py-1.5 text-[12.5px] text-white/90">
          <span className="mr-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ok">Outcome:</span>
          {session.outcome}
        </div>
      )}

      {expanded && (
        <div className="max-w-[74ch] text-[13.5px] leading-relaxed text-white/85">
          {hasNotes ? (
            <Markdown text={session.notes} onEntry={(k, ref) => (openEntry(k, ref), true)} />
          ) : (
            <span className="font-mono text-[12px] text-faint">No full prose notes written yet.</span>
          )}
        </div>
      )}

      {refs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {refs.map((r) => (
            <RefChip key={`${r.kind}:${r.ref}`} kind={r.kind} ref={r.ref} />
          ))}
        </div>
      )}
    </article>
  )
}
