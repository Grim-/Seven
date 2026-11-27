import { Plus } from 'lucide-react'
import { ListRow } from '../ui'
import { AgentAvatar } from '../agents/look'
import { useSessions } from '../../store/sessions'
import { useAgents } from '../../store/agents'
import { formatRelative } from '../../lib/format'
import type { Conversation } from '../../lib/conversation'

export function RecentChats({ conv, onPick }: { conv: Conversation; onPick: () => void }) {
  const list = useSessions((s) => s.list)
  const running = useSessions((s) => s.running)
  const agents = useAgents((s) => s.list)
  return (
    <div className="flex max-h-[60vh] w-72 flex-col overflow-y-auto py-1">
      <ListRow
        active={!conv.sessionId}
        icon={<Plus className="h-4 w-4 text-accent" />}
        title="New chat"
        onClick={() => {
          useSessions.getState().startNew(conv)
          onPick()
        }}
      />
      {list.map((s) => (
        <ListRow
          key={s.id}
          active={s.id === conv.sessionId}
          icon={<AgentAvatar agent={agents.find((a) => a.id === s.agentId)} size={22} />}
          title={s.title}
          subtitle={formatRelative(s.updatedAt)}
          meta={running[s.id] ? <span className="h-1.5 w-1.5 animate-pulse bg-secondary-ink" /> : undefined}
          onClick={() => {
            conv.go(s.id)
            onPick()
          }}
        />
      ))}
    </div>
  )
}
