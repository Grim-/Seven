import { useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Clock, Eye, Plus, Sparkles } from 'lucide-react'
import {
  mindMemoriesText,
  newSession,
  storyText,
  type Story,
  type StoryPhase,
  type StorySession
} from '@shared/story'
import type { CharacterMind, CharacterSheet } from '@shared/types'
import { cn } from '../../../../lib/cn'
import { Button, Eyebrow, Modal, Segmented, ShellTabs, StatusBadge } from '../../../ui'
import { SessionCard } from './SessionCard'
import { SessionEditor } from './SessionEditor'
import { StoryBackstory } from './StoryBackstory'
import { StoryCastSidebar } from './StoryCastSidebar'
import { StoryNow } from './StoryNow'
import { StoryThreads } from './StoryThreads'

type StoryViewTab = 'chronicle' | 'backstory' | 'events'

export function StoryTab({
  sheet,
  story,
  mind,
  profile,
  compact = false,
  onChange,
  onMindChange,
  onOpenFacet
}: {
  sheet?: CharacterSheet
  story: Story
  mind?: CharacterMind | null
  profile?: ReactNode
  compact?: boolean
  onChange: (story: Story) => void
  onMindChange?: (next: CharacterMind | null) => void
  onOpenFacet?: (facet: string) => void
}) {
  const [tab, setTab] = useState<StoryViewTab>('chronicle')
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest')
  const [kindFilter, setKindFilter] = useState<'all' | 'scene' | 'interaction' | 'milestone'>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [composing, setComposing] = useState<StorySession | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const sessions = story.sessions
  const memories = mind?.memories ?? []
  const relationships = sheet?.relationships ?? []

  const setSession = (id: string, patch: Partial<StorySession>) =>
    onChange({ ...story, sessions: sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) })

  const openComposer = (phase: StoryPhase = 'session') => {
    setComposing(newSession(undefined, { phase, kind: phase === 'backstory' ? undefined : 'scene' }))
  }

  const saveComposer = () => {
    if (!composing) return
    onChange({ ...story, sessions: [...sessions, composing] })
    setComposing(null)
    if (composing.phase === 'backstory') setTab('backstory')
    else setTab('chronicle')
  }

  const q = query.trim().toLowerCase()
  const chroniclePool = useMemo(() => {
    const numbered = sessions
      .map((s, i) => ({ s, n: i + 1 }))
      .filter(({ s }) => s.phase !== 'backstory')
      .filter(({ s }) => kindFilter === 'all' || (s.kind ?? 'scene') === kindFilter)
      .filter(({ s }) =>
        !q
          ? true
          : [s.title, s.summary ?? '', s.outcome ?? '', s.where ?? '', s.kind ?? '', ...(s.who ?? []), ...(s.tags ?? []), s.notes]
              .join('\n')
              .toLowerCase()
              .includes(q)
      )
    return order === 'newest' ? [...numbered].reverse() : numbered
  }, [sessions, kindFilter, order, q])

  const eventMemories = useMemo(() => {
    return memories
      .filter((m) => m.category !== 'backstory' && m.category !== 'secret')
      .filter((m) =>
        !q ? true : [m.summary, m.detail ?? '', m.where ?? '', ...(m.who ?? []), ...(m.tags ?? [])].join('\n').toLowerCase().includes(q)
      )
      .slice()
      .reverse()
  }, [memories, q])

  const promptPreview = useMemo(() => {
    const sText = storyText(story, false)
    const mText = mindMemoriesText(memories)
    return [sText, mText].filter(Boolean).join('\n\n')
  }, [story, memories])

  return (
    <div
      className={cn(
        'mx-auto grid w-full max-w-[1360px] grid-cols-1 items-start',
        compact ? 'gap-3 pt-2' : 'gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_20rem]'
      )}
    >
      <main className="flex min-w-0 flex-col gap-5">
        <section className="flex flex-col gap-3 border border-accent/45 bg-black/50 p-4 shadow-[inset_3px_0_0_var(--color-accent)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow className="text-accent">Present Situation &amp; Active Scene</Eyebrow>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" icon={<Eye />} onClick={() => setPreviewOpen(true)}>
                Agent view
              </Button>
              <Button size="sm" variant="primary" icon={<Plus />} onClick={() => openComposer('session')}>
                Log scene / interaction
              </Button>
            </div>
          </div>
          <StoryNow story={story} onChange={onChange} large />
        </section>

        <ShellTabs
          value={tab}
          onChange={(v) => setTab(v as StoryViewTab)}
          options={[
            {
              value: 'chronicle',
              label: profile ? 'Profile & Chronicle' : 'Chronicle & Threads',
              icon: <BookOpen />,
              count: sessions.filter((s) => s.phase !== 'backstory').length
            },
            {
              value: 'backstory',
              label: 'Backstory & Lore',
              icon: <Sparkles />,
              count: sessions.filter((s) => s.phase === 'backstory').length
            },
            {
              value: 'events',
              label: 'Memories & Events',
              icon: <Clock />,
              count: eventMemories.length
            }
          ]}
        />

        {tab === 'chronicle' && (
          <div className="flex flex-col gap-5">
            {profile}
            <StoryThreads story={story} onChange={onChange} query={query} />

            <section className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-2">
                <Eyebrow>{q ? `${chroniclePool.length} matching scenes` : `Story Chronicle (${chroniclePool.length})`}</Eyebrow>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    value={kindFilter}
                    onChange={setKindFilter}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'scene', label: 'Scenes' },
                      { value: 'interaction', label: 'Interactions' },
                      { value: 'milestone', label: 'Milestones' }
                    ]}
                  />
                  <Segmented
                    value={order}
                    onChange={setOrder}
                    options={[
                      { value: 'newest', label: 'Newest' },
                      { value: 'oldest', label: 'Chronological' }
                    ]}
                  />
                </div>
              </div>

              {chroniclePool.length === 0 ? (
                <div className="flex flex-col items-start gap-2.5 border border-line/40 bg-black/35 p-4">
                  <div className="text-[13px] text-dim">
                    {q || kindFilter !== 'all'
                      ? 'No chronicle entries match the current filter.'
                      : 'No scenes or interactions logged yet. Record what happens session-by-session cleanly for both you and the agent.'}
                  </div>
                  <Button size="sm" variant="primary" icon={<Plus />} onClick={() => openComposer('session')}>
                    Log first scene
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {chroniclePool.map(({ s, n }, idx) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      number={n}
                      editing={editing === s.id}
                      defaultExpanded={idx === 0 && order === 'newest'}
                      onEdit={(on) => setEditing(on ? s.id : null)}
                      onChange={(patch) => setSession(s.id, patch)}
                      onRemove={() => onChange({ ...story, sessions: sessions.filter((x) => x.id !== s.id) })}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'backstory' && (
          <StoryBackstory
            story={story}
            mind={mind ?? null}
            editingId={editing}
            onEdit={setEditing}
            onStoryChange={onChange}
            onMindChange={(next) => onMindChange?.(next)}
            onAddChapter={() => openComposer('backstory')}
            onOpenMind={() => onOpenFacet?.('mind')}
            query={query}
          />
        )}

        {tab === 'events' && (
          <section className="flex flex-col gap-2.5 border border-line/45 bg-black/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2">
              <Eyebrow>Episodic Memories &amp; Progression Events</Eyebrow>
              {onOpenFacet && (
                <Button size="sm" variant="ghost" onClick={() => onOpenFacet('mind')}>
                  Manage in Mind tab
                </Button>
              )}
            </div>
            {eventMemories.length === 0 ? (
              <div className="font-mono text-[11.5px] text-faint">
                No episodic memories or automatic progression logs yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {eventMemories.map((m) => (
                  <div key={m.id} className="flex flex-col gap-1 border border-line/35 bg-black/50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={m.tags?.includes('progression') ? 'ok' : 'busy'}>{m.category}</StatusBadge>
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-white/95">{m.summary}</span>
                      {m.pinned && <StatusBadge tone="ok">Pinned</StatusBadge>}
                      {m.when && <span className="font-mono text-[10.5px] text-faint">{m.when}</span>}
                    </div>
                    {m.detail && <div className="text-[12.5px] text-dim">{m.detail}</div>}
                    {(m.where || m.who?.length || m.tags?.length) && (
                      <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px] text-faint">
                        {m.where && <span className="text-cyan">@ {m.where}</span>}
                        {m.who?.map((w) => <span key={w}>{w}</span>)}
                        {m.tags?.map((t) => <span key={t}>#{t}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {!compact && (
        <StoryCastSidebar
          story={story}
          relationships={relationships}
          query={query}
          onQuery={setQuery}
          onOpenRelations={() => onOpenFacet?.('relations')}
          onOpenPreview={() => setPreviewOpen(true)}
        />
      )}

      <Modal
        open={Boolean(composing)}
        wide
        title={composing?.phase === 'backstory' ? 'Add Backstory Chapter' : 'Log Scene or Interaction'}
        onClose={() => setComposing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposing(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!composing || (!composing.title.trim() && !composing.summary?.trim() && !composing.notes.trim())}
              onClick={saveComposer}
            >
              Add to story
            </Button>
          </>
        }
      >
        {composing && (
          <SessionEditor
            session={composing}
            number={sessions.length + 1}
            onChange={(patch) => setComposing((cur) => (cur ? { ...cur, ...patch } : cur))}
          />
        )}
      </Modal>

      <Modal open={previewOpen} wide title="What the Agent Receives from This Story" onClose={() => setPreviewOpen(false)}>
        <div className="flex flex-col gap-3">
          <div className="text-[12.5px] text-dim">
            This compact summary is injected into default agent context. Older logs, unpinned backstory chapters, full markdown prose, and resolved threads stay indexed on demand via <span className="font-mono text-cyan">story_recall</span>.
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap border border-line/50 bg-black/70 p-3 font-mono text-[12px] leading-relaxed text-white/90">
            {promptPreview || '(No story context written yet.)'}
          </pre>
        </div>
      </Modal>
    </div>
  )
}
