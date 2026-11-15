import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, FolderOpen, Layers, Pin, RotateCcw, Sparkles } from 'lucide-react'
import { registerChatElement, type ChatElementProps } from '../../registries/chatElements'
import { useApp } from '../../store/app'
import { useAgents } from '../../store/agents'
import { useSessions } from '../../store/sessions'
import { useConversation } from '../../lib/conversation'
import { cn } from '../../lib/cn'
import { openSevenLink } from '../../lib/links'
import { copyText } from '../../lib/notify'
import { FloatLayer, openMenu, type MenuItem } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { EntryInspect } from '../entries/EntryInspect'
import { Markdown } from './Markdown'
import { pinToChatTable } from './tabletopStore'
import {
  ROLEPLAY_PORTRAIT_SIZE,
  ScenePlaceBanner,
  SpeakerPortrait,
  SpeakerStatusStrip,
  portraitSizeMenuItems,
  useSpeakerMatch
} from './Roleplay'

export const VN_BEAT = 'vn_beat'

const TONE_CLASS: Record<string, string> = {
  accent: 'border-accent/60 [--vn-tone:var(--color-accent)]',
  cyan: 'border-cyan/60 [--vn-tone:var(--color-cyan)]',
  purple: 'border-purple/60 [--vn-tone:var(--color-purple)]',
  teal: 'border-teal/60 [--vn-tone:var(--color-teal)]',
  alert: 'border-alert/60 [--vn-tone:var(--color-alert)]'
}

const EXPRESSION_CLASS: Record<string, string> = {
  calm: 'border-teal/50 bg-teal/15 text-teal',
  happy: 'border-teal/50 bg-teal/15 text-teal',
  amused: 'border-teal/50 bg-teal/15 text-teal',
  smirking: 'border-accent/50 bg-accent/15 text-accent',
  confident: 'border-accent/50 bg-accent/15 text-accent',
  curious: 'border-cyan/50 bg-cyan/15 text-cyan',
  whisper: 'border-purple/50 bg-purple/15 text-purple',
  mysterious: 'border-purple/50 bg-purple/15 text-purple',
  sad: 'border-purple/50 bg-purple/15 text-purple',
  angry: 'border-alert/60 bg-alert/20 text-alert',
  alarmed: 'border-alert/60 bg-alert/20 text-alert',
  shocked: 'border-alert/60 bg-alert/20 text-alert'
}

