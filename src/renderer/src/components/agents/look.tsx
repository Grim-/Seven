import type { CSSProperties } from 'react'
import { agentSheets, type AgentLook, type AgentProfile, type AssetMeta } from '@shared/types'
import type { AvatarPose } from '@shared/moods'
import { showName } from '@shared/ids'
import { useData, assetUrl } from '../../store/data'
import { useAgents } from '../../store/agents'
import { useActiveTool, useAvatarReaction, useBubbles } from '../../store/reactions'
import { cn } from '../../lib/cn'
import { useAgentAvatar } from './avatars'
import { AvatarArt } from '../avatars/AvatarArt'
import { ThoughtTag } from '../avatars/ThoughtTag'
import { VfxFrame } from '../vfx'
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

export function AgentAvatar({
  agent,
  size = 64,
  className,
  sessionId,
  pose,
  showCharacterOverlay = true
}: {
  agent: AgentProfile | null | undefined
  size?: number
  className?: string
  sessionId?: string | null
  pose?: AvatarPose
  showCharacterOverlay?: boolean
}) {
  const avatar = useAgentAvatar(agent)
  const bubbles = useBubbles(sessionId ?? null)
  const tool = useActiveTool(sessionId ?? null)
  const cue = useAvatarReaction(sessionId ?? null)
  const style: CSSProperties = { width: size, height: size, ...lookVars(agent?.look) }
  const overlay = (
    <>
      {bubbles.length > 0 && (
        <span className="pointer-events-none absolute inset-0 z-20 flex items-start justify-end">
          {bubbles.slice(-3).map((b) => (
            <span key={b.id} className="animate-bubble -mr-1 -mt-1 leading-none drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]" style={{ fontSize: Math.max(12, Math.round(size * 0.5)) }}>
              {b.emoji}
            </span>
          ))}
        </span>
      )}
      {!pose && <ThoughtTag size={size} tool={tool} cue={cue} />}
    </>
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

  const vfxTargets = [sessionId ? `avatar:${sessionId}` : null, agent ? `agent:${agent.id}` : null, ...sheets.map((s) => `sheet:${s}`)]

  if (avatar) {
    return (
      <VfxFrame
        as="span"
        target={vfxTargets}
        style={style}
        title={playedSummary}
        className={cn('relative inline-block shrink-0 overflow-visible border border-accent/60 bg-black', hasSheet && 'border-accent', className)}
      >
        <span className="absolute inset-0 overflow-hidden">
          <AvatarArt avatar={avatar} sessionId={sessionId ?? null} pose={pose} />
        </span>
        {overlay}
        {characterBadge}
      </VfxFrame>
    )
  }
  return (
    <VfxFrame
      as="span"
      target={vfxTargets}
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.45)) }}
      title={playedSummary}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center border border-accent/60 bg-accent/10 font-mono font-bold uppercase text-accent',
        hasSheet && 'border-accent',
        className
      )}
    >
      <span className="inline-block">{(agent?.name ?? '?').trim().charAt(0) || '?'}</span>
      {overlay}
      {characterBadge}
    </VfxFrame>
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
