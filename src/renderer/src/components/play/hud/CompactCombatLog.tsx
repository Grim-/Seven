import { useState, useEffect, useRef } from 'react'
import { useGameState } from '../state/gameStateStore'
import { SlateContainer } from '../../entries/EntrySlate'
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const logs = battle?.logs ?? []

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [expanded, logs.length])

  if (!battle && logs.length === 0) {
    return null
  }

  const latest = logs[logs.length - 1]
  const subtitle = latest ? `[R${latest.round}] ${latest.actorName}: ${latest.text}` : 'Awaiting tactical actions...'

  return (
    <SlateContainer
      title="Combat Log"
      tag={battle ? `R${battle.round}` : 'LOG'}
      subtitle={!expanded ? subtitle : undefined}
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      className={cn('pointer-events-auto font-mono', expanded ? 'w-[420px]' : 'w-[340px]', className)}
    >
      <div
        ref={scrollRef}
        className="flex h-56 flex-col gap-1 overflow-y-auto p-2 text-[10px] leading-relaxed text-dim select-text"
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
                  'flex items-start gap-1.5 border-l-2 py-0.5 pl-2 transition-colors',
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
                <span className="shrink-0 font-mono text-[9px] text-faint">[R{entry.round}]</span>
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
      </div>
    </SlateContainer>
  )
}
