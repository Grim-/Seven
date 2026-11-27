import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Pin, Trash2 } from 'lucide-react'
import {
  STORY_MEMORY_CATEGORIES,
  refsIn,
  type StoryMemory,
  type StoryMemoryCategory
} from '@shared/story'
import { openEntry } from '../../../../lib/library'
import { cn } from '../../../../lib/cn'
import { ChipInput, InlineEdit, TagInput, askConfirm, openMenu, type MenuItem } from '../../../ui'
import { Markdown } from '../../../chat/Markdown'
import { MarkdownEditor } from '../../MarkdownEditor'
import { RefChip } from '../story/RefChip'
import { LinkInlineEdit } from '../../LinkInlineEdit'

const CATEGORY_LABEL: Record<StoryMemoryCategory, string> = {
  memory: 'Memory',
  backstory: 'Backstory',
  recent: 'Recent',
  relationship: 'Relation',
  secret: 'Secret'
}

const CATEGORY_TONE: Record<StoryMemoryCategory, string> = {
  memory: 'border-line/60 text-dim',
  backstory: 'border-accent/40 text-accent',
  recent: 'border-secondary-ink/40 text-secondary-ink',
  relationship: 'border-ok/40 text-ok',
  secret: 'border-alert/40 text-alert'
}

interface MemoryCardProps {
  memory: StoryMemory
  editing: boolean
  onEdit: (on: boolean) => void
  onChange: (patch: Partial<StoryMemory>) => void
  onRemove: () => void
  extra: MenuItem[]
}

