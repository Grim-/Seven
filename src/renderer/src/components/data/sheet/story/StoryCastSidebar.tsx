import { useMemo } from 'react'
import { ArrowUpRight, Eye, Users } from 'lucide-react'
import { parseLinkRef, stanceMeta, type RelationshipEntry } from '@shared/relationships'
import { refName, type Story } from '@shared/story'
import { Button, Eyebrow, SearchBox, StatusBadge } from '../../../ui'
import { openEntry } from '../../../../lib/library'
import { StoryLinks } from './StoryLinks'

const STANCE_TONE: Record<string, 'ok' | 'busy' | 'warn' | 'error' | 'idle'> = {
  devoted: 'ok',
  friendly: 'ok',
  neutral: 'idle',
  wary: 'warn',
  hostile: 'error',
  rival: 'busy'
}

export function StoryCastSidebar({
  story,
  relationships,
  query,
  onQuery,
  onOpenRelations,
  onOpenPreview
}: {
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
      if (!clean) return
      counts.set(clean, (counts.get(clean) ?? 0) + 1)
    }
    for (const t of story.threads) for (const w of t.who ?? []) bump(w)
    for (const s of story.sessions) for (const w of s.who ?? []) bump(w)
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [story])

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

      <div className="flex flex-col gap-2 border border-line/45 bg-black/45 p-3">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow className="text-accent">Agent Context Hygiene</Eyebrow>
          <Button size="sm" variant="ghost" icon={<Eye />} onClick={onOpenPreview}>
            Inspect
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-[10.5px]">
          <div className="border border-line/35 bg-black/50 px-2 py-1 text-center">
            <div className="text-[13px] font-bold text-white">{activeThreads}</div>
            <div className="text-faint">Open arcs</div>
          </div>
          <div className="border border-line/35 bg-black/50 px-2 py-1 text-center">
            <div className="text-[13px] font-bold text-white">{chronicleCount}</div>
            <div className="text-faint">Scenes</div>
          </div>
          <div className="border border-line/35 bg-black/50 px-2 py-1 text-center">
            <div className="text-[13px] font-bold text-white">{backstoryCount}</div>
            <div className="text-faint">Lore</div>
          </div>
        </div>
        <div className="font-mono text-[10.5px] leading-snug text-faint">
          Prompt carries Present Scene, Open Arcs, Core Backstory, pinned truths, and 1-2 latest scene summaries. Full prose stays on story_recall.
        </div>
      </div>

      <div className="flex flex-col gap-2 border border-line/45 bg-black/45 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-cyan" />
            <Eyebrow>Cast &amp; Relationships</Eyebrow>
          </div>
          <button
            type="button"
            onClick={onOpenRelations}
            className="flex items-center gap-0.5 font-mono text-[10.5px] text-faint hover:text-accent"
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
                <div key={r.id} className="flex items-center gap-2 border border-line/30 bg-black/50 px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    {link ? (
                      <button
                        type="button"
                        onClick={() => openEntry(link.kind, link.ref)}
                        className="truncate text-left text-[12.5px] font-medium text-white hover:text-accent"
                      >
                        {r.target}
                      </button>
                    ) : (
                      <div className="truncate text-[12.5px] font-medium text-white">{r.target}</div>
                    )}
                    {r.role && <div className="truncate font-mono text-[10px] text-dim">{r.role}</div>}
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
            {castMentions.slice(0, 12).map((c) => {
              const link = parseLinkRef(c.name)
              return link ? (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => openEntry(link.kind, link.ref)}
                  className="border border-cyan/35 bg-cyan/5 px-1.5 py-0.5 font-mono text-[10.5px] text-cyan hover:border-cyan"
                >
                  {refName(link.ref)} ({c.count})
                </button>
              ) : (
                <span key={c.name} className="border border-line/40 px-1.5 py-0.5 font-mono text-[10.5px] text-dim">
                  {c.name} · {c.count}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border border-line/45 bg-black/45 p-3">
        <StoryLinks story={story} />
      </div>
    </aside>
  )
}
