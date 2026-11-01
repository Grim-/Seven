import { useAgents } from '../../store/agents'
import { AgentAvatar } from '../agents/look'
import { withReferences } from '../chat/References'
import { LinkFaceList } from '../entries/LinkFaces'

export function ChatPreview({ text, agentId }: { text: string; agentId: string | null }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === agentId) ?? null)
  if (!text.trim()) return <div className="p-6 text-center font-mono text-[11px] text-faint">Nothing on the paper yet.</div>
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap border border-accent/40 bg-accent/[0.06] px-3.5 py-2.5 text-[14px] leading-relaxed text-white/90">{withReferences(text)}</div>
      </div>
      <LinkFaceList text={text} className="justify-end" />
      {agent && (
        <div className="flex items-center gap-2.5">
          <AgentAvatar agent={agent} size={40} />
          <span className="font-mono text-[11px] text-dim">{agent.name} replies here</span>
        </div>
      )}
    </div>
  )
}