export function MemoryCard({ memory, editing, onEdit, onChange, onRemove, extra }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = Boolean(memory.detail?.trim())
  const refs = useMemo(
    () => refsIn([memory.summary, memory.where ?? '', ...(memory.who ?? []), expanded ? (memory.detail ?? '') : ''].join('\n')),
    [memory, expanded]
  )

  const handleContextMenu = (e: React.MouseEvent) => {
    openMenu(e, memory.summary || 'Memory', [
      { label: editing ? 'Done editing' : 'Edit', onSelect: () => onEdit(!editing) },
      { label: memory.pinned ? 'Unpin from default prompt' : 'Pin to default prompt', onSelect: () => onChange({ pinned: !memory.pinned }) },
      ...(hasDetail ? [{ label: expanded ? 'Collapse detail' : 'Expand detail', onSelect: () => setExpanded((v) => !v) }] : []),
      {
        label: 'Delete',
        danger: true,
        onSelect: () => askConfirm('Delete this memory?', `"${memory.summary}" will be removed from the character story.`, 'Delete', onRemove)
      },
      ...extra
    ])
  }

  if (editing) {
    return (
      <div onContextMenu={handleContextMenu} className="flex flex-col gap-2.5 border border-accent/40 tone-surface-30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {STORY_MEMORY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onChange({ category: cat })}
                className={cn(
                  'border px-1.5 py-0.5 font-label text-[10px] caps-5 transition-colors',
                  memory.category === cat ? 'border-accent bg-accent/15 text-ink' : 'border-line/40 text-faint hover:text-dim'
                )}
              >
                {CATEGORY_LABEL[cat]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange({ pinned: !memory.pinned })}
            title="Pinned memories stay in the default character prompt; unpinned memories only surface proactively when relevant"
            className={cn(
              'ml-auto flex items-center gap-1 border px-2 py-0.5 font-label text-[10px] caps',
              memory.pinned ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line/40 text-faint hover:text-dim'
            )}
          >
            <Pin className="h-3 w-3" />
            {memory.pinned ? 'Pinned' : 'On recall'}
          </button>
          <button type="button" onClick={() => onEdit(false)} className="font-ui text-[11px] text-accent hover:text-ink">
            Done
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Snippet summary (surfaced when relevant)</span>
          <input
            value={memory.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
            placeholder="One concise sentence, e.g. Nearly killed by a goblin horde in Blackwood Pass"
            className="h-8 border border-line/60 tone-well-60 px-2.5 text-[13px] text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="font-label text-[10px] font-bold caps-5 text-dim">Where (place link or freeform)</span>
            <LinkInlineEdit
              value={memory.where ?? ''}
              placeholder="@place:... or freeform location"
              onSave={(where) => onChange({ where: where.trim() || undefined })}
              className="border border-line/40 tone-panel-40 px-2 py-1 font-ui text-[12px] text-ink/90"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-label text-[10px] font-bold caps-5 text-dim">When</span>
            <InlineEdit
              value={memory.when ?? ''}
              placeholder="e.g. Last winter, Session 4"
              onSave={(when) => onChange({ when: when.trim() || undefined })}
              className="border border-line/40 tone-panel-40 px-2 py-1 font-ui text-[12px] text-ink/90"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="font-label text-[10px] font-bold caps-5 text-dim">Who was present</span>
            <ChipInput
              value={memory.who ?? []}
              onChange={(who) => onChange({ who: who.length ? who : undefined })}
              placeholder="Add character or NPC"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-label text-[10px] font-bold caps-5 text-dim">Recall tags</span>
            <TagInput
              value={memory.tags ?? []}
              onChange={(tags) => onChange({ tags: tags.length ? tags : undefined })}
              placeholder="Add trigger tag (e.g. goblin)"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] font-bold caps-5 text-dim">Full detail (loaded only on explicit recall)</span>
          <MarkdownEditor
            key={memory.id}
            compact
            value={memory.detail ?? ''}
            onValue={(detail) => onChange({ detail: detail.trim() ? detail : undefined })}
            placeholder="Full memory details, dialogue, scars, items, consequences. Kept out of default context until recalled."
            className="min-h-24"
          />
        </div>
      </div>
    )
  }

  return (
    <div onContextMenu={handleContextMenu} className="group flex flex-col gap-1.5 border border-line/40 tone-surface-15 px-3 py-2.5 hover:border-line/70">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('border px-1.5 py-0.5 font-label text-[10px] caps-5 ', CATEGORY_TONE[memory.category])}>
          {CATEGORY_LABEL[memory.category]}
        </span>
        {memory.pinned && (
          <span title="Pinned in default character prompt" className="flex items-center gap-1 font-label text-[10px] caps text-accent">
            <Pin className="h-3 w-3" />
            Pinned
          </span>
        )}
        {memory.when && <span className="font-ui text-[11px] text-faint">{memory.when}</span>}
        {memory.where && <span className="font-ui text-[11px] text-secondary-ink/90">@ {memory.where}</span>}
        <span className="ml-auto flex items-center gap-2">
          <span className="font-ui text-[10px] text-faint/70">{memory.id}</span>
          <span className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onChange({ pinned: !memory.pinned })}
              title={memory.pinned ? 'Unpin' : 'Pin to default prompt'}
              className={cn('font-ui text-[11px]', memory.pinned ? 'text-accent' : 'text-faint hover:text-accent')}
            >
              {memory.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button type="button" onClick={() => onEdit(true)} className="font-ui text-[11px] text-faint hover:text-accent">
              Edit
            </button>
            {extra.map((item) => (
              <button key={item.label} type="button" onClick={() => item.onSelect?.()} className="font-ui text-[11px] text-faint hover:text-accent">
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => askConfirm('Delete this memory?', `"${memory.summary}" will be removed from the character story.`, 'Delete', onRemove)}
              className="text-faint hover:text-alert"
              title="Delete memory"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        </span>
      </div>

      <div className="text-[13.5px] leading-snug text-ink/90">{memory.summary}</div>

      {(Boolean(memory.who?.length) || Boolean(memory.tags?.length) || hasDetail) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {memory.who?.map((person) => (
            <span key={person} className="border border-line/40 px-1.5 py-0.5 font-ui text-[10.5px] text-dim">
              {person}
            </span>
          ))}
          {memory.tags?.map((tag) => (
            <span key={tag} className="font-ui text-[10.5px] text-faint">
              #{tag}
            </span>
          ))}
          {hasDetail && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto flex items-center gap-1 font-ui text-[11px] text-accent/90 hover:text-accent"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {expanded ? 'Hide detail' : 'Full detail'}
            </button>
          )}
        </div>
      )}

      {expanded && hasDetail && (
        <div className="mt-1 border-t border-line/30 pt-2 text-[13px] leading-relaxed text-ink/80">
          <Markdown text={memory.detail ?? ''} onEntry={(k, ref) => (openEntry(k, ref), true)} />
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
