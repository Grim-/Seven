import { useAgents } from '../../store/agents'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { AgentAvatar } from '../agents/look'
import { EntryCard, Lines, Loading, BigStat } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useMind(agentId: string) {
  const memories = useLive(() => engine('mind.memories', { agentId }), 'mind.changed')
  const agent = useAgents((s) => s.list.find((a) => a.id === agentId))
  const sorted = [...(memories ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  return { memories, agent, sorted, pinned: sorted.filter((m) => m.pinned).length }
}

export function MindChat({ id }: EntrySurfaceProps) {
  const { memories, agent, sorted, pinned } = useMind(id)
  if (!memories) return <Loading />
  return (
    <EntryCard title={`${agent?.name ?? 'Agent'}'s mind`} tag="mind" aside={<span className="font-mono text-[11px] text-faint">{memories.length} memories · {pinned} pinned</span>}>
      <Lines
        items={sorted.slice(0, 6).map((m) => (
          <span key={m.id} className="min-w-0">
            <span className={m.pinned ? 'text-accent' : 'text-faint'}>◆ </span>
            {m.text}
          </span>
        ))}
      />
    </EntryCard>
  )
}

export function MindWidget({ id }: EntrySurfaceProps) {
  const { memories, agent, sorted, pinned } = useMind(id)
  if (!memories) return <Loading />
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <AgentAvatar agent={agent} size={34} />
        <BigStat value={memories.length} label={`${pinned} pinned`} />
      </div>
      {sorted[0] && <span className="text-[12px] text-dim">{sorted[0].text}</span>}
    </div>
  )
}
