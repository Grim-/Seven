import type { ReactNode } from 'react'
import type { StorySession } from '@shared/story'
import { ChipInput, InlineEdit, TagInput } from '../../../ui'
import { MarkdownEditor } from '../../MarkdownEditor'
import { SessionHead } from './SessionHead'

export function SessionEditor({ session, number, onChange, actions }: { session: StorySession; number: number; onChange: (patch: Partial<StorySession>) => void; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <SessionHead session={session} number={number} onChange={onChange} actions={actions} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-dim">Summary snippet (used for recall index)</span>
          <InlineEdit
            value={session.summary ?? ''}
            placeholder="Concise 1-line summary (optional)"
            onSave={(summary) => onChange({ summary: summary.trim() || undefined })}
            className="border border-line/40 bg-black/40 px-2 py-1 text-[12.5px] text-white/90"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-dim">Where (@place:... or freeform)</span>
          <InlineEdit
            value={session.where ?? ''}
            placeholder="Location where this happened"
            onSave={(where) => onChange({ where: where.trim() || undefined })}
            className="border border-line/40 bg-black/40 px-2 py-1 font-mono text-[12px] text-white/90"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-dim">Who was present</span>
          <ChipInput
            value={session.who ?? []}
            onChange={(who) => onChange({ who: who.length ? who : undefined })}
            placeholder="Add character or NPC"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-dim">Recall tags</span>
          <TagInput
            value={session.tags ?? []}
            onChange={(tags) => onChange({ tags: tags.length ? tags : undefined })}
            placeholder="Add tag (e.g. ambush)"
          />
        </div>
      </div>
      <MarkdownEditor key={session.id} value={session.notes} onValue={(notes) => onChange({ notes })} placeholder="What happened? Write as much or as little as you like. @ links people, places, pages and files." className="min-h-48" />
    </div>
  )
}
