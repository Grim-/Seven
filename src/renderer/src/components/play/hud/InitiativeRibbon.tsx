import { Swords, Skull } from 'lucide-react'
import type { BattleState } from '@shared/game/state/BattleStateMachine'
import { cn } from '../../../lib/cn'

export interface InitiativeRibbonProps {
  battle: BattleState
  selectedCombatantId?: string | null
  onSelectCombatant?: (id: string) => void
  onFlee?: () => void
  className?: string
}

export function InitiativeRibbon({
  battle,
  selectedCombatantId,
  onSelectCombatant,
  onFlee,
  className
}: InitiativeRibbonProps) {
  if (battle.status !== 'active') return null

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center h-8 gap-1.5 border border-line/60 tone-well-95 px-2.5 font-ui select-none shadow-xl backdrop-blur-[calc(var(--panel-blur)*1.5)]',
        className
      )}
    >
      {/* ROUND BADGE */}
      <div className="flex items-center gap-1.5 border-r border-line/50 pr-2 text-[10px] font-bold text-accent shrink-0">
        <Swords className="h-3 w-3 text-accent" />
        <span>R{battle.round}</span>
      </div>

      {/* COMBATANTS QUEUE */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {battle.queue.map((c, idx) => {
          const isActive = idx === battle.activeTurnIndex
          const isSelected = selectedCombatantId === c.id
          const isDead = c.hp.cur <= 0

          return (
            <div
              key={c.id}
              onClick={() => onSelectCombatant?.(c.id)}
              className={cn(
                'group flex items-center gap-1.5 border px-1.5 py-0.5 text-[9.5px] transition-all cursor-pointer',
                isDead
                  ? 'border-line/20 tone-panel-40 text-faint line-through opacity-40'
                  : isActive
                  ? c.isPlayer
                    ? 'border-tint-cyan bg-tint-cyan/20 text-ink font-bold shadow-[0_0_10px_color-mix(in_srgb,rgb(0,216,246)_calc(30%*var(--glow)),transparent)]'
                    : 'border-alert bg-alert/20 text-alert font-bold shadow-[0_0_10px_color-mix(in_srgb,rgb(255,77,77)_calc(30%*var(--glow)),transparent)]'
                  : isSelected
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line/40 tone-well-60 text-dim hover:border-line hover:text-ink'
              )}
            >
              {/* FACTION DOT */}
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0',
                  c.isPlayer ? 'bg-tint-cyan' : 'bg-alert'
                )}
              />

              {/* NAME */}
              <span className="max-w-[80px] truncate">{c.name}</span>

              {/* INITIATIVE SCORE */}
              <span className="text-[8.5px] text-faint">({c.initiative})</span>

              {/* ACTIVE TURN BADGE */}
              {isActive && (
                <span
                  className={cn(
                    'px-0.5 text-[7.5px] font-extrabold caps',
                    c.isPlayer ? 'bg-tint-cyan text-on-accent' : 'bg-alert text-ink'
                  )}
                >
                  TURN
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* FLEE BUTTON */}
      {onFlee && (
        <button
          type="button"
          onClick={onFlee}
          title="Flee combat (Retreat)"
          className="ml-auto flex items-center gap-1 border border-line/40 bg-line/10 px-1.5 py-0.5 text-[8.5px] font-bold text-faint hover:border-alert hover:text-alert transition-colors cursor-pointer"
        >
          <Skull className="h-2.5 w-2.5" />
          <span>FLEE</span>
        </button>
      )}
    </div>
  )
}
