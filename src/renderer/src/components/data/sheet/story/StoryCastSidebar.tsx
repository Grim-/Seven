import { useMemo } from 'react'
import { ArrowUpRight, Eye, Users } from 'lucide-react'
import { parseLinkRef, stanceMeta, type RelationshipEntry } from '@shared/relationships'
import { refsIn, type Story } from '@shared/story'
import { Button, Eyebrow, SearchBox, StatusBadge } from '../../../ui'
import { openEntry } from '../../../../lib/library'
import { StoryLinks } from './StoryLinks'
import { MentionChip } from './MentionChip'

const STANCE_TONE: Record<string, 'ok' | 'busy' | 'warn' | 'error' | 'idle'> = {
  devoted: 'ok',
  friendly: 'ok',
  neutral: 'idle',
  wary: 'warn',
  hostile: 'error',
  rival: 'busy'
}

export function StoryCastSidebar({
  self,
  story,
  relationships,
  query,
  onQuery,
  onOpenRelations,
  onOpenPreview,
  onRelink
}: {
  onRelink: (kind: string, ref: string, to: string) => void
  self: string
  story: Story
  relationships: RelationshipEntry[]
  query: string
  onQuery: (q: string) => void
  onOpenRelations: () => void
  onOpenPreview: () => void
}) {
  const castMentions = useMemo(() => {
    const counts = new Map<string, number>()
    const bump = (raw: string) => {
      const clean = raw.trim()
      if (!clean || refsIn(clean).some((r) => r.ref === self)) return
      counts.set(clean, (counts.get(clean) ?? 0) + 1)
    }
    for (const t of story.threads) for (const w of t.who ?? []) bump(w)
    for (const s of story.sessions) for (const w of s.who ?? []) bump(w)
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count, link: refsIn(name)[0] ?? null }))
      .sort((a, b) => b.count - a.count)
  }, [story, self])

  const keyRelations = useMemo(() => {
    return [...relationships]
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt)
      .slice(0, 6)
  }, [relationships])

  const activeThreads = story.threads.filter((t) => !t.done).length
  const chronicleCount = story.sessions.filter((s) => s.phase !== 'backstory').length
  const backstoryCount = story.sessions.filter((s) => s.phase === 'backstory').length

  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
      <SearchBox value={query} onChange={onQuery} placeholder="Search threads, scenes, lore…" />

      <div className="flex flex-col gap-2 border border-line/45 tone-panel-45 p-3">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow className="text-accent">Agent Context Hygiene</Eyebrow>
          <Button size="sm" variant="ghost" icon={<Eye />} onClick={onOpenPreview}>
            Inspect
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5 font-ui text-[10.5px]">
          <div className="border border-line/35 tone-panel-50 px-2 py-1 text-center">
            <div className="text-[13px] font-bold text-ink">{activeThreads}</div>
            <div className="text-faint">Open arcs</div>
          </div>
          <div className="border border-line/35 tone-panel-50 px-2 py-1 text-center">
            <div className="text-[13px] font-bold text-ink">{chronicleCount}</div>
            <div className="text-faint">Scenes</div>
          </div>
          <div className="border border-line/35 tone-panel-50 px-2 py-1 text-center">
            <div className="text-[13px] font-bold text-ink">{backstoryCount}</div>
            <div className="text-faint">Lore</div>
          </div>
        </div>
        <div className="font-ui text-[10.5px] leading-snug text-faint">
          Prompt carries Present Scene, Open Arcs, Core Backstory, pinned truths, and 1-2 latest scene summaries. Full prose stays on story_recall.
        </div>
      </div>

      <div className="flex flex-col gap-2 border border-line/45 tone-panel-45 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-secondary-ink" />
            <Eyebrow>Cast &amp; Relationships</Eyebrow>
          </div>
          <button
            type="button"
            onClick={onOpenRelations}
            className="flex items-center gap-0.5 font-ui text-[10.5px] text-faint hover:text-accent"
          >
            All ({relationships.length})
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {keyRelations.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {keyRelations.map((r) => {
              const link = r.ref ? parseLinkRef(r.ref) : null
              const meta = stanceMeta(r.stance)
              return (
                <div key={r.id} className="flex items-center gap-2 border border-line/30 tone-panel-50 px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    {link ? (
                      <button
                        type="button"
                        onClick={() => openEntry(link.kind, link.ref)}
                        className="truncate text-left text-[12.5px] font-medium text-ink hover:text-accent"
                      >
                        {r.target}
                      </button>
                    ) : (
                      <div className="truncate text-[12.5px] font-medium text-ink">{r.target}</div>
                    )}
                    {r.role && <div className="truncate font-ui text-[10px] text-dim">{r.role}</div>}
                  </div>
                  <StatusBadge tone={STANCE_TONE[r.stance] ?? 'idle'}>{meta.label}</StatusBadge>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-[11.5px] text-faint">No relationships recorded yet.</div>
        )}

        {castMentions.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-line/25 pt-2">
            {castMentions.slice(0, 12).map((c) =>
              c.link ? (
                <MentionChip key={c.name} kind={c.link.kind} ref={c.link.ref} count={c.count} onRelink={onRelink} />
              ) : (
                <span key={c.name} className="border border-line/40 px-1.5 py-0.5 font-ui text-[10.5px] text-dim">
                  {c.name} · {c.count}
                </span>
              )
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border border-line/45 tone-panel-45 p-3">
        <Eyebrow className="text-accent">Mentioned in sessions</Eyebrow>
        <StoryLinks story={story} self={self} onRelink={onRelink} />
      </div>
    </aside>
  )
}
