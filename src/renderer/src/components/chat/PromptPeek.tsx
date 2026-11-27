import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Copy, Pin, ScrollText } from 'lucide-react'
import type { PromptSection, PromptView } from '@shared/types'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { aggregatePromptSources, formatPromptTokens, sourceTone } from '../../lib/promptSources'
import { draftOf, useSessions } from '../../store/sessions'
import { cn } from '../../lib/cn'
import { useConversation } from '../../lib/conversation'
import { Tooltip } from '../ui'

const CLOSE_DELAY = 220

function pctLabel(tokens: number, total: number): string {
  if (!total) return '0%'
  const pct = Math.round((tokens / total) * 100)
  return pct < 1 && tokens > 0 ? '<1%' : `${pct}%`
}

function PromptSectionCard({
  section,
  totalTokens,
  highlighted,
  collapsed,
  onToggleCollapse,
  onHoverSource
}: {
  section: PromptSection
  totalTokens: number
  highlighted: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onHoverSource: (sourceId: string | null) => void
}) {
  const tone = sourceTone(section.sourceId)
  const share = pctLabel(section.tokens, totalTokens)
  return (
    <div
      onMouseEnter={() => onHoverSource(section.sourceId)}
      onMouseLeave={() => onHoverSource(null)}
      className={cn(
        'min-w-0 border border-line/25 transition-colors',
        highlighted ? tone.blockActive : tone.block
      )}
    >
      <Tooltip
        title={section.label}
        side="top"
        body={`${section.detail} · ~${section.tokens.toLocaleString()} tokens (${share})`}
        className="block w-full min-w-0"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full min-w-0 items-center gap-2 px-2.5 py-1.5 text-left font-ui text-[11px]"
        >
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', tone.text, !collapsed && 'rotate-90')} />
          <span className={cn('shrink-0 font-semibold caps-8 ', tone.text)}>{section.label}</span>
          <span className="min-w-0 flex-1 truncate font-body text-[11px] text-dim">{section.detail}</span>
          <span className="shrink-0 text-[10.5px] text-faint">
            ~{formatPromptTokens(section.tokens)} tok · {share}
          </span>
        </button>
      </Tooltip>
      {!collapsed && (
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words border-t border-line/20 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink/90">
          {section.text}
        </pre>
      )}
    </div>
  )
}

