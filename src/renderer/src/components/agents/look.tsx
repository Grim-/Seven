import type { CSSProperties } from 'react'
import type { AgentLook, AgentProfile, AssetMeta, AvatarState } from '@shared/types'
import { useData, assetUrl } from '../../store/data'
import { useAgents } from '../../store/agents'
import { useAvatarState, useBubbles } from '../../store/reactions'
import { cn } from '../../lib/cn'
import { CodedAvatar } from './avatars'
import { useAgentIdOf, useFocusedConversation } from '../../lib/conversation'

export function lookVars(look: AgentLook | null | undefined): CSSProperties {
  if (!look?.accent) return {}
  const a = look.accent
  return {
    '--color-accent': a,
    '--color-accent-soft': `color-mix(in srgb, ${a} 82%, black)`,
    '--color-accent-dark': `color-mix(in srgb, ${a} 60%, black)`,
    '--color-line': `color-mix(in srgb, ${a} 35%, transparent)`,
    '--color-line-strong': `color-mix(in srgb, ${a} 60%, transparent)`
  } as CSSProperties
}

export function useActiveAgent(): AgentProfile | null {
  const agentId = useAgentIdOf(useFocusedConversation())
  return useAgents((s) => s.list.find((a) => a.id === agentId) ?? null)
}

function useAsset(id: string | null | undefined): AssetMeta | null {
  return useData((s) => (id ? (s.assets.find((a) => a.id === id) ?? null) : null))
}

export function Media({ asset, className }: { asset: AssetMeta; className?: string }) {
  const url = assetUrl(asset)
  if (asset.kind === 'video') return <video src={url} autoPlay loop muted playsInline className={cn('object-cover', className)} />
  return <img src={url} alt="" draggable={false} className={cn('object-cover', className)} />
}

const MOTION: Record<AvatarState, string> = {
  idle: 'av-breathe',
  thinking: '',
  talking: 'av-pulse',
  laughing: 'av-shake',
  happy: 'av-bob',
  sad: 'av-droop',
  error: 'av-flicker',
  angry: 'av-shake'
}

const TINT: Partial<Record<AvatarState, string>> = {
  angry: 'rgba(255,30,60,0.38)',
  error: 'rgba(255,60,60,0.3)',
  sad: 'rgba(60,90,170,0.38)',
  happy: 'rgba(74,222,128,0.16)',
  laughing: 'rgba(250,204,21,0.2)'
}

function StateFx({ state }: { state: AvatarState }) {
  return (
    <>
      {TINT[state] && <span className="pointer-events-none absolute inset-0 z-10 mix-blend-color" style={{ background: TINT[state] }} />}
      {state === 'thinking' && (
        <span className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <span className="av-scan absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-[color-mix(in_srgb,var(--color-cyan)_45%,transparent)] to-transparent" />
        </span>
      )}
    </>
  )
}

export function AgentAvatar({ agent, size = 24, className, sessionId, mood }: { agent: AgentProfile | null | undefined; size?: number; className?: string; sessionId?: string | null; mood?: AvatarState }) {
  const avatar = agent?.look.avatar
  const asset = useAsset(avatar?.kind === 'file' ? avatar.assetId : null)
  const live = useAvatarState(sessionId ?? null)
  const state = mood ?? live
  const bubbles = useBubbles(sessionId ?? null)
  const style: CSSProperties = { width: size, height: size, ...lookVars(agent?.look) }
  const overlay = bubbles.length > 0 && (
    <span className="pointer-events-none absolute inset-0 z-20 flex items-start justify-end">
      {bubbles.slice(-3).map((b) => (
        <span key={b.id} className="animate-bubble -mr-1 -mt-1 leading-none drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]" style={{ fontSize: Math.max(12, Math.round(size * 0.5)) }}>
          {b.emoji}
        </span>
      ))}
    </span>
  )
  if (avatar?.kind === 'coded') {
    return (
      <span style={style} className={cn('relative inline-block shrink-0 overflow-visible border border-accent/60 bg-black', className)}>
        <span className="absolute inset-0 overflow-hidden">
          <CodedAvatar type={avatar.type} state={state} size={size} />
        </span>
        {overlay}
      </span>
    )
  }
  const motion = state === 'idle' && size < 40 ? '' : MOTION[state]
  if (asset && (asset.kind === 'image' || asset.kind === 'video')) {
    return (
      <span style={style} className={cn('relative inline-block shrink-0 overflow-visible border border-accent/60 bg-black', className)}>
        <span className="absolute inset-0 overflow-hidden">
          <span className={cn('block h-full w-full', motion, state === 'sad' && 'grayscale-[0.5]')}>
            <Media asset={asset} className="h-full w-full" />
          </span>
          <StateFx state={state} />
        </span>
        {overlay}
      </span>
    )
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.45)) }}
      className={cn('relative inline-flex shrink-0 items-center justify-center border border-accent/60 bg-accent/10 font-mono font-bold uppercase text-accent', className)}
    >
      <span className={cn('inline-block', motion)}>{(agent?.name ?? '?').trim().charAt(0) || '?'}</span>
      <StateFx state={state} />
      {overlay}
    </span>
  )
}

export function LookBackground({ look }: { look: AgentLook | null | undefined }) {
  const asset = useAsset(look?.background)
  if (!look || (!asset && !look.tint)) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {asset && (asset.kind === 'image' || asset.kind === 'video') && (
        <div className="absolute inset-0" style={{ opacity: look.backgroundOpacity }}>
          <Media asset={asset} className="h-full w-full" />
        </div>
      )}
      {look.tint && <div className="absolute inset-0" style={{ background: look.tint, opacity: look.tintStrength }} />}
    </div>
  )
}
