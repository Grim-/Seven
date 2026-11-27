import { useAgents } from '../../store/agents'
import { AgentAvatar } from '../agents/look'
import { withReferences } from '../chat/References'
import { LinkFaces } from '../entries/LinkFaces'

export function ChatPreview({ text, agentId }: { text: string; agentId: string | null }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === agentId) ?? null)
  if (!text.trim()) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center font-ui">
        <span className="text-[12px] caps-5 text-faint">Nothing on the paper yet</span>
        <span className="mt-1 text-[11px] text-dim">Add text notes and entities on the Paper tab to compose a prompt.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-4xl mx-auto">
      {/* User Message Simulation */}
      <div className="flex flex-col items-end gap-1.5 w-full">
        <div className="flex items-center gap-1.5 font-label text-[10px] caps text-dim">
          <span>You</span>
          <span>·</span>
          <span>Composer preview</span>
        </div>
        <div className="max-w-[85%] whitespace-pre-wrap border border-accent/40 bg-accent/[0.07] px-4 py-3 text-[14px] leading-relaxed text-ink/95 font-ui shadow-md">
          {withReferences(text)}
        </div>
        <LinkFaces text={text} />
      </div>

      {/* Agent Response Placeholder Simulation */}
      {agent && (
        <div className="mt-4 flex items-start gap-3 border-t border-line/30 pt-4">
          <AgentAvatar agent={agent} size={36} />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-label text-[12px] font-bold caps-5 text-accent">{agent.name}</span>
              <span className="border border-line/50 px-1 py-0.2 font-label text-[9px] text-dim caps">Active Agent</span>
            </div>
            <p className="font-ui text-[11.5px] text-dim">
              Agent will receive your prompt text with full self-describing entity contexts via <span className="text-secondary-ink font-semibold">@kind:ref</span> anchors.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
