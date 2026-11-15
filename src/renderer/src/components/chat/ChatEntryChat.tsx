import type { ChatMessage, SessionSnapshot } from '@shared/types'
import { Button, EmptyState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { formatRelative } from '../../lib/format'
import { openChat } from '../../lib/library'
import { cn } from '../../lib/cn'
import { useAgents } from '../../store/agents'
import { AgentAvatar } from '../agents/look'
import { EntryCard, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'
import { noteFailure } from '../../store/problems'

function textOf(m: ChatMessage): string {
  return m.parts
    .flatMap((p) => (p.type === 'text' ? [p.text] : []))
    .join('\n')
    .trim()
}

function useChat(id: string) {
  return useLibraryData<SessionSnapshot | null>(() => engine('sessions.open', { id }).catch(noteFailure('chat', 'Could not open the chat', () => null)), id)
}

function Turns({ snap, count, large = false }: { snap: SessionSnapshot; count: number; large?: boolean }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === snap.meta.agentId))
  const turns = snap.messages.filter((m) => textOf(m)).slice(-count)
  return (
    <div className="flex flex-col gap-2">
      {turns.map((m) => (
        <div key={m.id} className={cn('flex gap-2', m.role === 'user' && 'justify-end')}>
          {m.role === 'assistant' && <AgentAvatar agent={agent} size={large ? 30 : 24} />}
          <span className={cn('max-w-[85%] whitespace-pre-wrap border px-2.5 py-1.5 leading-relaxed', large ? 'text-[15px]' : 'line-clamp-4 text-[12.5px]', m.role === 'user' ? 'border-teal/25 bg-teal/5' : 'border-white/10 bg-white/[0.03]')}>{textOf(m)}</span>
        </div>
      ))}
    </div>
  )
}

function Open({ id, label }: { id: string; label: string }) {
  return (
    <Button size="sm" variant="ghost" className="self-start" onClick={() => openChat(id)}>
      {label}
    </Button>
  )
}

export function ChatEntryChat({ id }: EntrySurfaceProps) {
  const snap = useChat(id)
  if (snap === null) return <Loading />
  if (!snap.meta) return <EmptyState title="Removed">This chat no longer exists.</EmptyState>
  const last = snap.messages[snap.messages.length - 1]
  return (
    <EntryCard title={snap.meta.title} tag="chat" aside={<span className="font-mono text-[11px] text-faint">{last ? formatRelative(last.createdAt) : ''} · {snap.messages.length} turns</span>}>
      <Turns snap={snap} count={3} />
      <Open id={id} label="Open chat" />
    </EntryCard>
  )
}

export function ChatEntryStage({ id }: EntrySurfaceProps) {
  const snap = useChat(id)
  if (!snap?.meta) return <Loading />
  return (
    <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
      <span className="font-mono text-[12px] uppercase tracking-[0.2em] text-accent-soft">{snap.meta.title}</span>
      <Turns snap={snap} count={snap.messages.length} large />
    </div>
  )
}

export function ChatEntryWidget({ id }: EntrySurfaceProps) {
  const snap = useChat(id)
  if (!snap?.meta) return <Loading />
  return (
    <div className="flex flex-col gap-2">
      <Turns snap={snap} count={1} />
      <Open id={id} label="Continue" />
    </div>
  )
}
