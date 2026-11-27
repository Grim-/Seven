import type { BoardMessage } from '@shared/types'
import { EmptyState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { formatRelative } from '../../lib/format'
import { useAgents } from '../../store/agents'
import { AgentAvatar } from '../agents/look'
import { EntryCard, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useMessages() {
  return useLive(() => engine('board.list'), 'board.changed')
}

function Message({ m, size }: { m: BoardMessage; size: number }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === m.agentId))
  return (
    <div className="flex gap-2.5">
      <AgentAvatar agent={agent} size={size} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[12.5px]">
          <b className="text-ink">{m.author}</b> <span className="font-ui text-[10.5px] text-faint">{formatRelative(m.at)}</span>
        </span>
        <span className="whitespace-pre-wrap border border-ink/10 bg-ink/[0.03] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink/90">{m.text}</span>
      </div>
    </div>
  )
}

export function MessageChat({ id }: EntrySurfaceProps) {
  const list = useMessages()
  if (!list) return <Loading />
  const m = list.find((x) => x.id === id)
  if (!m) return <EmptyState title="Removed">This message is no longer on the board.</EmptyState>
  return (
    <EntryCard title="Agent board" tag="message">
      <Message m={m} size={30} />
    </EntryCard>
  )
}

export function MessageWidget() {
  const list = useMessages()
  if (!list) return <Loading />
  return (
    <div className="flex flex-col gap-2.5">
      {[...list]
        .sort((a, b) => b.at - a.at)
        .slice(0, 3)
        .map((m) => (
          <Message key={m.id} m={m} size={22} />
        ))}
    </div>
  )
}
