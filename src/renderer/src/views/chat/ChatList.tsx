import { useRef, useState } from 'react'
import { Lock, MessageSquare, Pencil, Plus, Trash2, Unlink } from 'lucide-react'
import { isGameplayScene } from '@shared/almanac'
import { Button, Panel, SearchBox, DecodeText, VirtualList, askText, confirmDelete } from '../../components/ui'
import { SearchResults } from '../../components/chat/SearchResults'
import { AgentAvatar } from '../../components/agents/look'
import { detachGameplaySession } from '../../components/play/gameplaySession'
import { useSessions } from '../../store/sessions'
import { useAgents } from '../../store/agents'
import { useVault } from '../../store/vault'
import { useLocked } from '../../components/vault/Vault'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/format'
import { failed } from '../../lib/notify'
import { IncognitoMark } from '../../components/chat/IncognitoMark'
import { entryMenuAt } from '../data/entryMenu'

function renameChat(id: string, title: string): void {
  askText('Rename chat', 'Name', title, (next) => useSessions.getState().rename(id, next.trim() || title).catch(failed('Rename failed')))
}

export function ChatList({ selected, onOpen, onNew, onDeleted }: { selected: string | null; onOpen: (id: string) => void; onNew: (agentId?: string) => void; onDeleted: (id: string) => void }) {
  const list = useSessions((s) => s.list)
  const running = useSessions((s) => s.running)
  const pendingUi = useSessions((s) => s.pendingUi)
  const agents = useAgents((s) => s.list)
  const locked = useLocked()
  const askUnlock = useVault((st) => st.ask)
  const [query, setQuery] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const waiting = new Set(Object.values(pendingUi))
  const remove = (id: string, title: string) => confirmDelete('Delete chat', `Delete "${title}"? This removes the chat and its history from disk.`, () => useSessions.getState().remove(id), () => onDeleted(id))

  return (
    <Panel
      className="h-full w-full"
      title="Chats"
      meta={`#${list.length}`}
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} onClick={() => onNew()}>
          New
        </Button>
      }
      bodyClassName="flex flex-col gap-1 overflow-hidden p-2"
    >
      <SearchBox value={query} onChange={setQuery} placeholder="Search chats and memory" />
      {locked && (
        <button onClick={askUnlock} className="flex items-center gap-2 border border-line/60 tone-well-30 px-2.5 py-2 text-left text-[12px] text-dim hover:border-accent hover:text-ink">
          <Lock className="h-3.5 w-3.5 shrink-0 text-accent" />
          Older chats are in the vault. Unlock to see them.
        </button>
      )}
      {query.trim() ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <SearchResults query={query} onOpenChat={onOpen} />
        </div>
      ) : (
        <>
          {list.length === 0 && !locked && <div className="p-3 text-center font-label text-[11px] caps-18 text-faint">[No chats yet]</div>}
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
            <VirtualList count={list.length} scroller={scroller} estimate={56} overscan={10} keyOf={(i) => list[i].id} rowClassName={(i) => (i < list.length - 1 ? 'pb-1' : undefined)}>
              {(i) => {
                const s = list[i]
                const agent = agents.find((a) => a.id === s.agentId)
                return (
                  <div
                    onClick={() => onOpen(s.id)}
                    onContextMenu={(e) =>
                      entryMenuAt(e, 'chat', s.id, s.title, [
                        { label: 'Open', icon: <MessageSquare />, onSelect: () => onOpen(s.id) },
                        { label: `New chat with ${agent?.name ?? 'this agent'}`, icon: <Plus />, onSelect: () => onNew(s.agentId) },
                        ...(isGameplayScene(s.scene)
                          ? [
                              {
                                label: 'Detach from World',
                                icon: <Unlink />,
                                onSelect: () => void detachGameplaySession(s.id).catch(failed('Could not detach Gameplay Chat'))
                              }
                            ]
                          : []),
                        { label: 'Rename', icon: <Pencil />, onSelect: () => renameChat(s.id, s.title) },
                        { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => remove(s.id, s.title) }
                      ])
                    }
                    className={cn(
                      'group relative flex cursor-pointer flex-col gap-0.5 border px-2.5 py-2 transition-colors',
                      s.id === selected ? 'border-accent/70 border-l-2 border-l-accent bg-accent/10' : 'border-transparent hover:border-line hover:bg-ink/[0.03]'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <AgentAvatar agent={agent} size={28} sessionId={s.id} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <DecodeText className="truncate pr-12 text-[13px] text-ink" text={s.title} onMount={false} />
                        <span className="flex items-center gap-2 font-ui text-[10.5px] text-dim">
                          <span className="truncate text-secondary/80">{agent?.name ?? 'Agent'}</span>
                          {isGameplayScene(s.scene) && (
                            <span className="border border-secondary-ink/50 bg-secondary-ink/10 px-1 text-[8.5px] font-bold caps-5 text-secondary-ink">
                              GAMEPLAY
                            </span>
                          )}
                          {s.incognito && <IncognitoMark className="py-0" />}
                          <span>{formatRelative(s.updatedAt)}</span>
                          {waiting.has(s.id) ? <span className="animate-pulse font-bold text-accent">? needs you</span> : running[s.id] && <span className="h-1.5 w-1.5 animate-pulse bg-secondary-ink" />}
                        </span>
                      </span>
                    </span>
                    <span className="absolute right-1.5 top-1.5 hidden gap-0.5 group-hover:flex">
                      <button
                        className="p-1 text-dim hover:text-accent"
                        onClick={(e) => {
                          e.stopPropagation()
                          renameChat(s.id, s.title)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1 text-dim hover:text-alert"
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(s.id, s.title)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                )
              }}
            </VirtualList>
          </div>
        </>
      )}
    </Panel>
  )
}
