import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Pin, Plus, Trash2 } from 'lucide-react'
import {
  STORY_THREAD_KINDS,
  STORY_THREAD_STATUSES,
  newThread,
  type Story,
  type StoryThread,
  type StoryThreadKind,
  type StoryThreadStatus
} from '@shared/story'
import { Button, ChipInput, InlineEdit, RowAction, Segmented, StatusBadge, askConfirm } from '../../../ui'
import { cn } from '../../../../lib/cn'

const KIND_LABEL: Record<StoryThreadKind, string> = {
  arc: 'Arc',
  goal: 'Goal',
  mystery: 'Mystery',
  bond: 'Bond',
  threat: 'Threat'
}

const STATUS_META: Record<StoryThreadStatus, { label: string; tone: 'ok' | 'busy' | 'warn' | 'idle' }> = {
  active: { label: 'Active', tone: 'ok' },
  waiting: { label: 'Waiting', tone: 'warn' },
  resolved: { label: 'Resolved', tone: 'idle' },
  dropped: { label: 'Dropped', tone: 'idle' }
}

const NEXT_STATUS: Record<StoryThreadStatus, StoryThreadStatus> = {
  active: 'waiting',
  waiting: 'resolved',
  resolved: 'active',
  dropped: 'active'
}

export function threadStatus(t: StoryThread): StoryThreadStatus {
  return t.status ?? (t.done ? 'resolved' : 'active')
}