function readLines(data: Record<string, unknown>): string[] {
  if (Array.isArray(data.lines)) {
    const out = data.lines.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim())
    if (out.length) return out
  }
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  if (!text) return []
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Visual-novel dialogue beat card with portrait, expression badge, scene CG header, and step/typewriter playback. */
export function VnBeatView({ data, messageId }: ChatElementProps) {
  const { sessionId } = useConversation()
  const sessionAgentId = useSessions((s) => (sessionId ? s.list.find((x) => x.id === sessionId)?.agentId ?? null : null))
  const agent = useAgents((s) => (sessionAgentId ? s.list.find((a) => a.id === sessionAgentId) ?? null : null))
  const avatarSize = useApp((s) => s.settings?.avatarSize ?? 'medium')
  const portraitSize = Math.max(88, Math.round((ROLEPLAY_PORTRAIT_SIZE[avatarSize] ?? ROLEPLAY_PORTRAIT_SIZE.medium) * 1.15))

  const speaker = typeof data.speaker === 'string' ? data.speaker.trim() : ''
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null
  const expression = typeof data.expression === 'string' && data.expression.trim() ? data.expression.trim() : null
  const scene = typeof data.scene === 'string' && data.scene.trim() ? data.scene.trim() : null
  const customImage = typeof data.image === 'string' && data.image.trim() ? data.image.trim() : null
  const cgImage = typeof data.cg === 'string' && data.cg.trim() ? data.cg.trim() : null
  const side = data.side === 'right' ? 'right' : 'left'
  const tone = typeof data.tone === 'string' && data.tone in TONE_CLASS ? data.tone : 'accent'

  const lines = useMemo(() => readLines(data), [data])
  const [step, setStep] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [typed, setTyped] = useState(0)
  const [replayTick, setReplayTick] = useState(0)
  const [inspecting, setInspecting] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)

  const clampedStep = Math.min(step, Math.max(0, lines.length - 1))
  const activeLine = lines[clampedStep] ?? ''
  const typing = !showAll && typed < activeLine.length

  useEffect(() => {
    setStep(0)
    setTyped(0)
  }, [messageId, lines.length])

  useEffect(() => {
    if (showAll) {
      setTyped(activeLine.length)
      return
    }
    setTyped(0)
    if (!activeLine.length) return
    const timer = window.setInterval(() => {
      setTyped((prev) => {
        const next = Math.min(activeLine.length, prev + 2)
        if (next >= activeLine.length) window.clearInterval(timer)
        return next
      })
    }, 18)
    return () => window.clearInterval(timer)
  }, [activeLine, showAll, replayTick])

  const { isAgent, matchedSheet, page } = useSpeakerMatch(speaker, agent)
  const inspectKind = matchedSheet ? 'sheet' : page ? 'page' : null
  const inspectId = matchedSheet ?? page?.id ?? null

  const exprStyle = expression ? (EXPRESSION_CLASS[expression.toLowerCase()] ?? 'border-accent/45 bg-accent/15 text-accent') : ''
  const visibleText = typing ? activeLine.slice(0, typed) : activeLine

  const handleBoxClick = () => {
    if (showAll) return
    if (typing) {
      setTyped(activeLine.length)
      return
    }
    if (clampedStep < lines.length - 1) setStep((s) => Math.min(lines.length - 1, s + 1))
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const items: MenuItem[] = [
      { label: 'Copy dialogue', icon: <Layers />, onSelect: () => void copyText(lines.join('\n\n'), 'Copied', 'VN beat lines') }
    ]
    if (inspectKind && inspectId) {
      items.push(
        { label: `Inspect ${speaker}`, icon: <Eye />, onSelect: () => setInspecting(true) },
        { label: 'Pin to chat table', icon: <Pin />, onSelect: () => pinToChatTable(inspectKind, inspectId, speaker) },
        { label: 'Open in Data', icon: <FolderOpen />, onSelect: () => openSevenLink(`seven:${inspectKind}/${encodeURIComponent(inspectId)}`) }
      )
    }
    items.push({ label: '', separator: true }, ...portraitSizeMenuItems(avatarSize))
    openMenu(e, speaker || 'Visual Novel Beat', items)
  }

  return (
    <div ref={anchor} onContextMenu={handleContextMenu} className="my-1.5 flex flex-col gap-2">
      {scene && (scene.startsWith('@place:') ? <ScenePlaceBanner placeRef={scene} /> : (
        <div className="flex items-center gap-2 border border-line/50 bg-black/75 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan">
          <Sparkles className="h-3 w-3 shrink-0" />
          <span className="truncate">{scene}</span>
        </div>
      ))}

      {cgImage && (
        <div className="relative overflow-hidden border border-line/60 bg-black/80">
          <AssetMedia id={cgImage} className="max-h-64 w-full object-cover" usedBy={`vn:${speaker || messageId}`} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/85 to-transparent" />
        </div>
      )}

      <div
        className={cn(
          'notch-sm relative flex items-stretch gap-3.5 overflow-hidden border bg-gradient-to-b from-[#0b1019]/95 via-[#070a10]/95 to-black/95 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.55)]',
          side === 'right' && 'flex-row-reverse',
          TONE_CLASS[tone]
        )}
      >
        {(speaker || customImage) && (
          <div className="flex shrink-0 flex-col items-center gap-1">
            {customImage ? (
              <div style={{ width: portraitSize, height: Math.round(portraitSize * 1.2) }} className="relative overflow-hidden border border-accent/55 bg-black/70">
                <AssetMedia id={customImage} className="h-full w-full object-cover" usedBy={`vn:${speaker}`} />
              </div>
            ) : (
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
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/45 pb-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {speaker ? (
                <button
                  type="button"
                  disabled={!inspectKind}
                  onClick={() => inspectKind && setInspecting((v) => !v)}
                  className="font-mono text-[11.5px] font-bold uppercase tracking-[0.2em] text-accent enabled:hover:text-white enabled:cursor-pointer"
                >
                  {speaker}
                </button>
              ) : (
                <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-dim">NARRATION</span>
              )}
              {title && <span className="font-mono text-[10px] uppercase tracking-wider text-dim">· {title}</span>}
              {expression && (
                <span className={cn('border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]', exprStyle)}>
                  {expression}
                </span>
              )}
              {matchedSheet && <SpeakerStatusStrip sheetId={matchedSheet} />}
            </div>
            {lines.length > 0 && (
              <div className="flex items-center gap-1 font-mono text-[10px]">
                {!showAll && (
                  <button
                    type="button"
                    title="Replay typing"
                    onClick={() => setReplayTick((n) => n + 1)}
                    className="flex h-5 items-center gap-1 border border-line/50 px-1.5 text-dim hover:border-accent/60 hover:text-accent"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                  </button>
                )}
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className={cn(
                      'flex h-5 items-center gap-1 border px-1.5 uppercase tracking-wider',
                      showAll ? 'border-accent/60 bg-accent/15 text-accent' : 'border-line/50 text-dim hover:text-white'
                    )}
                  >
                    {showAll ? 'Step' : 'All'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div
            onClick={handleBoxClick}
            className={cn(
              'min-h-[3.4rem] text-[15px] leading-[1.7] text-white/95 [&_em]:font-mono [&_em]:text-[13px] [&_em]:not-italic [&_em]:text-cyan/85',
              !showAll && (typing || clampedStep < lines.length - 1) && 'cursor-pointer'
            )}
          >
            {showAll ? (
              <div className="flex flex-col gap-2">
                {lines.map((line, i) => (
                  <Markdown key={i} text={line} />
                ))}
              </div>
            ) : (
              <div>
                <Markdown text={visibleText} />
                {typing && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-blink bg-accent" />}
              </div>
            )}
          </div>

          {!showAll && lines.length > 1 && (
            <div className="flex items-center justify-between border-t border-line/30 pt-1.5 font-mono text-[10px] text-dim">
              <div className="flex items-center gap-1">
                {lines.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn('h-1.5 transition-all', i === clampedStep ? 'w-4 bg-accent' : 'w-1.5 bg-line/60 hover:bg-dim')}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={clampedStep === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="flex h-5 w-5 items-center justify-center border border-line/50 hover:border-accent hover:text-accent disabled:opacity-30"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="tabular-nums">
                  {clampedStep + 1} / {lines.length}
                </span>
                <button
                  type="button"
                  onClick={handleBoxClick}
                  disabled={!typing && clampedStep >= lines.length - 1}
                  className="flex h-5 items-center gap-0.5 border border-accent/50 bg-accent/10 px-1.5 text-accent hover:bg-accent/20 disabled:opacity-30"
                >
                  {typing ? 'Skip' : 'Next'} <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {inspecting && inspectKind && inspectId && (
        <FloatLayer anchor={anchor} onClose={() => setInspecting(false)} side="bottom" align="start">
          <EntryInspect kind={inspectKind} refText={inspectId} onClose={() => setInspecting(false)} />
        </FloatLayer>
      )}
    </div>
  )
}

registerChatElement(VN_BEAT, {
  View: VnBeatView,
  covers: (data) => (data.cover === 'hide' ? 'hide' : data.cover === 'fold' ? 'fold' : null)
})
