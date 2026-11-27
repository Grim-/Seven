import { useAgents } from '../../store/agents'
import { AgentAvatar } from './look'
import { cn } from '../../lib/cn'

export function AgentTiles({ value, onChange }: { value: string | null; onChange: (agentId: string) => void }) {
  const agents = useAgents((s) => s.list)
  return (
    <div className="flex flex-wrap gap-2">
      {agents.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onChange(a.id)}
          className={cn(
            'notch-sm flex w-28 flex-col items-center gap-1.5 border tone-panel-50 px-2 py-2 font-label text-[10.5px] caps-8 transition-colors',
            a.id === value ? 'border-accent text-ink shadow-[0_0_14px_color-mix(in_srgb,var(--color-accent)_calc(25%*var(--glow)),transparent)]' : 'border-line text-dim hover:border-accent/70 hover:text-ink'
          )}
        >
          <AgentAvatar agent={a} size={48} />
          <span className="w-full truncate text-center">{a.name}</span>
        </button>
      ))}
    </div>
  )
}