export function PromptPeek() {
  const conv = useConversation()
  const activeId = conv.sessionId
  const draftAgentId = useSessions((s) => draftOf(s, conv.key).agentId)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [view, setView] = useState<PromptView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hoveredSource, setHoveredSource] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [place, setPlace] = useState<{ top?: number; bottom?: number; left: number; width: number; height: number }>({ top: 0, left: 0, width: 0, height: 0 })
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  const cancelClose = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const measure = () => {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const margin = 12
    const width = Math.min(820, window.innerWidth - margin * 2)
    const left = Math.min(Math.max(margin, r.right - width), window.innerWidth - width - margin)
    const spaceBelow = window.innerHeight - r.bottom - 8 - margin
    const spaceAbove = r.top - 8 - margin
    if (spaceBelow < 240 && spaceAbove > spaceBelow) {
      setPlace({
        bottom: Math.max(margin, window.innerHeight - r.top + 8),
        left,
        width,
        height: Math.max(180, Math.min(680, spaceAbove))
      })
    } else {
      setPlace({
        top: Math.max(margin, r.bottom + 8),
        left,
        width,
        height: Math.max(180, Math.min(680, spaceBelow))
      })
    }
  }
  const show = () => {
    cancelClose()
    measure()
    setOpen(true)
  }
  const hideSoon = () => {
    if (pinned) return
    cancelClose()
    timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY)
  }

  useEffect(() => {
    if (!open) return
    let live = true
    setError(null)
    engine('sessions.prompt', { id: activeId, agentId: draftAgentId })
      .then((v) => {
        if (!live) return
        setView(v)
        setActiveSource(null)
        setCollapsed({})
      })
      .catch((err) => live && setError(errorText(err)))
    return () => {
      live = false
    }
  }, [open, activeId, draftAgentId])

  useEffect(() => {
    if (!pinned) return
    const away = (e: MouseEvent) => {
      if (panel.current?.contains(e.target as Node) || button.current?.contains(e.target as Node)) return
      setPinned(false)
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPinned(false)
      setOpen(false)
    }
    window.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [pinned])

  useEffect(() => cancelClose, [])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  const sections = view?.sections ?? []
  const sources = useMemo(() => aggregatePromptSources(sections), [sections])
  const totalSectionTokens = useMemo(() => sections.reduce((sum, s) => sum + s.tokens, 0), [sections])
  const visibleSections = useMemo(
    () => (activeSource ? sections.filter((s) => s.sourceId === activeSource) : sections),
    [sections, activeSource]
  )
  const toolSections = sections.filter((s) => s.kind === 'tool')
  const allToolsFolded = toolSections.length > 0 && toolSections.every((s) => collapsed[s.id])

  const toggleAllTools = () => {
    const nextVal = !allToolsFolded
    setCollapsed((prev) => {
      const next = { ...prev }
      for (const s of toolSections) next[s.id] = nextVal
      return next
    })
  }

  return (
    <>
      <button
        ref={button}
        title="What the agent sees (click to keep it open)"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onClick={() => {
          if (pinned) {
            setPinned(false)
            setOpen(false)
          } else {
            show()
            setPinned(true)
          }
        }}
        className={cn('flex h-7 w-7 shrink-0 items-center justify-center border', pinned ? 'border-accent/70 text-accent' : 'border-line/60 text-dim hover:text-ink')}
      >
        <ScrollText className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            onMouseEnter={cancelClose}
            onMouseLeave={hideSoon}
            style={{
              position: 'fixed',
              ...(place.top !== undefined ? { top: place.top } : {}),
              ...(place.bottom !== undefined ? { bottom: place.bottom } : {}),
              left: place.left,
              width: place.width,
              maxHeight: place.height
            }}
            className="record z-[250] flex flex-col overflow-hidden"
          >
            <div className="record-header flex shrink-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate">What the agent sees</span>
              {view && (
                <span className="shrink-0 font-ui text-[10px] normal-case tracking-normal text-faint">
                  {view.format !== 'none' ? `${view.format} · ` : ''}
                  {view.tokens !== null ? `~${view.tokens.toLocaleString()} tokens · ` : ''}
                  {view.text.length.toLocaleString()} chars
                </span>
              )}
              <button
                title="Copy all"
                disabled={!view}
                onClick={() => {
                  if (!view) return
                  void navigator.clipboard.writeText(view.text).then(() => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1200)
                  })
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center text-dim hover:text-accent disabled:opacity-40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button
                title={pinned ? 'Unpin' : 'Keep open'}
                onClick={() => setPinned((p) => !p)}
                className={cn('flex h-5 w-5 shrink-0 items-center justify-center hover:text-accent', pinned ? 'text-accent' : 'text-dim')}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            </div>
            {view?.note && <div className="relative z-[2] shrink-0 border-b border-line/40 px-3 py-1.5 text-[11.5px] text-dim">{view.note}</div>}
            {sources.length > 0 && (
              <div className="relative z-[2] flex shrink-0 flex-col gap-2 border-b border-line/40 tone-panel-35 px-3 py-2">
                <div className="segment-mask flex h-1.5 w-full overflow-hidden bg-ink/[0.06]">
                  {sources.map((src) => {
                    const tone = sourceTone(src.sourceId)
                    const widthPct = totalSectionTokens ? Math.max(1, (src.tokens / totalSectionTokens) * 100) : 0
                    return (
                      <Tooltip
                        key={src.sourceId}
                        title={src.label}
                        side="bottom"
                        body={`${src.detail} · ~${src.tokens.toLocaleString()} tokens (${pctLabel(src.tokens, totalSectionTokens)})`}
                        className="block h-full shrink-0"
                        style={{ width: `${widthPct}%` }}
                      >
                        <button
                          type="button"
                          aria-label={`${src.label}: ${src.tokens} tokens`}
                          onMouseEnter={() => setHoveredSource(src.sourceId)}
                          onMouseLeave={() => setHoveredSource(null)}
                          onClick={() => setActiveSource((cur) => (cur === src.sourceId ? null : src.sourceId))}
                          className={cn('block h-full w-full transition-opacity', tone.bar, hoveredSource && hoveredSource !== src.sourceId && 'opacity-40')}
                        />
                      </Tooltip>
                    )
                  })}
                </div>
                <div className="flex max-h-20 flex-wrap items-center gap-1.5 overflow-y-auto font-ui text-[10.5px]">
                  {sources.map((src) => {
                    const tone = sourceTone(src.sourceId)
                    const active = activeSource === src.sourceId
                    const hovered = hoveredSource === src.sourceId
                    return (
                      <Tooltip
                        key={src.sourceId}
                        title={src.label}
                        side="bottom"
                        body={`${src.detail} · ~${src.tokens.toLocaleString()} tokens (${pctLabel(src.tokens, totalSectionTokens)}). Click to filter.`}
                      >
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredSource(src.sourceId)}
                          onMouseLeave={() => setHoveredSource(null)}
                          onClick={() => setActiveSource((cur) => (cur === src.sourceId ? null : src.sourceId))}
                          className={cn(
                            'inline-flex items-center gap-1 border px-1.5 py-0.5 transition-colors',
                            active || hovered ? tone.pillActive : tone.pill
                          )}
                        >
                          <span className={tone.dot}>■</span>
                          <span>{src.label}</span>
                          <span className="opacity-75">~{formatPromptTokens(src.tokens)}</span>
                          <span className="opacity-55">({pctLabel(src.tokens, totalSectionTokens)})</span>
                        </button>
                      </Tooltip>
                    )
                  })}
                  <span className="flex-1" />
                  {activeSource && (
                    <button
                      type="button"
                      onClick={() => setActiveSource(null)}
                      className="border border-line/50 px-1.5 py-0.5 text-dim hover:text-ink"
                    >
                      Show all
                    </button>
                  )}
                  {toolSections.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllTools}
                      className="border border-line/50 px-1.5 py-0.5 text-dim hover:text-ink"
                    >
                      {allToolsFolded ? 'Expand tools' : 'Fold tools'}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="relative z-[2] min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pt-2 pb-4">
              {error ? (
                <div className="text-[12px] text-alert">{error}</div>
              ) : !view ? (
                <div className="font-ui text-[11px] text-dim">Loading…</div>
              ) : visibleSections.length > 0 ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  {visibleSections.map((sec) => (
                    <PromptSectionCard
                      key={sec.id}
                      section={sec}
                      totalTokens={totalSectionTokens}
                      highlighted={hoveredSource === sec.sourceId || activeSource === sec.sourceId}
                      collapsed={collapsed[sec.id] === true}
                      onToggleCollapse={() => setCollapsed((c) => ({ ...c, [sec.id]: !c[sec.id] }))}
                      onHoverSource={setHoveredSource}
                    />
                  ))}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-ink/90">{view.text}</pre>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
