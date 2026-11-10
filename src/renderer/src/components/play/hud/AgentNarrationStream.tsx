import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, X, Radio } from 'lucide-react'
import { useDialogue, type NarrationLogEntry } from '../dialogue/dialogueStore'
import { cn } from '../../../lib/cn'

export interface AgentNarrationStreamProps {
  className?: string
  autoFadeMs?: number
}

export function AgentNarrationStream({
  className,
  autoFadeMs = 4500
}: AgentNarrationStreamProps) {
  const narrationLog = useDialogue((s) => s.narrationLog)

  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)

  // Filter for DM narrative announcements and environmental entries
  const dmEntries = narrationLog.filter((e) => e.kind === 'dm' || e.kind === 'check')
  const latestEntry: NarrationLogEntry | undefined = dmEntries[dmEntries.length - 1]

  // When a new entry arrives, awaken the stream and reset the auto-fade timer
  useEffect(() => {
    if (!latestEntry) return
    setVisible(true)

    if (pinned || expanded) return

    const timer = setTimeout(() => {
      setVisible(false)
    }, autoFadeMs)

    return () => clearTimeout(timer)
  }, [latestEntry?.id, pinned, expanded, autoFadeMs])

  if (!latestEntry || (!visible && !pinned && !expanded)) {
    return null
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col font-mono select-none transition-all duration-300 ease-out shadow-2xl backdrop-blur-md',
        'w-[min(580px,calc(100vw-480px))]',
        pinned || expanded
          ? 'border border-accent/60 bg-black/95 opacity-100'
          : 'border border-line/60 bg-black/85 opacity-95 hover:opacity-100 hover:border-accent/50',
        className
      )}
    >
      {/* HEADER / TRANSMISSION TELEMETRY */}
      <div className="flex h-6 items-center justify-between border-b border-line/40 bg-white/[0.02] px-2 text-[9px] font-bold uppercase tracking-wider text-dim">
        <div className="flex items-center gap-1.5 text-accent truncate">
          <Radio className="h-3 w-3 text-accent animate-pulse" />
          <span className="text-white">TRANSMISSION // DM NARRATION</span>
          {latestEntry.at && <span className="text-faint font-mono">[{latestEntry.at}]</span>}
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
                : 'border-line/40 text-faint hover:text-white'
            )}
          >
            {pinned ? 'PINNED' : 'PIN'}
          </button>

          {dmEntries.length > 1 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Show latest only' : 'View narrative history'}
              className="flex items-center gap-0.5 border border-line/40 px-1 py-0.2 text-[8px] text-faint hover:text-white transition-colors cursor-pointer"
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
          'flex flex-col gap-1.5 overflow-y-auto px-3 py-2 text-[11px] leading-relaxed text-white',
          expanded ? 'max-h-48' : 'max-h-24'
        )}
      >
        {(expanded ? dmEntries : [latestEntry]).map((entry) => (
          <div
            key={entry.id}
            className="border-l border-accent/70 pl-2.5 py-0.5"
          >
            {expanded && (
              <div className="text-[9px] font-bold uppercase text-accent mb-0.5">
                {entry.speaker || 'WORLD NARRATOR'}
              </div>
            )}
            <p className="font-sans text-[11.5px] italic text-neutral-200 antialiased leading-relaxed">
              "{entry.text}"
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
