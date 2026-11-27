import { useEffect, useMemo, useState } from 'react'
import { Pencil, Send, Trash2 } from 'lucide-react'
import type { WorldPost } from '@shared/world'
import { showName } from '@shared/ids'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/format'
import { engine, on } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { noteFailure } from '../../store/problems'
import { toast } from '../../store/toasts'
import { Markdown } from '../chat/Markdown'
import { LinkTextarea } from '../data/LinkTextarea'
import { LinkFaceList } from '../entries/LinkFaces'
import { usePlaceRecords } from '../maps/usePlaceRecords'
import { BrowsePick, Button, EmptyState, Eyebrow, SearchBox, askText, confirmDelete, openMenu } from '../ui'

export function WorldBoard({
  worldId,
  mode = 'player'
}: {
  worldId: string
  mode?: 'player' | 'editor'
}) {
  const [posts, setPosts] = useState<WorldPost[]>([])
  const [to, setTo] = useState('ALL')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [recipientFilter, setRecipientFilter] = useState<string | null>(null)

  const places = usePlaceRecords(worldId)
  const factions =
    useLive(() => engine('factions.list', { world: worldId, layer: 'play' }), ['factions.changed', 'saves.changed'], [worldId]) ?? []
  const npcs =
    useLive(() => engine('npcs.list', { world: worldId, layer: 'play' }), ['npcs.changed', 'saves.changed'], [worldId]) ?? []

  useEffect(() => {
    const load = () =>
      void engine('worlds.board', { id: worldId })
        .then(setPosts)
        .catch(noteFailure('worlds', 'Could not load the board'))
    load()
    return on('worlds.changed', ({ id }) => id === worldId && load())
  }, [worldId])

  const recipientOptions = useMemo(
    () => [
      { value: 'ALL', label: 'Everyone (ALL)', group: 'Broadcast' },
      ...factions.map((f) => ({ value: f.name, label: f.name, group: 'Factions' })),
      ...Object.entries(places).map(([k, p]) => ({
        value: String(p.Name || k),
        label: String(p.Name || k),
        group: 'Places'
      })),
      ...npcs
        .filter((n) => !n.archetype)
        .map((n) => ({ value: showName(n.title), label: showName(n.title), group: 'People' }))
    ],
    [factions, places, npcs]
  )

  const recipientsPresent = useMemo(
    () => [...new Set(posts.map((p) => p.to).filter(Boolean))],
    [posts]
  )

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return posts
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => {
        if (recipientFilter && p.to !== recipientFilter) return false
        if (!q) return true
        return (
          p.message.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.to.toLowerCase().includes(q)
        )
      })
  }, [posts, query, recipientFilter])

  const send = async () => {
    const text = message.trim()
    if (!text) return
    try {
      await engine('worlds.post', {
        id: worldId,
        author: mode === 'editor' ? 'GM::DISPATCH' : 'USER::OPERATOR',
        to: to.trim() || 'ALL',
        message: text
      })
      setMessage('')
    } catch (err) {
      toast.error('Could not post', errorText(err))
    }
  }

  const edit = (i: number, p: WorldPost) =>
    askText(
      'Edit notice',
      'Message',
      p.message,
      async (m) => void (await engine('worlds.editPost', { id: worldId, index: i, message: m }).catch(failed('Could not edit')))
    )

  const remove = (i: number) =>
    confirmDelete('Remove this notice?', 'Agents and characters will no longer see it on the board.', () =>
      engine('worlds.editPost', { id: worldId, index: i, message: null })
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg font-ui select-none">
      {/* BOARD HEADER & FILTERS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line/50 tone-panel-50 px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="type-title text-ink">Notice Board</span>
          <span className="font-data text-[11px] text-faint">
            ({posts.length} {posts.length === 1 ? 'dispatch' : 'dispatches'})
          </span>
          {recipientsPresent.length > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setRecipientFilter(null)}
                className={cn(
                  'border px-2 py-0.5 font-label text-[9.5px] caps-5 transition-colors cursor-pointer',
                  !recipientFilter
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line/40 tone-well-40 text-dim hover:text-ink'
                )}
              >
                All
              </button>
              {recipientsPresent.slice(0, 6).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecipientFilter(recipientFilter === r ? null : r)}
                  className={cn(
                    'border px-2 py-0.5 font-label text-[9.5px] caps-5 transition-colors cursor-pointer',
                    recipientFilter === r
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line/40 tone-well-40 text-dim hover:text-ink'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        <SearchBox value={query} onChange={setQuery} placeholder="Search dispatches…" className="w-56" />
      </div>

      {/* DISPATCH FEED */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
        {posts.length === 0 ? (
          <EmptyState title="The board is clear">
            Post a notice, rumour, bounty, or letter below. Characters and agents in this world read and post dispatches here.
          </EmptyState>
        ) : filteredPosts.length === 0 ? (
          <EmptyState title="No matching notices">Try clearing the filter or searching another phrase.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredPosts.map(({ p, idx }) => (
              <article
                key={idx}
                onContextMenu={(e) =>
                  openMenu(e, `Notice by ${p.author}`, [
                    { label: 'Edit Notice', icon: <Pencil />, onSelect: () => edit(idx, p) },
                    { label: 'Delete Notice', icon: <Trash2 />, danger: true, onSelect: () => remove(idx) }
                  ])
                }
                className="group flex flex-col gap-2.5 border border-line/60 tone-panel-50 p-4 transition-colors hover:border-line"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 pb-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-bold text-secondary-ink">{p.author}</span>
                    <span className="text-faint">→</span>
                    <span className="border border-line/50 tone-well-50 px-1.5 py-px font-label text-[9.5px] caps-5 text-ink">
                      {p.to}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] text-faint">
                    <span>{p.at}</span>
                    {p.edited && <span>(edited)</span>}
                    <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Edit notice"
                        onClick={() => edit(idx, p)}
                        className="p-0.5 text-dim hover:text-ink cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete notice"
                        onClick={() => remove(idx)}
                        className="p-0.5 text-dim hover:text-alert cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                </div>

                <div className="select-text">
                  <Markdown text={p.message} className="font-body text-[13.5px] leading-relaxed text-ink/90" />
                </div>
                <LinkFaceList text={p.message} />
              </article>
            ))}
          </div>
        )}
      </div>

      {/* COMPOSER DOCK */}
      <div className="flex flex-col gap-2 border-t border-line/60 tone-panel-70 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eyebrow>Post Dispatch</Eyebrow>
            <div className="w-56">
              <BrowsePick
                value={to}
                options={recipientOptions}
                placeholder="Recipient (ALL, faction, person…)"
                onChange={(v) => setTo(v || 'ALL')}
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            icon={<Send />}
            disabled={!message.trim()}
            onClick={() => void send()}
          >
            Post Notice
          </Button>
        </div>
        <LinkTextarea
          rolls={false}
          rows={2}
          value={message}
          onValue={setMessage}
          placeholder="Write a notice, bounty, or letter — type @ to link places, factions, or people…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void send()
            }
          }}
        />
      </div>
    </div>
  )
}
