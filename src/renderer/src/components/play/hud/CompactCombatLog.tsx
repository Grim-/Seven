import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ScrollText,
  Swords
} from 'lucide-react'
import { useGameState } from '../state/gameStateStore'
import { cn } from '../../../lib/cn'

export interface CompactCombatLogProps {
  className?: string
  defaultExpanded?: boolean
}

export function CompactCombatLog({
  className,
  defaultExpanded = false
}: CompactCombatLogProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const battle = useGameState((s) => s.battle)
  const lastRoll = useGameState((s) => s.lastRoll)
  const scrollRef = useRef<HTMLDivElement>(null)

  const logs = battle?.logs ?? []

  // Auto-scroll to bottom of logs when expanded or when new logs arrive
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [expanded, logs.length, lastRoll?.timestamp])

  if (!battle && logs.length === 0 && !lastRoll) {
    return null
  }

  // Generate collapsed ticker text from lastRoll or latest log
  const tickerText = lastRoll ? (
    <span className="truncate">
      <strong className={lastRoll.hit ? 'text-cyan' : 'text-dim'}>
        {lastRoll.attackerName}
      </strong>
      <span className="text-faint"> › </span>
      <span className="text-white">{lastRoll.attackName}</span>
      <span className="text-faint"> vs </span>
      <strong className="text-white">{lastRoll.targetName}</strong>
      <span className="text-faint">: </span>
      <span className="text-dim">
        d20({lastRoll.d20})+{lastRoll.bonus}={lastRoll.total}
      </span>
      <span className="text-faint"> vs AC {lastRoll.targetAc} </span>
      <strong
        className={cn(
          'uppercase font-bold',
          lastRoll.isCrit ? 'text-accent' : lastRoll.hit ? 'text-ok' : 'text-alert'
        )}
      >
        {lastRoll.isCrit ? 'CRIT!' : lastRoll.hit ? 'HIT!' : 'MISS'}
      </strong>
      {lastRoll.hit && (
        <span className="text-alert font-bold"> (-{lastRoll.damage} HP)</span>
      )}
    </span>
  ) : logs.length > 0 ? (
    <span className="truncate">
      <span className="text-faint">[R{logs[logs.length - 1].round}]</span>{' '}
      <strong className="text-white">{logs[logs.length - 1].actorName}:</strong>{' '}
      <span className="text-dim">{logs[logs.length - 1].text}</span>
    </span>
  ) : (
    <span className="text-faint">Awaiting tactical actions...</span>
  )

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col font-mono select-none shadow-2xl backdrop-blur-md transition-all',
        expanded ? 'w-[420px]' : 'w-auto max-w-[460px]',
        className
      )}
    >
      {/* EXPANDED FEED CONTAINER */}
      {expanded && (
        <div className="flex flex-col border border-line/60 border-b-0 bg-black/95">
          {/* TERMINAL HEADER */}
          <div className="flex h-7 items-center justify-between border-b border-line/50 bg-white/[0.03] px-2.5 text-[9.5px] font-bold uppercase tracking-wider text-dim">
            <div className="flex items-center gap-1.5 text-cyan">
              <ScrollText className="h-3 w-3 text-cyan" />
              <span className="text-white">COMBAT TELEMETRY</span>
              {battle && <span className="text-accent font-mono">[ROUND {battle.round}]</span>}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                title="Minimize log"
                className="flex items-center gap-0.5 border border-line/40 px-1.5 py-0.5 text-[9px] text-dim hover:border-line hover:text-white transition-colors cursor-pointer"
              >
                <span>MINIMIZE</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* SCROLLABLE LOG FEED */}
          <div
            ref={scrollRef}
            className="flex h-56 flex-col gap-1 overflow-y-auto p-2 text-[10px] leading-relaxed text-dim"
          >
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-faint">
                No combat entries recorded yet.
              </div>
            ) : (
              logs.map((entry) => {
                const isAttack = entry.type === 'attack'
                const isDamage = entry.type === 'damage'
                const isHeal = entry.type === 'heal'
                const isTurn = entry.type === 'turn'
                const isParley = entry.type === 'parley'

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-start gap-1.5 border-l-2 pl-2 py-0.5 transition-colors',
                      isTurn
                        ? 'border-accent bg-accent/5'
                        : isDamage
                        ? 'border-alert bg-alert/5'
                        : isHeal
                        ? 'border-ok bg-ok/5'
                        : isParley
                        ? 'border-purple bg-purple/5'
                        : isAttack
                        ? 'border-cyan bg-cyan/5'
                        : 'border-line/40'
                    )}
                  >
                    <span className="text-faint shrink-0 font-mono text-[9px]">
                      [R{entry.round}]
                    </span>
                    <strong
                      className={cn(
                        'shrink-0 font-semibold',
                        isTurn
                          ? 'text-accent'
                          : isAttack
                          ? 'text-cyan'
                          : isDamage
                          ? 'text-alert'
                          : isParley
                          ? 'text-purple'
                          : 'text-white'
                      )}
                    >
                      {entry.actorName}:
                    </strong>
                    <span className="text-white/80">{entry.text}</span>
                  </div>
                )
              })
            )}

            {/* D20 ROLL HIGHLIGHT IF ACTIVE */}
            {lastRoll && (
              <div className="mt-1 flex items-center justify-between border border-line/50 bg-black/80 px-2.5 py-1.5 text-[9.5px]">
                <div className="flex items-center gap-1.5">
                  <Swords className="h-3 w-3 text-cyan" />
                  <span className="font-bold text-white">{lastRoll.attackerName}</span>
                  <span className="text-faint">›</span>
                  <span className="text-dim">{lastRoll.attackName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-dim">
                    d20({lastRoll.d20})+{lastRoll.bonus}={lastRoll.total}
                  </span>
                  <span
                    className={cn(
                      'px-1 py-0.2 font-extrabold text-[8.5px] uppercase',
                      lastRoll.isCrit
                        ? 'bg-accent text-black'
                        : lastRoll.hit
                        ? 'border border-ok/60 bg-ok/20 text-ok'
                        : 'border border-alert/60 bg-alert/20 text-alert'
                    )}
                  >
                    {lastRoll.isCrit ? 'CRIT' : lastRoll.hit ? 'HIT' : 'MISS'}
                  </span>
                  {lastRoll.hit && (
                    <span className="text-alert font-bold">-{lastRoll.damage} DMG</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TICKER PILL (VISIBLE WHEN COLLAPSED, OR BOTTOM BAR WHEN EXPANDED) */}
      {!expanded && (
        <div
          onClick={() => setExpanded(true)}
          className="group flex h-7 items-center gap-2 border border-line/60 bg-black/90 px-2.5 text-[10px] transition-all hover:border-cyan hover:bg-black/95 cursor-pointer shadow-lg"
        >
          <div className="flex items-center gap-1.5 text-cyan shrink-0">
            <ScrollText className="h-3 w-3 text-cyan group-hover:scale-110 transition-transform" />
            <span className="font-bold uppercase tracking-wider text-white">LOG:</span>
          </div>

          <div className="min-w-0 flex-1 truncate">{tickerText}</div>

          <div className="flex items-center gap-1 shrink-0 text-dim group-hover:text-cyan border border-line/40 group-hover:border-cyan px-1 py-0.2 text-[8.5px] font-bold uppercase transition-colors">
            <span>EXPAND</span>
            <ChevronUp className="h-2.5 w-2.5" />
          </div>
        </div>
      )}
    </div>
  )
}
