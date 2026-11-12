import type { CSSProperties } from 'react'
import { agentSheets, type AgentLook, type AgentProfile, type AssetMeta, type AvatarState } from '@shared/types'
import { showName } from '@shared/ids'
import { useData, assetUrl } from '../../store/data'
import { useAgents } from '../../store/agents'
import { useAvatarState, useBubbles } from '../../store/reactions'
import { cn } from '../../lib/cn'
import { CodedAvatar } from './avatars'
import { useAgentIdOf, useFocusedConversation } from '../../lib/conversation'
import { useEntryPreview } from '../entries/entryPreview'
import { AssetMedia } from '../pictures/AssetMedia'

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

export function AgentAvatar({
  agent,
  size = 64,
  className,
  sessionId,
  mood,
  showCharacterOverlay = true
}: {
  agent: AgentProfile | null | undefined
  size?: number
  className?: string
  sessionId?: string | null
  mood?: AvatarState
  showCharacterOverlay?: boolean
}) {
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

  const sheets = agentSheets(agent)
  const count = sheets.length
  const hasSheet = Boolean(showCharacterOverlay && count > 0)
  const primarySheet = sheets[0] ?? ''
  const sheetPreview = useEntryPreview(hasSheet && primarySheet ? `@sheet:${primarySheet}` : '')
  const validSheet = sheetPreview && !('missing' in sheetPreview) ? sheetPreview : null

  const characterBadge = hasSheet && (
    <span
      className={cn(
        'pointer-events-none absolute -bottom-1 -right-1 z-20 flex items-center justify-center overflow-hidden border border-accent bg-black shadow-[0_0_6px_rgba(0,0,0,0.9)]',
        size < 20 ? 'h-1.5 w-1.5 -bottom-0.5 -right-0.5 border-none bg-accent' : ''
      )}
      title={
        count > 1
          ? `In character as ${count} characters (${validSheet ? showName(validSheet.title) : primarySheet} +${count - 1} more)`
          : `In character: ${validSheet ? showName(validSheet.title) : primarySheet}`
      }
      style={
        size >= 20
          ? {
              width: count === 1 && validSheet?.image ? Math.max(13, Math.round(size * 0.44)) : undefined,
              height: Math.max(13, Math.round(size * 0.44)),
              minWidth: Math.max(13, Math.round(size * 0.44))
            }
          : undefined
      }
    >
      {size >= 20 && (
        count > 1 ? (
          <span className="flex h-full w-full items-center justify-center px-0.5 font-mono text-[7px] font-bold uppercase leading-none tracking-tight text-accent">
            {count}C
          </span>
        ) : validSheet?.image ? (
          <AssetMedia id={validSheet.image} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-1 font-mono text-[7px] font-bold uppercase leading-none tracking-tight text-accent">
            CHR
          </span>
        )
      )}
    </span>
  )

  const playedSummary = hasSheet
    ? `${agent?.name ?? 'Agent'} (Playing ${count > 1 ? `${count} characters` : validSheet ? showName(validSheet.title) : primarySheet})`
    : undefined

  if (avatar?.kind === 'coded') {
    return (
      <span
        style={style}
        title={playedSummary}
        className={cn('relative inline-block shrink-0 overflow-visible border border-accent/60 bg-black', hasSheet && 'border-accent', className)}
      >
        <span className="absolute inset-0 overflow-hidden">
          <CodedAvatar type={avatar.type} state={state} size={size} />
        </span>
        {overlay}
        {characterBadge}
      </span>
    )
  }
  const motion = state === 'idle' && size < 40 ? '' : MOTION[state]
  if (asset && (asset.kind === 'image' || asset.kind === 'video')) {
    return (
      <span
        style={style}
        title={playedSummary}
        className={cn('relative inline-block shrink-0 overflow-visible border border-accent/60 bg-black', hasSheet && 'border-accent', className)}
      >
        <span className="absolute inset-0 overflow-hidden">
          <span className={cn('block h-full w-full', motion, state === 'sad' && 'grayscale-[0.5]')}>
            <Media asset={asset} className="h-full w-full" />
          </span>
          <StateFx state={state} />
        </span>
        {overlay}
        {characterBadge}
      </span>
    )
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.45)) }}
      title={playedSummary}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center border border-accent/60 bg-accent/10 font-mono font-bold uppercase text-accent',
        hasSheet && 'border-accent',
        className
      )}
    >
      <span className={cn('inline-block', motion)}>{(agent?.name ?? '?').trim().charAt(0) || '?'}</span>
      <StateFx state={state} />
      {overlay}
      {characterBadge}
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
