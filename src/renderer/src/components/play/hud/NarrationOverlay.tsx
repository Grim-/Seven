import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react'
import { useDialogue } from '../dialogue/dialogueStore'
import { cn } from '../../../lib/cn'

interface NarrationOverlayProps {
  areaName?: string
  playerName?: string
  playerHp?: string
  targetName?: string | null
  inCombat?: boolean
}

export function NarrationOverlay({
  areaName = 'Tavern Common',
  playerName = 'Alistair Finch',
  playerHp = '10/10 HP',
  targetName,
  inCombat = false
}: NarrationOverlayProps) {
  const [expanded, setExpanded] = useState(false)
  const [highlighted, setHighlighted] = useState(false)
  const narrationLog = useDialogue((s) => s.narrationLog)
  const clearNarration = useDialogue((s) => s.clearNarration)

  // Briefly highlight to full opacity when new narration arrives
  useEffect(() => {
    if (!narrationLog.length) return
    setHighlighted(true)
    const timer = setTimeout(() => setHighlighted(false), 5000)
    return () => clearTimeout(timer)
  }, [narrationLog.length])

  const hasEntries = narrationLog.length > 0

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-1/2 z-20 flex -translate-x-1/2 flex-col font-mono select-none transition-all duration-300 ease-out',
        inCombat ? 'top-16' : 'top-2.5',
        'w-[min(480px,calc(100vw-540px))]',
        highlighted || expanded
          ? 'border border-line bg-black/95 opacity-100 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md'
          : 'border border-line/30 bg-black/60 opacity-40 backdrop-blur-sm hover:border-line hover:bg-black/95 hover:opacity-100 hover:shadow-[0_8px_32px_rgba(0,0,0,0.85)]'
      )}
    >
      {/* HEADER STRIP */}
      <div className="flex h-7 items-center justify-between border-b border-line/30 bg-subtle/50 px-2.5 text-[9.5px] tracking-wider text-dim">
        <div className="flex items-center gap-1.5 truncate">
          <Sparkles className="h-3 w-3 text-purple" />
          <span className="font-semibold text-white">NARRATION</span>
          <span className="text-line">|</span>
          <span className="truncate text-cyan">{areaName}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[9px]">
          <span className="text-ok">{playerName}</span>
          <span className="text-faint">({playerHp})</span>
          {targetName && (
            <>
              <span className="text-line">|</span>
              <span className="text-accent font-semibold truncate max-w-[100px]">{targetName}</span>
            </>
          )}
          {hasEntries && (
            <div className="ml-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-0.5 border border-line/40 bg-black/40 px-1 py-0.5 text-dim hover:border-accent hover:text-white transition-colors"
              >
                <span>{expanded ? 'LESS' : 'LOG'}</span>
                {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              </button>
              <button
                type="button"
                onClick={clearNarration}
                title="Clear narration log"
                className="border border-line/40 bg-black/40 p-0.5 text-faint hover:text-white transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* STREAM BODY */}
      {hasEntries ? (
        <div
          className={cn(
            'flex flex-col gap-1.5 overflow-y-auto px-2.5 py-1.5 text-[11px] leading-relaxed text-white',
            expanded ? 'max-h-[220px]' : 'max-h-[50px]'
          )}
        >
          {(expanded ? narrationLog : narrationLog.slice(-1)).map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'border-l-2 pl-2',
                entry.kind === 'npc'
                  ? 'border-accent bg-accent/5'
                  : entry.kind === 'check'
                  ? 'border-cyan bg-cyan/5 text-cyan'
                  : entry.kind === 'player'
                  ? 'border-ok bg-ok/5'
                  : 'border-purple bg-purple/5'
              )}
            >
              <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider text-faint">
                <span className={entry.kind === 'npc' ? 'text-accent' : entry.kind === 'check' ? 'text-cyan' : 'text-purple'}>
                  {entry.speaker}
                </span>
                <span>{entry.at}</span>
              </div>
              <div className="text-[11px] mt-0.5">{entry.text}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-2.5 py-1 text-[9.5px] text-faint">
          No recent narration. Events and dialogue appear here.
        </div>
      )}
    </div>
  )
}
