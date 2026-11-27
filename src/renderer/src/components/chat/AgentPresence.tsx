import type { ReactNode } from 'react'
import type { AgentProfile } from '@shared/types'
import { AgentAvatar } from '../agents/look'
import { ChatSettings } from './ChatSettings'
import { useModels } from '../../store/models'
import { useLivePhase } from './StatusLine'
import { cn } from '../../lib/cn'

const SIZES = {
  hero: { avatar: 84, name: 'text-[30px] font-light tracking-[0.14em]', root: 'gap-4 pb-3 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-accent after:via-line after:to-transparent' },
  bar: { avatar: 40, name: 'text-[14px] font-semibold tracking-[0.14em]', root: 'gap-3' }
}

export type PresenceSize = keyof typeof SIZES

export function AgentPresence({ agent, sessionId, eyebrow, size, children }: { agent: AgentProfile | null; sessionId: string | null; eyebrow?: ReactNode; size: PresenceSize; children?: ReactNode }) {
  const phase = useLivePhase(sessionId)
  const loading = useModels((s) => s.host.status === 'loading')
  const look = SIZES[size]
  return (
    <div className={cn('relative flex min-w-0 items-end', look.root)}>
      <span className="presence-frame notch-sm shrink-0">
        {agent ? (
          <ChatSettings
            agent={agent}
            side="bottom"
            align="start"
            trigger={
              <span className="cursor-pointer transition-opacity hover:opacity-90" title={`${agent.name}${agent.sheet ? ` (Playing @sheet:${agent.sheet})` : ''} · Click or right-click for settings`}>
                <AgentAvatar agent={agent} size={look.avatar} sessionId={sessionId} className="border-accent" />
              </span>
            }
          />
        ) : (
          <AgentAvatar agent={null} size={look.avatar} sessionId={sessionId} className="border-accent" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="truncate font-label text-[10px] caps-22 text-accent-soft">{eyebrow}</div>}
        <div className={cn('truncate font-label caps leading-tight text-ink', look.name)}>
          <span className="text-accent">/</span>
          {agent?.name ?? 'Seven'}
        </div>
        <div className={cn('mt-1 flex min-w-0 items-center gap-2 font-label text-[10px] caps-18 ', phase ? 'text-secondary-ink' : 'text-faint')}>
          {phase && (
            <span className="signal shrink-0">
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
          <span className="truncate">{phase ?? (loading ? 'Loading model' : 'Ready')}</span>
        </div>
      </div>
      {children}
    </div>
  )
}
