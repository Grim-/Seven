import { MessageSquare } from 'lucide-react'
import { Markdown } from '../chat/Markdown'
import { Button, EmptyState, TraitChips } from '../ui'
import { useAgents } from '../../store/agents'
import { useModels, modelName } from '../../store/models'
import { useTools } from '../../store/tools'
import { openChat } from '../../lib/conversation'
import { cn } from '../../lib/cn'
import { AgentAvatar } from './look'
import { EntryCard } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useAgentEntry(id: string) {
  const agent = useAgents((s) => s.list.find((a) => a.id === id))
  const models = useModels((s) => s.list)
  const tools = useTools((s) => s.list)
  const modules = (agent?.modules ?? []).map((m) => ({ key: m, label: tools.find((t) => t.id === m)?.name ?? m }))
  return { agent, model: agent ? modelName(models, agent.modelId) : '', modules }
}

function ChatButton({ id }: { id: string }) {
  return (
    <Button size="sm" variant="primary" icon={<MessageSquare />} onClick={() => openChat(null, id)}>
      Chat
    </Button>
  )
}

export function AgentChat({ id }: EntrySurfaceProps) {
  const { agent, model, modules } = useAgentEntry(id)
  if (!agent) return <EmptyState title="Removed">This agent no longer exists.</EmptyState>
  return (
    <EntryCard title={agent.name} tag="agent" aside={<ChatButton id={id} />}>
      <div className="flex gap-3">
        <AgentAvatar agent={agent} size={54} />
        <div className="flex min-w-0 flex-col gap-1.5">
          {agent.description && <Markdown text={agent.description} className="text-[12.5px] text-dim" />}
          {(agent.relationships?.length ?? 0) > 0 && (
            <span className="font-ui text-[10.5px] text-secondary/85">
              {agent.relationships!.length} relationship{agent.relationships!.length === 1 ? '' : 's'}
              {agent.relationships!.some((r) => r.pinned)
                ? ` · ${agent.relationships!
                    .filter((r) => r.pinned)
                    .slice(0, 3)
                    .map((r) => `${r.target} (${r.stance})`)
                    .join(', ')}`
                : ''}
            </span>
          )}
          <TraitChips traits={modules} />
          <span className="font-ui text-[11px] text-faint">{model}</span>
        </div>
      </div>
    </EntryCard>
  )
}

function Profile({ id, large }: { id: string; large: boolean }) {
  const { agent, modules } = useAgentEntry(id)
  if (!agent) return null
  return (
    <div className={cn('flex items-center', large ? 'h-[60vh] gap-8 px-6' : 'h-full flex-col justify-center gap-2.5')}>
      <AgentAvatar agent={agent} size={large ? 180 : 64} />
      <div className={cn('flex flex-col gap-3', !large && 'items-center')}>
        {large && <span className="text-[40px] font-semibold text-ink">{agent.name}</span>}
        {large && agent.description && <Markdown text={agent.description} className="max-w-xl text-[16px] text-dim" />}
        {large && <TraitChips traits={modules} />}
        <span className={cn(large && 'self-start')}>
          <ChatButton id={id} />
        </span>
      </div>
    </div>
  )
}

export function AgentWidget({ id }: EntrySurfaceProps) {
  return <Profile id={id} large={false} />
}

export function AgentStage({ id }: EntrySurfaceProps) {
  return <Profile id={id} large />
}
