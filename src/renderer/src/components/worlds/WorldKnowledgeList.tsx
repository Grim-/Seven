import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Pin, Plus, Trash2 } from 'lucide-react'
import { WORLD_LINK_KIND, worldLink, type WorldMeta } from '@shared/world'
import { KNOWLEDGE_SEGMENT, blankKnowledge, knowledgePart, type WorldKnowledge } from '@shared/worldKnowledge'
import { showName } from '@shared/ids'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { useBusy } from '../../lib/useBusy'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'
import { Markdown } from '../chat/Markdown'
import { CopyLinkButton } from '../data/CopyLinkButton'
import { LinkFaceList } from '../entries/LinkFaces'
import { AssetMedia } from '../pictures/AssetMedia'
import { Button, EmptyState, Eyebrow, SearchBox, Segmented, Toggle, confirmDelete, openMenu, type MenuItem } from '../ui'
import { KnowledgeEditor } from './KnowledgeEditor'

type LoreFilter = 'all' | 'pinned' | 'global' | 'local'

export function WorldKnowledgeList({
  world,
  mode = 'editor'
}: {
  world: WorldMeta
  mode?: 'player' | 'editor'
}) {
  const isPlayerMode = mode === 'player'
  const list = useLive(() => engine('knowledge.list', { world: world.id }), 'knowledge.changed', [world.id]) ?? []

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LoreFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ value: WorldKnowledge; previousId: string | null } | null>(null)
  const [busy, run] = useBusy()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...list]
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name))
      .filter((k) => {
        if (filter === 'pinned' && !k.pinned) return false
        if (filter === 'global' && k.scope !== 'global') return false
        if (filter === 'local' && k.scope !== 'local') return false
        if (!q) return true
        return (
          k.name.toLowerCase().includes(q) ||
          k.text.toLowerCase().includes(q) ||
          k.tags.some((t) => t.toLowerCase().includes(q))
        )
      })
  }, [list, query, filter])

  const activeEntry = useMemo(() => {
    if (draft?.previousId === null) return null
    if (selectedId) {
      const hit = list.find((k) => k.id === selectedId)
      if (hit) return hit
    }
    return filtered[0] ?? list[0] ?? null
  }, [list, filtered, selectedId, draft])

  useEffect(() => {
    if (isPlayerMode) {
      setDraft(null)
      return
    }
    if (draft?.previousId === null) return
    if (activeEntry) {
      setDraft({ value: activeEntry, previousId: activeEntry.id })
    } else {
      setDraft(null)
    }
  }, [activeEntry?.id, activeEntry?.updatedAt, isPlayerMode])

  const saveDraft = () =>
    draft &&
    void run(async () => {
      const saved = await engine('knowledge.save', {
        world: world.id,
        entry: draft.value,
        previousId: draft.previousId
      })
      setSelectedId(saved.id)
      setDraft({ value: saved, previousId: saved.id })
      toast.success('Lore Saved', showName(saved.name))
    }, 'Could not save lore entry')

  const remove = (k: WorldKnowledge) =>
    confirmDelete(`Delete ${showName(k.name)}?`, 'Characters that know it will no longer know it.', async () => {
      await engine('library.remove', { entry: worldLink(world.id, KNOWLEDGE_SEGMENT, k.id) })
      if (selectedId === k.id) setSelectedId(null)
      if (draft?.previousId === k.id) setDraft(null)
    })

  const startNew = () => {
    setSelectedId(null)
    setDraft({ value: blankKnowledge(), previousId: null })
  }

  const actions = (k: WorldKnowledge): MenuItem[] => [
    { label: 'Open in Data', icon: <ExternalLink />, onSelect: () => openEntry(WORLD_LINK_KIND, knowledgePart(world.id, k.id)) },
    ...(!isPlayerMode
      ? [{ label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => remove(k) }]
      : [])
  ]

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden bg-bg font-ui select-none"
      onContextMenu={(e) => {
        if (isPlayerMode) return
        if ((e.target as HTMLElement).closest('button, input, textarea')) return
        openMenu(e, 'World Lore', [{ label: 'New Lore Entry', icon: <Plus />, onSelect: startNew }])
      }}
    >
      {/* LEFT CODEX LIST */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-line/50 tone-sidebar-50">
        <div className="flex flex-col gap-2.5 border-b border-line/40 tone-panel-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="type-title text-ink">World Lore</span>
              <span className="font-data text-[11px] text-faint">({list.length})</span>
            </div>
            {!isPlayerMode && (
              <Button size="sm" variant="primary" icon={<Plus />} onClick={startNew}>
                New
              </Button>
            )}
          </div>
          <SearchBox value={query} onChange={setQuery} placeholder="Search lore, magic, history…" />
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pinned', label: 'Pinned' },
              { value: 'global', label: 'Common' },
              { value: 'local', label: 'Secret' }
            ]}
          />
          {!isPlayerMode && (
            <Toggle
              checked={world.knowledgeCues === true}
              onChange={(on) =>
                void engine('worlds.setKnowledgeCues', { id: world.id, on }).catch(failed('Could not change the setting'))
              }
              label="Recall lore automatically on cues"
            />
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col divide-y divide-line/25 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-[12px] text-faint">
              {list.length === 0 ? 'No lore entries written yet.' : 'No lore matches this filter.'}
            </div>
          ) : (
            filtered.map((k) => {
              const isSel = activeEntry?.id === k.id && draft?.previousId !== null
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(k.id)
                    if (!isPlayerMode) setDraft({ value: k, previousId: k.id })
                  }}
                  onContextMenu={(e) => openMenu(e, showName(k.name), actions(k))}
                  className={cn(
                    'flex flex-col gap-1 border-l-2 px-3.5 py-2.5 text-left transition-colors cursor-pointer',
                    isSel
                      ? 'border-l-accent bg-accent/10 text-ink'
                      : 'border-l-transparent text-dim hover:tone-card-40 hover:text-ink'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-semibold text-ink">
                      {k.pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
                      <span className="truncate">{showName(k.name)}</span>
                    </span>
                    <span className="shrink-0 font-label text-[9px] caps-5 text-faint">
                      {k.scope === 'global' ? 'Common' : 'Local'}
                    </span>
                  </div>
                  {k.text && (
                    <span className="line-clamp-2 font-body text-[11.5px] text-dim">{k.text}</span>
                  )}
                  {k.tags.length > 0 && (
                    <span className="truncate text-[10px] text-faint">#{k.tags.join(' #')}</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* RIGHT READING / AUTHORING PANE */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        {isPlayerMode ? (
          activeEntry ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/50 pb-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border border-line/50 tone-well-50 px-2 py-0.5 font-label text-[9.5px] font-bold caps-5 text-dim">
                        {activeEntry.scope === 'global' ? 'Common Knowledge' : 'Restricted / Local Lore'}
                      </span>
                      {activeEntry.pinned && (
                        <span className="border border-accent/50 bg-accent/10 px-2 py-0.5 font-label text-[9.5px] font-bold caps-5 text-accent">
                          Key Lore
                        </span>
                      )}
                    </div>
                    <h2 className="text-[22px] font-bold text-ink">{showName(activeEntry.name)}</h2>
                    {activeEntry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 text-[11px] text-faint">
                        {activeEntry.tags.map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <CopyLinkButton kind="world" id={knowledgePart(world.id, activeEntry.id)} />
                </div>

                {activeEntry.image && (
                  <div className="overflow-hidden border border-line/50 tone-well-50">
                    <AssetMedia id={activeEntry.image} className="max-h-72 w-full object-cover" />
                  </div>
                )}

                <div className="select-text">
                  <Markdown
                    text={activeEntry.text || '*No details recorded yet.*'}
                    className="font-body text-[14.5px] leading-[1.8] text-ink/90"
                  />
                </div>

                <LinkFaceList text={activeEntry.text} />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <EmptyState title="No world lore yet">
                Lore entries hold the history, magic systems, customs, and secrets of {world.name}.
              </EmptyState>
            </div>
          )
        ) : draft ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line/50 tone-panel-50 px-5 py-2.5">
              <Eyebrow className="text-accent">
                {draft.previousId ? `Editing · ${showName(draft.value.name || draft.previousId)}` : 'New Lore Entry'}
              </Eyebrow>
              <div className="flex items-center gap-2">
                {draft.previousId && activeEntry && (
                  <>
                    <CopyLinkButton kind="world" id={knowledgePart(world.id, activeEntry.id)} />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="text-alert" />}
                      onClick={() => remove(activeEntry)}
                    >
                      Delete
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy || !draft.value.name.trim()}
                  onClick={saveDraft}
                >
                  {busy ? 'Saving…' : draft.previousId ? 'Save Changes' : 'Create Lore'}
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <div className="mx-auto w-full max-w-3xl">
                <KnowledgeEditor
                  value={draft.value}
                  onChange={(value) => setDraft({ ...draft, value })}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <EmptyState title="Select or create a lore entry">
              Lore defines the setting&apos;s history, magic, beliefs, and secrets.
              <div className="mt-3 flex justify-center">
                <Button size="sm" variant="primary" icon={<Plus />} onClick={startNew}>
                  New Lore Entry
                </Button>
              </div>
            </EmptyState>
          </div>
        )}
      </main>
    </div>
  )
}
