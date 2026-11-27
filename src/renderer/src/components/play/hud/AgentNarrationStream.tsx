import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, X, Radio } from 'lucide-react'
import type { ChatMessage } from '@shared/types'
import { useDialogue, type NarrationLogEntry } from '../dialogue/dialogueStore'
import { useSessions } from '../../../store/sessions'
import { Markdown } from '../../chat/Markdown'
import { cn } from '../../../lib/cn'

export interface AgentNarrationStreamProps {
  sessionId?: string | null
  className?: string
  autoFadeMs?: number
}

function assistantTextOf(m: ChatMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim()
}

export function AgentNarrationStream({
  sessionId = null,
  className,
  autoFadeMs = 9000
}: AgentNarrationStreamProps) {
  const narrationLog = useDialogue((s) => s.narrationLog)
  const sessionMessages = useSessions((s) => (sessionId ? s.messages[sessionId] : undefined))
  const sessionRunning = useSessions((s) => (sessionId ? Boolean(s.running[sessionId]) : false))

  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)

  // Prefer live assistant narration from the bound Gameplay Chat session, falling back to local dialogueStore entries
  const dmEntries = useMemo<NarrationLogEntry[]>(() => {
    if (sessionMessages && sessionMessages.length > 0) {
      const fromChat = sessionMessages
        .filter((m) => m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          speaker: 'DM',
          text: assistantTextOf(m),
          kind: 'dm' as const,
          at: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }))
        .filter((e) => e.text.length > 0)
      if (fromChat.length > 0) return fromChat
    }
    return narrationLog.filter((e) => e.kind === 'dm' || e.kind === 'check')
  }, [sessionMessages, narrationLog])

  const latestEntry: NarrationLogEntry | undefined = dmEntries[dmEntries.length - 1]

  // Awaken stream when new narration arrives or is actively streaming; don't auto-fade while streaming
  useEffect(() => {
    if (!latestEntry && !sessionRunning) return
    setVisible(true)

    if (pinned || expanded || sessionRunning) return

    const timer = setTimeout(() => {
      setVisible(false)
    }, autoFadeMs)

    return () => clearTimeout(timer)
  }, [latestEntry?.id, latestEntry?.text.length, sessionRunning, pinned, expanded, autoFadeMs])

  if ((!latestEntry && !sessionRunning) || (!visible && !pinned && !expanded)) {
    return null
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col font-ui select-none transition-all duration-300 ease-out shadow-2xl backdrop-blur-[calc(var(--panel-blur)*1.5)]',
        'w-[min(580px,calc(100vw-480px))]',
        pinned || expanded || sessionRunning
          ? 'border border-accent/60 tone-panel-95 opacity-100'
          : 'border border-line/60 tone-well-85 opacity-95 hover:opacity-100 hover:border-accent/50',
        className
      )}
    >
      {/* HEADER / TRANSMISSION TELEMETRY */}
      <div className="flex h-6 items-center justify-between border-b border-line/40 bg-ink/[0.02] px-2 text-[9px] font-bold caps-5 text-dim">
        <div className="flex items-center gap-1.5 text-accent truncate">
          <Radio className={cn('h-3 w-3 text-accent', sessionRunning && 'animate-pulse')} />
          <span className="text-ink">{sessionRunning ? 'LIVE // DM NARRATING…' : 'TRANSMISSION // DM NARRATION'}</span>
          {latestEntry?.at && <span className="text-faint font-ui">[{latestEntry.at}]</span>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setPinned(!pinned)}
            title={pinned ? 'Unpin broadcast' : 'Pin broadcast open'}
            className={cn(
              'border px-1 py-0.2 text-[8px] transition-colors cursor-pointer',
              pinned
                ? 'border-accent bg-accent/20 text-accent font-bold'
                : 'border-line/40 text-faint hover:text-ink'
            )}
          >
            {pinned ? 'PINNED' : 'PIN'}
          </button>

          {dmEntries.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Show latest only' : 'View narrative history'}
              className="flex items-center gap-0.5 border border-line/40 px-1 py-0.2 text-[8px] text-faint hover:text-ink transition-colors cursor-pointer"
            >
              <span>{expanded ? 'LATEST' : 'HISTORY'}</span>
              {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setVisible(false)
              setPinned(false)
              setExpanded(false)
            }}
            title="Dismiss transmission"
            className="flex h-3.5 w-3.5 items-center justify-center border border-line/40 text-faint hover:border-alert hover:text-alert transition-colors cursor-pointer"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* STREAM PROSE CONTENT */}
      <div
        className={cn(
          'flex flex-col gap-1.5 overflow-y-auto px-3 py-1.5 text-[11px] leading-relaxed text-ink select-text',
          expanded ? 'max-h-64' : 'max-h-20'
        )}
      >
        {!latestEntry && sessionRunning ? (
          <div className="border-l border-accent/70 pl-2.5 py-0.5 text-[11px] text-dim animate-pulse">
            Narrating scene…
          </div>
        ) : (
          (expanded ? dmEntries : latestEntry ? [latestEntry] : []).map((entry) => (
            <div
              key={entry.id}
              onClick={() => !expanded && setExpanded(true)}
              title={!expanded ? 'Click to expand narration' : undefined}
              className={cn('border-l border-accent/70 pl-2.5 py-0.5', !expanded && 'cursor-pointer')}
            >
              {expanded && (
                <div className="text-[9px] font-bold caps text-accent mb-0.5">
                  {entry.speaker || 'WORLD NARRATOR'}
                </div>
              )}
              <Markdown text={entry.text} className={cn('font-body text-[11.5px] text-ink antialiased leading-relaxed', !expanded && 'line-clamp-2')} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
