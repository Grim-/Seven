import { useAgents } from '../../store/agents'
import { formatRelative } from '../../lib/format'
import { cn } from '../../lib/cn'
import { AgentAvatar } from './look'

export function ChangedBy({ by, at, className }: { by: string | null; at: number; className?: string }) {
  const agent = useAgents((s) => (by ? s.list.find((a) => a.id === by) : undefined))
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-ui text-[10px] text-faint', className)} title={new Date(at).toLocaleString()}>
      {agent && <AgentAvatar agent={agent} size={14} />}
      <span>
        {by ? (agent?.name ?? 'an agent') : 'you'} · {formatRelative(at)}
      </span>
    </span>
  )
}
