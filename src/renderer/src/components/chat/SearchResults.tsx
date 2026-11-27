import { useEffect, useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import type { ChatSearchHit, MemorySearchHit } from '@shared/types'
import { engine } from '../../lib/ipc'
import { errorText, formatRelative } from '../../lib/format'
import { useAgents } from '../../store/agents'
import { useVault } from '../../store/vault'
import { AgentAvatar } from '../agents/look'
import { showInData } from '../../lib/library'
import { noteFailure } from '../../store/problems'

function highlight(text: string, query: string): ReactNode {
  const terms = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!terms.length) return text
  const re = new RegExp(`(${terms.join('|')})`, 'gi')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="bg-accent/25 text-ink">{part}</mark> : part))
}

const SOURCE: Record<string, string> = { journal: 'Journal', memory: 'Memory', relationship: 'Relationship' }

export function SearchResults({ query, onOpenChat }: { query: string; onOpenChat: (id: string) => void }) {
  const agents = useAgents((s) => s.list)
  const askUnlock = useVault((s) => s.ask)
  const [chats, setChats] = useState<{ chats: ChatSearchHit[]; locked: boolean } | null>(null)
  const [memory, setMemory] = useState<{ memory: MemorySearchHit[]; locked: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) return
    let cancelled = false
    setMemory(null)
    const timer = setTimeout(() => {
      engine('search.chats', { query: q })
        .then((r) => !cancelled && (setChats(r), setError(null)))
        .catch((err) => !cancelled && setError(errorText(err)))
      engine('search.memory', { query: q })
        .then((r) => !cancelled && setMemory(r))
        .catch(noteFailure('search', 'Could not search memory', () => !cancelled && setMemory({ memory: [], locked: false })))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const openMemory = (agentId: string) => {
    showInData({ kind: 'memory', id: agentId })
  }

  if (error) return <div className="p-2 font-ui text-[11px] text-alert">{error}</div>
  if (!chats) return <div className="p-2 font-label text-[11px] caps-14 text-faint">Searching…</div>
  const results = { chats: chats.chats, memory: memory?.memory ?? [], locked: chats.locked || !!memory?.locked }
  const busy = memory === null
  const none = !results.chats.length && !results.memory.length
  return (
    <div className="flex flex-col gap-1">
      {results.locked && (
        <button onClick={askUnlock} className="flex items-center gap-2 border border-line/60 tone-well-30 px-2.5 py-2 text-left text-[12px] text-dim hover:border-accent hover:text-ink">
          <Lock className="h-3.5 w-3.5 shrink-0 text-accent" />
          Some chats and memory are locked. Unlock to search them too.
        </button>
      )}
      {none && !busy && <div className="p-3 text-center font-label text-[11px] caps-18 text-faint">[Nothing found]</div>}
      {results.chats.length > 0 && <div className="px-1 pt-1 font-label text-[10px] font-bold caps-16 text-accent-soft">Chats {results.chats.length}</div>}
      {results.chats.map((hit) => (
        <button key={hit.sessionId} onClick={() => onOpenChat(hit.sessionId)} className="flex flex-col gap-0.5 border-l-2 border-l-transparent px-2.5 py-1.5 text-left hover:border-l-accent hover:bg-ink/[0.03]">
          <span className="flex items-center gap-2">
            <AgentAvatar agent={agents.find((a) => a.id === hit.agentId)} size={16} />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{highlight(hit.title, query)}</span>
            <span className="shrink-0 font-ui text-[10px] text-faint">{formatRelative(hit.at)}</span>
          </span>
          {hit.snippet && (
            <span className="line-clamp-2 text-[11.5px] leading-snug text-dim">
              {hit.role === 'user' ? 'You: ' : ''}
              {highlight(hit.snippet, query)}
            </span>
          )}
          {hit.matches > 1 && <span className="font-ui text-[10px] text-secondary/70">{hit.matches} messages match</span>}
        </button>
      ))}
      {results.memory.length > 0 && <div className="px-1 pt-2 font-label text-[10px] font-bold caps-16 text-accent-soft">Agent memory {results.memory.length}</div>}
      {busy && <div className="px-1 pt-2 font-label text-[10px] caps-14 text-faint">Searching agent memory…</div>}
      {results.memory.map((hit, i) => {
        const agent = agents.find((a) => a.id === hit.agentId)
        return (
          <button key={`${hit.agentId}-${hit.ref}-${i}`} onClick={() => openMemory(hit.agentId)} className="flex flex-col gap-0.5 border-l-2 border-l-transparent px-2.5 py-1.5 text-left hover:border-l-accent hover:bg-ink/[0.03]">
            <span className="flex items-center gap-2">
              <AgentAvatar agent={agent} size={16} />
              <span className="min-w-0 flex-1 truncate font-label text-[10.5px] caps-10 text-secondary">
                {agent?.name ?? 'Agent'} · {SOURCE[hit.source] ?? hit.source}
              </span>
              <span className="shrink-0 font-ui text-[10px] text-faint">{formatRelative(hit.at)}</span>
            </span>
            <span className="line-clamp-2 text-[11.5px] leading-snug text-dim">{highlight(hit.snippet, query)}</span>
          </button>
        )
      })}
    </div>
  )
}