export function StoryThreads({
  story,
  onChange,
  query = ''
}: {
  story: Story
  onChange: (story: Story) => void
  query?: string
}) {
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftKind, setDraftKind] = useState<StoryThreadKind>('arc')
  const [draftDetail, setDraftDetail] = useState('')

  const setThreads = (threads: StoryThread[]) => onChange({ ...story, threads })

  const updateAt = (idx: number, patch: Partial<StoryThread>) => {
    const cur = story.threads[idx]
    if (!cur) return
    const nextStatus = patch.status ?? cur.status ?? (patch.done ? 'resolved' : cur.done ? 'resolved' : 'active')
    const nextDone = patch.done !== undefined ? patch.done : nextStatus === 'resolved' || nextStatus === 'dropped'
    setThreads(
      story.threads.map((t, i) =>
        i === idx ? { ...t, ...patch, status: nextStatus, done: nextDone } : t
      )
    )
  }

  const create = () => {
    const title = draftTitle.trim()
    if (!title) return
    const created = newThread({ text: title, kind: draftKind, detail: draftDetail })
    setThreads([...story.threads, created])
    setDraftTitle('')
    setDraftDetail('')
    setAdding(false)
    setExpanded(created.id ?? null)
  }

  const q = query.trim().toLowerCase()
  const rows = story.threads
    .map((t, i) => ({ t, i, status: threadStatus(t), key: t.id ?? `idx_${i}` }))
    .filter(({ t, status }) => {
      if (filter === 'open' && (status === 'resolved' || status === 'dropped')) return false
      if (filter === 'resolved' && status !== 'resolved' && status !== 'dropped') return false
      if (!q) return true
      return [t.text, t.detail ?? '', t.where ?? '', ...(t.who ?? []), t.kind ?? ''].join(' ').toLowerCase().includes(q)
    })

  const activeCount = story.threads.filter((t) => {
    const s = threadStatus(t)
    return s === 'active' || s === 'waiting'
  }).length

  return (
    <section className="flex flex-col gap-2.5 border border-line/45 bg-black/40 p-3.5">
      <div className="flex flex-wrap items-center gap-2 border-b border-line/35 pb-2">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
          Story Threads &amp; Arcs
        </span>
        <span className="font-mono text-[11px] text-dim">{activeCount} open</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'open', label: `Open (${activeCount})` },
              { value: 'resolved', label: `Closed (${story.threads.length - activeCount})` },
              { value: 'all', label: 'All' }
            ]}
          />
          <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setAdding((v) => !v)}>
            Add thread
          </Button>
        </div>
      </div>

      {adding && (
        <div className="flex flex-col gap-2 border border-accent/45 bg-black/60 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STORY_THREAD_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDraftKind(k)}
                className={cn(
                  'border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                  draftKind === k ? 'border-accent bg-accent/15 text-accent' : 'border-line/40 text-faint hover:text-dim'
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Thread or personal arc (e.g. Uncover who burned the crystal foundry)"
            className="h-8 border border-line/60 bg-black/70 px-2.5 text-[13px] text-white outline-none focus:border-accent"
            autoFocus
          />
          <textarea
            value={draftDetail}
            onChange={(e) => setDraftDetail(e.target.value)}
            rows={2}
            placeholder="Context, stakes, or next beat (optional)"
            className="border border-line/50 bg-black/70 px-2.5 py-1.5 text-[12.5px] text-white/90 outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" icon={<Check />} disabled={!draftTitle.trim()} onClick={create}>
              Save thread
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-1 font-mono text-[11.5px] text-faint">
          {q ? 'No threads match that filter.' : filter === 'open' ? 'No active story threads yet — track quests, mysteries, promises, or personal arcs here.' : 'No threads here yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map(({ t, i, status, key }) => {
            const meta = STATUS_META[status]
            const isOpen = expanded === key
            const kind = t.kind ?? 'arc'
            return (
              <div
                key={key}
                className={cn(
                  'flex flex-col border bg-black/50 transition-colors',
                  t.done ? 'border-line/30 opacity-70' : 'border-line/45 hover:border-line/70'
                )}
              >
                <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
                  <button
                    type="button"
                    title="Cycle thread status"
                    onClick={() => updateAt(i, { status: NEXT_STATUS[status] })}
                    className="shrink-0"
                  >
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  </button>
                  <span className="border border-line/50 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-cyan">
                    {KIND_LABEL[kind]}
                  </span>
                  <div className="min-w-[10rem] flex-1">
                    <InlineEdit
                      value={t.text}
                      required
                      onSave={(text) => updateAt(i, { text })}
                      className={cn('text-[13px] font-medium', t.done ? 'text-faint line-through' : 'text-white')}
                    />
                  </div>
                  {t.where && <span className="font-mono text-[11px] text-cyan/80">@ {t.where}</span>}
                  {t.who && t.who.length > 0 && (
                    <span className="font-mono text-[11px] text-dim">{t.who.join(', ')}</span>
                  )}
                  <div className="flex items-center gap-0.5">
                    <RowAction
                      icon={<Pin className={cn(t.pinned && 'text-accent')} />}
                      title={t.pinned ? 'Pinned in default prompt' : 'Pin thread'}
                      onClick={() => updateAt(i, { pinned: !t.pinned })}
                    />
                    <RowAction
                      icon={isOpen ? <ChevronDown /> : <ChevronRight />}
                      title={isOpen ? 'Collapse details' : 'Edit details, people, & context'}
                      onClick={() => setExpanded(isOpen ? null : key)}
                    />
                    <RowAction
                      danger
                      icon={<Trash2 />}
                      title="Delete thread"
                      onClick={() =>
                        askConfirm(`Delete thread "${t.text}"?`, 'It will be removed from the character story.', 'Delete', () =>
                          setThreads(story.threads.filter((_, j) => j !== i))
                        )
                      }
                    />
                  </div>
                </div>

                {!isOpen && t.detail && (
                  <div className="border-t border-line/20 px-3 py-1.5 text-[12px] text-dim">{t.detail}</div>
                )}

                {isOpen && (
                  <div className="flex flex-col gap-2.5 border-t border-line/35 bg-black/40 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        {STORY_THREAD_KINDS.map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => updateAt(i, { kind: k })}
                            className={cn(
                              'border px-1.5 py-0.5 font-mono text-[10px] uppercase',
                              kind === k ? 'border-cyan bg-cyan/15 text-cyan' : 'border-line/40 text-faint hover:text-dim'
                            )}
                          >
                            {KIND_LABEL[k]}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        {STORY_THREAD_STATUSES.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => updateAt(i, { status: st })}
                            className={cn(
                              'border px-1.5 py-0.5 font-mono text-[10px] uppercase',
                              status === st ? 'border-accent bg-accent/15 text-accent' : 'border-line/40 text-faint hover:text-dim'
                            )}
                          >
                            {STATUS_META[st].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-dim">Context, stakes &amp; next beat</span>
                      <InlineEdit
                        value={t.detail ?? ''}
                        placeholder="Why this thread matters, clues found so far, or next step..."
                        onSave={(detail) => updateAt(i, { detail: detail.trim() || undefined })}
                        className="border border-line/40 bg-black/50 px-2 py-1 text-[12.5px] text-white/90"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-dim">Where (@place:... or freeform)</span>
                        <InlineEdit
                          value={t.where ?? ''}
                          placeholder="Associated location"
                          onSave={(where) => updateAt(i, { where: where.trim() || undefined })}
                          className="border border-line/40 bg-black/50 px-2 py-1 font-mono text-[12px] text-white/90"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-dim">Who is involved</span>
                        <ChipInput
                          value={t.who ?? []}
                          onChange={(who) => updateAt(i, { who: who.length ? who : undefined })}
                          placeholder="Add character or faction"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
