import { useState } from 'react'
import { Plus } from 'lucide-react'
import { newSession, type Story, type StorySession } from '@shared/story'
import { Button, Eyebrow, SearchBox, Segmented } from '../../../ui'
import { SessionCard } from './SessionCard'
import { SessionEditor } from './SessionEditor'
import { StoryLinks } from './StoryLinks'
import { StoryNow } from './StoryNow'

const RECENT = 5

export function StoryTab({ story, onChange }: { story: Story; onChange: (story: Story) => void }) {
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const sessions = story.sessions
  const latest = sessions[sessions.length - 1]
  const setSession = (id: string, patch: Partial<StorySession>) => onChange({ ...story, sessions: sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  const start = () => onChange({ ...story, sessions: [...sessions, newSession()] })
  const q = query.trim().toLowerCase()
  const numbered = sessions.map((s, i) => ({ s, n: i + 1 }))
  const pool = q
    ? numbered.filter(({ s }) => [s.title, s.summary ?? '', s.where ?? '', s.phase ?? '', ...(s.who ?? []), ...(s.tags ?? []), s.notes].join('\n').toLowerCase().includes(q))
    : numbered.slice(0, -1)
  const ordered = order === 'newest' ? [...pool].reverse() : pool
  const shown = q || all || order === 'oldest' ? ordered : ordered.slice(0, RECENT)
  return (
    <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-8 p-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <main className="flex min-w-0 flex-col gap-7">
        <section className="flex flex-col gap-1 border-l-2 border-accent pl-4">
          <Eyebrow className="text-accent">Now</Eyebrow>
          <StoryNow story={story} onChange={onChange} large />
        </section>
        {latest ? (
          <section className="flex flex-col gap-2 border border-line/40 bg-black/40 p-4">
            <SessionEditor
              session={latest}
              number={sessions.length}
              onChange={(patch) => setSession(latest.id, patch)}
              actions={
                <button onClick={start} className="flex items-center gap-1 font-mono text-[11px] text-faint hover:text-accent">
                  <Plus className="h-3.5 w-3.5" /> New session
                </button>
              }
            />
          </section>
        ) : (
          <Button variant="primary" icon={<Plus />} onClick={start} className="self-start">
            Start the first session
          </Button>
        )}
        {(pool.length > 0 || q) && (
          <section className="flex flex-col">
            <div className="flex items-center justify-between pb-2">
              <Eyebrow>{q ? `${pool.length} found` : 'The story so far'}</Eyebrow>
              <Segmented value={order} onChange={setOrder} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'From the start' }]} />
            </div>
            {shown.map(({ s, n }) => (
              <SessionCard key={s.id} session={s} number={n} editing={editing === s.id} onEdit={(on) => setEditing(on ? s.id : null)} onChange={(patch) => setSession(s.id, patch)} onRemove={() => onChange({ ...story, sessions: sessions.filter((x) => x.id !== s.id) })} />
            ))}
            {shown.length < ordered.length && (
              <button onClick={() => setAll(true)} className="self-start border-t border-line/40 pt-3 font-mono text-[11.5px] text-faint hover:text-accent">
                ▸ {ordered.length - shown.length} earlier sessions
              </button>
            )}
          </section>
        )}
      </main>
      <aside className="flex flex-col gap-5 xl:sticky xl:top-4">
        <SearchBox value={query} onChange={setQuery} placeholder="Search the story" />
        <StoryLinks story={story} />
      </aside>
    </div>
  )
}
