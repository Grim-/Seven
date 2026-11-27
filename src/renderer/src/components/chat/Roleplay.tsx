import { useMemo, useRef, useState, type ComponentType } from 'react'
import { Eye, FolderOpen, MapPin, Maximize2, Minimize2, Minus, Pin, Plus, Sparkles } from 'lucide-react'
import { agentSheets, type AgentProfile, type AvatarSize } from '@shared/types'
import { showName } from '@shared/ids'
import { actorEntry, npcActorId } from '@shared/worldNpcs'
import { referencesIn, type TextReference } from '@shared/text'
import { registerChatElement, type ChatElementProps } from '../../registries/chatElements'
import { AgentAvatar } from '../agents/look'
import { CharacterAvatar } from './CharacterAvatar'
import { useCharacterStatus } from './status/useCharacterStatus'
import { HealthBar } from './status/HealthBar'
import { Markdown } from './Markdown'
import { findPage, useData } from '../../store/data'
import { useApp } from '../../store/app'
import { AssetMedia } from '../pictures/AssetMedia'
import { useEntryPreview } from '../entries/entryPreview'
import { EntryInspect } from '../entries/EntryInspect'
import { FloatLayer, openMenu, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { openSevenLink } from '../../lib/links'
import { useLive } from '../../lib/useLive'
import { useConversation } from '../../lib/conversation'
import { pinToChatTable } from './tabletopStore'

export const ROLEPLAY_SCENE = 'roleplay_scene'

export const AVATAR_SIZE_ORDER: AvatarSize[] = ['small', 'medium', 'large', 'xl']

export const ROLEPLAY_PORTRAIT_SIZE: Record<AvatarSize, number> = {
  small: 64,
  medium: 96,
  large: 136,
  xl: 184
}

export function stepAvatarSize(current: AvatarSize, delta: -1 | 1): void {
  const idx = AVATAR_SIZE_ORDER.indexOf(current)
  const next = AVATAR_SIZE_ORDER[Math.min(AVATAR_SIZE_ORDER.length - 1, Math.max(0, (idx === -1 ? 1 : idx) + delta))]
  if (next && next !== current) {
    void useApp.getState().updateSettings({ avatarSize: next })
  }
}

export function portraitSizeMenuItems(current: AvatarSize): MenuItem[] {
  const idx = AVATAR_SIZE_ORDER.indexOf(current)
  return [
    {
      label: 'Larger portraits',
      icon: <Maximize2 />,
      disabled: idx >= AVATAR_SIZE_ORDER.length - 1,
      onSelect: () => stepAvatarSize(current, 1)
    },
    {
      label: 'Smaller portraits',
      icon: <Minimize2 />,
      disabled: idx <= 0,
      onSelect: () => stepAvatarSize(current, -1)
    }
  ]
}

interface BeatViewProps {
  beat: RoleplayBeat
  agent: AgentProfile | null
  sessionId: string | null
  index: number
}

export interface RoleplayBeat {
  speaker: string | null
  text: string
  View: ComponentType<BeatViewProps>
}

const SAY = /^\s*\**([\p{L}\p{N}][\p{L}\p{N}' .-]{0,40}?)\**\s*:\s*((?:\*[^*\n]+\*\s*)*["“«].*)$/u
const ACT = /^\s*\*(?!\*)([^*\n].*?)\*\s*$/

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/["“”'.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

export function useSpeakerMatch(name: string, agent: AgentProfile | null) {
  const pages = useData((s) => s.pages)
  const worldNpcs = useLive(() => engine('npcs.list', { layer: 'play' }), ['npcs.changed', 'saves.changed']) ?? []
  const trimmed = name.trim()
  const lower = trimmed.toLowerCase()
  const isAgent = Boolean(agent && lower && agent.name.trim().toLowerCase() === lower)
  const sheets = agentSheets(agent)

  const matchedSheet = useMemo(() => {
    if (!lower || isAgent) return null
    const fromRoster = sheets.find((s) => {
      const sLower = s.toLowerCase()
      const sName = showName(s).toLowerCase()
      return sLower === lower || sName === lower || sLower.startsWith(lower) || lower.startsWith(sName)
    })
    if (fromRoster) return fromRoster

    const fromNpcs = worldNpcs.find((n) => {
      if (n.archetype || !n.worldId) return false
      const nTitle = showName(n.title).toLowerCase()
      const nId = showName(n.id).toLowerCase()
      return nTitle === lower || nId === lower || nTitle.startsWith(lower) || lower.startsWith(nTitle)
    })
    if (fromNpcs && fromNpcs.worldId) return npcActorId(fromNpcs.worldId, fromNpcs.id)

    const fromPages = pages.find((p) => {
      if (p.type !== 'sheet') return false
      const pTitle = p.title.toLowerCase()
      const pId = showName(p.id).toLowerCase()
      return pTitle === lower || pId === lower || pTitle.startsWith(lower) || lower.startsWith(pTitle)
    })
    return fromPages ? fromPages.id : null
  }, [isAgent, sheets, worldNpcs, pages, lower])

  const page = useMemo(() => {
    if (!lower || isAgent || matchedSheet) return null
    const said = words(trimmed)
    return (
      findPage(pages, trimmed) ??
      pages.find((p) => p.title.toLowerCase().startsWith(`${lower} `)) ??
      pages.find((p) => p.image && said.length > 0 && said.every((w) => words(p.title).includes(w))) ??
      null
    )
  }, [isAgent, matchedSheet, pages, trimmed, lower])

  return { isAgent, matchedSheet, page }
}

export function SpeakerStatusStrip({ sheetId }: { sheetId: string }) {
  const status = useCharacterStatus(sheetId)
  if (!status?.health) return null
  return (
    <div className="flex items-center gap-2">
      <div className="w-20">
        <HealthBar health={status.health} />
      </div>
      <span className="font-ui text-[10px] text-dim">
        {status.health.cur}/{status.health.max}
      </span>
    </div>
  )
}

export function PortraitSizeStepper({ avatarSize, className }: { avatarSize: AvatarSize; className?: string }) {
  const idx = AVATAR_SIZE_ORDER.indexOf(avatarSize)
  return (
    <div className={className ?? 'flex items-center gap-0.5'}>
      <button
        type="button"
        title="Smaller portraits"
        disabled={idx <= 0}
        onClick={(e) => {
          e.stopPropagation()
          stepAvatarSize(avatarSize, -1)
        }}
        className="flex h-5 w-5 items-center justify-center border border-line/60 tone-well-80 text-dim hover:border-accent hover:text-accent disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
      >
        <Minus className="h-2.5 w-2.5" />
      </button>
      <button
        type="button"
        title="Larger portraits"
        disabled={idx >= AVATAR_SIZE_ORDER.length - 1}
        onClick={(e) => {
          e.stopPropagation()
          stepAvatarSize(avatarSize, 1)
        }}
        className="flex h-5 w-5 items-center justify-center border border-line/60 tone-well-80 text-dim hover:border-accent hover:text-accent disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

export function SpeakerPortrait({
  name,
  agent,
  sessionId,
  isAgent,
  matchedSheet,
  pageId,
  pageImage,
  size,
  avatarSize,
  onInspect
}: {
  name: string
  agent: AgentProfile | null
  sessionId: string | null
  isAgent: boolean
  matchedSheet: string | null
  pageId: string | null
  pageImage: string | null
  size: number
  avatarSize: AvatarSize
  onInspect: () => void
}) {
  const frameStyle = { width: size, height: size }
  const resizeOverlay = (
    <PortraitSizeStepper
      avatarSize={avatarSize}
      className="pointer-events-auto absolute bottom-1 right-1 z-30 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/portrait:opacity-100"
    />
  )

  if (isAgent && agent) {
    return (
      <div className="group/portrait relative shrink-0" style={frameStyle}>
        <AgentAvatar agent={agent} size={size} sessionId={sessionId} />
        {resizeOverlay}
      </div>
    )
  }
  if (matchedSheet) {
    return (
      <div className="group/portrait relative shrink-0" style={frameStyle} onClick={onInspect}>
        <CharacterAvatar sheetId={matchedSheet} size={size} />
        {resizeOverlay}
      </div>
    )
  }
  if (pageId && pageImage) {
    return (
      <div className="group/portrait relative shrink-0" style={frameStyle}>
        <button
          type="button"
          title={`Inspect ${name}`}
          onClick={onInspect}
          style={frameStyle}
          className="overflow-hidden border border-accent/50 tone-well-60 hover:border-accent cursor-pointer"
        >
          <AssetMedia id={pageImage} className="h-full w-full object-cover" usedBy={`speaker:${name}`} />
        </button>
        {resizeOverlay}
      </div>
    )
  }
  return (
    <div className="group/portrait relative shrink-0" style={frameStyle}>
      <button
        type="button"
        title={pageId ? `Inspect ${name}` : name}
        disabled={!pageId}
        onClick={onInspect}
        style={{ ...frameStyle, fontSize: Math.max(16, Math.round(size * 0.32)) }}
        className="flex items-center justify-center border border-accent/50 bg-accent/10 font-ui font-bold text-accent enabled:hover:border-accent enabled:hover:bg-accent/20 enabled:cursor-pointer"
      >
        {name.slice(0, 2).toUpperCase()}
      </button>
      {resizeOverlay}
    </div>
  )
}

function BeatIllustrations({ text }: { text: string }) {
  const refs = useMemo(() => referencesIn(text), [text])
  if (!refs.length) return null
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {refs.map((item) => (
        <BeatIllustrationTile key={item.link} item={item} />
      ))}
    </div>
  )
}

function BeatIllustrationTile({ item }: { item: TextReference }) {
  const preview = useEntryPreview(item.link)
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  if (!preview || 'missing' in preview || !preview.image) return null
  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onContextMenu={(e) =>
          openMenu(e, showName(preview.title), [
            { label: 'Inspect here', icon: <Eye />, onSelect: () => setOpen(true) },
            { label: 'Pin to chat table', icon: <Pin />, onSelect: () => pinToChatTable(preview.kind, preview.id, preview.title) },
            { label: 'Open in Data', icon: <FolderOpen />, onSelect: () => openSevenLink(`seven:${preview.kind}/${encodeURIComponent(preview.id)}`) }
          ])
        }
        className="group/pic relative flex h-28 max-w-xs overflow-hidden border border-line/70 tone-well-70 hover:border-accent transition-colors cursor-pointer"
        title={`${showName(preview.title)} · Click to inspect`}
      >
        <AssetMedia id={preview.image} className="h-full w-44 object-cover transition-transform duration-300 group-hover/pic:scale-105" usedBy={item.link} />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 tone-panel-80 px-2 py-1 font-ui text-[9.5px]">
          <span className="truncate font-semibold text-ink">{showName(preview.title)}</span>
          <span className="shrink-0 caps text-accent">{preview.label}</span>
        </div>
      </button>
      {open && (
        <FloatLayer anchor={anchor} onClose={() => setOpen(false)} side="bottom" align="start">
          <EntryInspect kind={item.kind} refText={item.ref} onClose={() => setOpen(false)} />
        </FloatLayer>
      )}
    </>
  )
}

function SayBeatView({ beat, agent, sessionId }: BeatViewProps) {
  const speaker = beat.speaker ?? ''
  const avatarSize = useApp((s) => s.settings?.avatarSize ?? 'medium')
  const portraitSize = ROLEPLAY_PORTRAIT_SIZE[avatarSize] ?? ROLEPLAY_PORTRAIT_SIZE.medium
  const { isAgent, matchedSheet, page } = useSpeakerMatch(speaker, agent)
  const matchedEntry = matchedSheet ? actorEntry(matchedSheet) : null
  const inspectKind = matchedEntry ? matchedEntry.kind : page ? 'page' : null
  const inspectId = matchedEntry ? matchedEntry.id : (page?.id ?? null)
  const anchor = useRef<HTMLDivElement>(null)
  const [inspecting, setInspecting] = useState(false)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const items: MenuItem[] = []
    if (inspectKind && inspectId) {
      items.push(
        { label: 'Inspect character', icon: <Eye />, onSelect: () => setInspecting(true) },
        { label: 'Pin to chat table', icon: <Pin />, onSelect: () => pinToChatTable(inspectKind, inspectId, speaker) },
        { label: 'Open in Data', icon: <FolderOpen />, onSelect: () => openSevenLink(`seven:${inspectKind}/${encodeURIComponent(inspectId)}`) },
        { label: '', separator: true }
      )
    }
    items.push(...portraitSizeMenuItems(avatarSize))
    openMenu(e, speaker || 'Dialogue', items)
  }

  return (
    <div
      ref={anchor}
      onContextMenu={handleContextMenu}
      className="group/say relative flex items-start gap-3.5 phone:gap-2.5"
    >
      <SpeakerPortrait
        name={speaker}
        agent={agent}
        sessionId={sessionId}
        isAgent={isAgent}
        matchedSheet={matchedSheet}
        pageId={page?.id ?? null}
        pageImage={page?.image ?? null}
        size={portraitSize}
        avatarSize={avatarSize}
        onInspect={() => inspectKind && setInspecting((v) => !v)}
      />
      <div className="notch-sm relative min-w-0 flex-1 overflow-hidden border border-line/70 bg-gradient-to-b from-surface/95 to-scrim/90 px-4 py-3 shadow-[0_6px_24px_color-mix(in_srgb,var(--color-shade)_45%,transparent)]">
        <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-line/40 pb-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!inspectKind}
              onClick={() => inspectKind && setInspecting((v) => !v)}
              className="font-label text-[11px] font-bold caps-18 text-accent enabled:hover:text-ink enabled:cursor-pointer"
            >
              {speaker}
            </button>
            {matchedSheet && <SpeakerStatusStrip sheetId={matchedSheet} />}
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/say:opacity-100">
            <PortraitSizeStepper avatarSize={avatarSize} />
            {inspectKind && inspectId && (
              <>
                <button
                  type="button"
                  title={`Inspect ${speaker}`}
                  onClick={() => setInspecting((v) => !v)}
                  className="flex h-5 w-5 items-center justify-center border border-line/50 tone-well-50 text-dim hover:border-accent hover:text-accent cursor-pointer"
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title={`Pin ${speaker} to chat table`}
                  onClick={() => pinToChatTable(inspectKind, inspectId, speaker)}
                  className="flex h-5 w-5 items-center justify-center border border-line/50 tone-well-50 text-dim hover:border-accent hover:text-accent cursor-pointer"
                >
                  <Pin className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="text-[15px] leading-[1.7] text-ink/95 [&_em]:font-ui [&_em]:text-[13px] [&_em]:not-italic [&_em]:text-secondary-ink/85">
          <Markdown text={beat.text} />
        </div>
        <BeatIllustrations text={beat.text} />
      </div>
      {inspecting && inspectKind && inspectId && (
        <FloatLayer anchor={anchor} onClose={() => setInspecting(false)} side="bottom" align="start">
          <EntryInspect kind={inspectKind} refText={inspectId} onClose={() => setInspecting(false)} />
        </FloatLayer>
      )}
    </div>
  )
}

function ActBeatView({ beat }: BeatViewProps) {
  return (
    <div className="relative flex items-start gap-2.5 border border-secondary-ink/25 border-l-2 border-l-secondary-ink bg-secondary-ink/[0.04] px-3.5 py-2 text-[14px] italic leading-relaxed text-secondary-ink/90">
      <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-secondary-ink/70" />
      <div className="min-w-0 flex-1">
        <Markdown text={beat.text} />
        <BeatIllustrations text={beat.text} />
      </div>
    </div>
  )
}

function TellBeatView({ beat }: BeatViewProps) {
  return (
    <div className="relative border-y border-line/40 tone-surface-80 px-4 py-3 text-[15px] leading-[1.75] text-ink/90 before:absolute before:left-0 before:top-0 before:h-px before:w-12 before:bg-accent/60">
      <Markdown text={beat.text} />
      <BeatIllustrations text={beat.text} />
    </div>
  )
}

function makeSayBeat(speaker: string, initialText: string): RoleplayBeat {
  return {
    speaker,
    text: initialText,
    View: SayBeatView
  }
}

function makeActBeat(text: string): RoleplayBeat {
  return {
    speaker: null,
    text: text,
    View: ActBeatView
  }
}

function makeTellBeat(text: string): RoleplayBeat {
  return {
    speaker: null,
    text: text,
    View: TellBeatView
  }
}

export function parseRoleplay(text: string): RoleplayBeat[] {
  const blocks: RoleplayBeat[] = []
  const tell: string[] = []
  const flush = () => {
    const body = tell.join('\n').trim()
    if (body) blocks.push(makeTellBeat(body))
    tell.length = 0
  }
  for (const line of text.split('\n')) {
    const say = SAY.exec(line)
    if (say) {
      flush()
      const spk = say[1].trim()
      const spoken = say[2].trim()
      const last = blocks[blocks.length - 1]
      if (last && last.speaker === spk) last.text += `\n\n${spoken}`
      else blocks.push(makeSayBeat(spk, spoken))
      continue
    }
    const act = ACT.exec(line)
    if (act) {
      flush()
      blocks.push(makeActBeat(act[1].trim()))
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    tell.push(line)
  }
  flush()
  return blocks
}

export function firstSpeakerIn(text: string): string | null {
  const blocks = parseRoleplay(text)
  const found = blocks.find((b) => b.speaker !== null)
  return found?.speaker ?? null
}

export function ScenePlaceBanner({ placeRef }: { placeRef: string }) {
  const preview = useEntryPreview(placeRef)
  const anchor = useRef<HTMLDivElement>(null)
  const [inspecting, setInspecting] = useState(false)
  if (!preview || 'missing' in preview) return null
  return (
    <>
      <div
        ref={anchor}
        onClick={() => setInspecting((v) => !v)}
        onContextMenu={(e) =>
          openMenu(e, showName(preview.title), [
            { label: 'Inspect place', icon: <Eye />, onSelect: () => setInspecting(true) },
            { label: 'Pin to chat table', icon: <Pin />, onSelect: () => pinToChatTable('place', preview.id, preview.title) },
            { label: 'Open in Data', icon: <FolderOpen />, onSelect: () => openSevenLink(`seven:place/${encodeURIComponent(preview.id)}`) }
          ])
        }
        className="group/place relative flex items-center justify-between gap-3 overflow-hidden border border-secondary-ink/40 bg-gradient-to-r from-secondary-ink/15 via-scrim/85 to-scrim/90 px-3.5 py-2 font-ui cursor-pointer hover:border-secondary-ink transition-colors"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {preview.image ? (
            <AssetMedia id={preview.image} className="h-9 w-14 shrink-0 border border-secondary-ink/40 object-cover" usedBy={placeRef} />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-secondary-ink/40 bg-secondary-ink/10 text-secondary-ink">
              <MapPin className="h-4 w-4" />
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold caps-20 text-secondary-ink">Scene location</span>
              <span className="truncate text-[12.5px] font-bold caps-5 text-ink">{showName(preview.title)}</span>
            </div>
            {preview.card && <span className="truncate text-[11px] text-dim">{preview.card.split('\n')[0]}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            title="Pin place to chat table"
            onClick={(e) => {
              e.stopPropagation()
              pinToChatTable('place', preview.id, preview.title)
            }}
            className="flex h-6 w-6 items-center justify-center border border-line/60 tone-well-60 text-dim hover:border-accent hover:text-accent cursor-pointer"
          >
            <Pin className="h-3 w-3" />
          </button>
        </div>
      </div>
      {inspecting && (
        <FloatLayer anchor={anchor} onClose={() => setInspecting(false)} side="bottom" align="start">
          <EntryInspect kind="place" refText={preview.id} onClose={() => setInspecting(false)} />
        </FloatLayer>
      )}
    </>
  )
}

export function RoleplayText({ text, agent }: { text: string; agent: AgentProfile | null }) {
  const { sessionId } = useConversation()
  const blocks = useMemo(() => parseRoleplay(text), [text])
  const placeLinks = useMemo(
    () => referencesIn(text).filter((r) => r.link.startsWith('@place:') || (r.link.startsWith('@world:') && r.ref.includes('/place/'))),
    [text]
  )

  return (
    <div className="flex flex-col gap-3.5 py-1">
      {placeLinks.map((placeRef) => (
        <ScenePlaceBanner key={placeRef.link} placeRef={placeRef.link} />
      ))}
      {blocks.map((b, i) => (
        <b.View key={i} beat={b} agent={agent} sessionId={sessionId} index={i} />
      ))}
    </div>
  )
}

export function RoleplaySceneElement({ data }: ChatElementProps) {
  const text = typeof data.text === 'string' ? data.text : ''
  return <RoleplayText text={text} agent={null} />
}

registerChatElement(ROLEPLAY_SCENE, {
  View: RoleplaySceneElement,
  covers: () => 'hide'
})
