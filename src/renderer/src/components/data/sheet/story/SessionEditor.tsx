import type { ReactNode } from 'react'
import { Pin } from 'lucide-react'
import type { StorySession } from '@shared/story'
import { ChipInput, TagInput } from '../../../ui'
import { cn } from '../../../../lib/cn'
import { MarkdownEditor } from '../../MarkdownEditor'
import { LinkTextarea } from '../../LinkTextarea'
import { SessionHead } from './SessionHead'

export function SessionEditor({
  session,
  number,
  onChange,
  actions
}: {
  session: StorySession
  number: number
  onChange: (patch: Partial<StorySession>) => void
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <SessionHead
        session={session}
        number={number}
        onChange={onChange}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ pinned: !session.pinned })}
              title="Pinned entries are kept as 1-line summaries in the agent prompt; unpinned entries stay archived on story_recall"
              className={cn(
                'flex items-center gap-1 border px-2 py-0.5 font-label text-[10px] caps',
                session.pinned ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line/40 text-faint hover:text-dim'
              )}
            >
              <Pin className="h-3 w-3" />
              {session.pinned ? 'Pinned' : 'Recall'}
            </button>
            {actions}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">
            Agent summary (1-line prompt / recall snippet)
          </span>
          <LinkTextarea
            rolls={false}
            rows={1}
            value={session.summary ?? ''}
            placeholder="Concise summary sentence (recommended)"
            onValue={(summary) => onChange({ summary: summary || undefined })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">
            Outcome / consequence
          </span>
          <LinkTextarea
            rolls={false}
            rows={1}
            value={session.outcome ?? ''}
            placeholder="What changed as a result? (optional)"
            onValue={(outcome) => onChange({ outcome: outcome || undefined })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Where (@place:... or text)</span>
          <LinkTextarea
            rolls={false}
            rows={1}
            value={session.where ?? ''}
            placeholder="Location"
            onValue={(where) => onChange({ where: where || undefined })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Who was involved</span>
          <ChipInput
            value={session.who ?? []}
            onChange={(who) => onChange({ who: who.length ? who : undefined })}
            placeholder="Character or NPC"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Recall tags</span>
          <TagInput
            value={session.tags ?? []}
            onChange={(tags) => onChange({ tags: tags.length ? tags : undefined })}
            placeholder="Tag (e.g. ambush, deal)"
          />
        </div>
      </div>

      <MarkdownEditor
        key={session.id}
        value={session.notes}
        onValue={(notes) => onChange({ notes })}
        placeholder="Full scene, dialogue beats, interactions, or lore notes. Use @kind:name to cross-link places, characters, or files."
        className="min-h-40"
      />
    </div>
  )
}
