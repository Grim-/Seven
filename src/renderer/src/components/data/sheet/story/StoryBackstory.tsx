import { Plus } from 'lucide-react'
import { newMemory, type Story, type StoryMemory, type StorySession } from '@shared/story'
import type { CharacterMind } from '@shared/types'
import { Button, Eyebrow, InlineEdit, StatusBadge } from '../../../ui'
import { SessionCard } from './SessionCard'

export function StoryBackstory({
  story,
  mind,
  editingId,
  onEdit,
  onStoryChange,
  onMindChange,
  onAddChapter,
  onOpenMind,
  query = ''
}: {
  story: Story
  mind: CharacterMind | null
  editingId: string | null
  onEdit: (id: string | null) => void
  onStoryChange: (story: Story) => void
  onMindChange: (next: CharacterMind | null) => void
  onAddChapter: () => void
  onOpenMind: () => void
  query?: string
}) {
  const q = query.trim().toLowerCase()
  const numbered = story.sessions
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s }) => s.phase === 'backstory')
    .filter(({ s }) =>
      !q
        ? true
        : [s.title, s.summary ?? '', s.outcome ?? '', s.where ?? '', ...(s.who ?? []), ...(s.tags ?? []), s.notes]
            .join('\n')
            .toLowerCase()
            .includes(q)
    )

  const memories = mind?.memories ?? []
  const loreMemories = memories.filter(
    (m) =>
      (m.category === 'backstory' || m.category === 'secret') &&
      (!q || [m.summary, m.detail ?? '', m.where ?? '', ...(m.who ?? []), ...(m.tags ?? [])].join('\n').toLowerCase().includes(q))
  )

  const addQuickTruth = (category: 'backstory' | 'secret', text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const nextMem = newMemory({ category, summary: trimmed, pinned: category === 'backstory' })
    onMindChange({ ...(mind ?? {}), memories: [...memories, nextMem] })
  }

  const updateSession = (id: string, patch: Partial<StorySession>) =>
    onStoryChange({ ...story, sessions: story.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) })

  const togglePinMemory = (mem: StoryMemory) =>
    onMindChange({
      ...(mind ?? {}),
      memories: memories.map((m) => (m.id === mem.id ? { ...m, pinned: !m.pinned } : m))
    })

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 border border-accent/40 bg-black/45 p-3.5 shadow-[inset_3px_0_0_var(--color-accent)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eyebrow className="text-accent">Contextual Backstory Essence</Eyebrow>
            <StatusBadge tone="ok">Always in prompt</StatusBadge>
          </div>
          <span className="font-mono text-[10.5px] text-dim">
            2-4 sentences grounding who they were before now
          </span>
        </div>
        <InlineEdit
          value={story.backstorySummary ?? ''}
          placeholder="Click to write concise contextual backstory (origins, defining turn, why they are on this path)..."
          onSave={(val) => onStoryChange({ ...story, backstorySummary: val.trim() || undefined })}
          className="border border-line/35 bg-black/50 px-3 py-2 text-[13.5px] leading-relaxed text-white/95"
        />
      </section>

      <section className="flex flex-col gap-2.5 border border-line/45 bg-black/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2">
          <div className="flex items-center gap-2">
            <Eyebrow>Origin Chapters &amp; Defining Events</Eyebrow>
            <span className="font-mono text-[11px] text-dim">{numbered.length} written</span>
          </div>
          <Button size="sm" variant="primary" icon={<Plus />} onClick={onAddChapter}>
            Add backstory chapter
          </Button>
        </div>

        {numbered.length === 0 ? (
          <div className="py-1 font-mono text-[11.5px] text-faint">
            No origin chapters yet. Long-form backstory lives here for reading &amp; recall without bloating every chat prompt.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {numbered.map(({ s, n }) => (
              <SessionCard
                key={s.id}
                session={s}
                number={n}
                editing={editingId === s.id}
                defaultExpanded
                onEdit={(on) => onEdit(on ? s.id : null)}
                onChange={(patch) => updateSession(s.id, patch)}
                onRemove={() => onStoryChange({ ...story, sessions: story.sessions.filter((x) => x.id !== s.id) })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2.5 border border-line/45 bg-black/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2">
          <div className="flex items-center gap-2">
            <Eyebrow>Formative Facts &amp; Hidden Secrets</Eyebrow>
            <span className="font-mono text-[11px] text-dim">{loreMemories.length} in Mind</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onOpenMind}>
            Open Mind tab
          </Button>
        </div>

        {loreMemories.length === 0 ? (
          <div className="font-mono text-[11.5px] text-faint">
            No backstory facts or secrets stored yet. Add quick truths below or record them via Mind.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {loreMemories.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 border border-line/35 bg-black/50 px-2.5 py-2">
                <StatusBadge tone={m.category === 'secret' ? 'warn' : 'busy'}>{m.category}</StatusBadge>
                <span className="min-w-0 flex-1 text-[13px] text-white/90">{m.summary}</span>
                {m.when && <span className="font-mono text-[10.5px] text-faint">{m.when}</span>}
                <button
                  type="button"
                  onClick={() => togglePinMemory(m)}
                  className="border border-line/50 px-1.5 py-0.5 font-mono text-[10px] uppercase text-dim hover:border-accent hover:text-accent"
                >
                  {m.pinned ? 'Pinned' : 'Recall'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 border-t border-line/25 pt-2 sm:grid-cols-2">
          <InlineEdit
            value=""
            placeholder="+ Add pinned backstory truth"
            onSave={(val) => addQuickTruth('backstory', val)}
            className="border border-line/40 bg-black/50 px-2.5 py-1.5 text-[12px] text-dim"
          />
          <InlineEdit
            value=""
            placeholder="+ Add character secret (recall-only)"
            onSave={(val) => addQuickTruth('secret', val)}
            className="border border-line/40 bg-black/50 px-2.5 py-1.5 text-[12px] text-dim"
          />
        </div>
      </section>
    </div>
  )
}
