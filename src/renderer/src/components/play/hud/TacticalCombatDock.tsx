import { useEffect, useState } from 'react'
import {
  Footprints,
  MessageSquarePlus,
  Shield,
  Swords,
  Target,
  Zap
} from 'lucide-react'
import type { BattleState } from '@shared/game/state/BattleStateMachine'
import { useGameState } from '../state/gameStateStore'
import { useDialogue } from '../dialogue/dialogueStore'
import { defaultDialogueTree } from '@shared/game/dialogue'
import { cn } from '../../../lib/cn'
import { matchesKeybind } from '../../../store/keybinds'

interface TacticalCombatDockProps {
  battle: BattleState
  selectedTargetId: string | null
  onSelectTarget: (id: string | null) => void
  onAttack: (targetId: string, attackName?: string) => void
}

export function TacticalCombatDock({
  battle,
  selectedTargetId,
  onSelectTarget: _onSelectTarget,
  onAttack
}: TacticalCombatDockProps) {
  const activeActor = battle.queue[battle.activeTurnIndex]
  const isPlayerTurn = activeActor?.isPlayer ?? false
  const { economy } = battle

  const dashAction = useGameState((s) => s.dashAction)
  const dodgeAction = useGameState((s) => s.dodgeAction)
  const endTurn = useGameState((s) => s.endTurn)

  const [selectedAttack, setSelectedAttack] = useState<string>(
    activeActor?.attacks?.[0]?.name ?? 'Strike'
  )

  // Find target combatant
  const targetCombatant = battle.queue.find((c) => c.id === selectedTargetId) ?? null

  // Hotkeys: 1 (Attack), 2 (Dash), 3 (Dodge), P (Parley)
  useEffect(() => {
    if (!isPlayerTurn) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return

      if (e.key === '1' || matchesKeybind('tactical.targetAttack', e)) {
        if (targetCombatant && !economy.actionUsed) {
          e.preventDefault()
          onAttack(targetCombatant.id, selectedAttack)
        }
      } else if (e.key === '2') {
        if (!economy.actionUsed) {
          e.preventDefault()
          dashAction()
        }
      } else if (e.key === '3') {
        if (!economy.actionUsed) {
          e.preventDefault()
          dodgeAction()
        }
      } else if (matchesKeybind('tactical.parley', e)) {
        if (targetCombatant) {
          e.preventDefault()
          const tree = defaultDialogueTree(targetCombatant.id, targetCombatant.name)
          useDialogue.getState().startDialogue(tree, targetCombatant.name)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlayerTurn, targetCombatant, economy.actionUsed, selectedAttack, onAttack, dashAction, dodgeAction])

  if (!activeActor) return null

  const attacks = activeActor.attacks && activeActor.attacks.length > 0
    ? activeActor.attacks
    : [{ name: 'Strike', bonus: 3, damage: '1d6 + 2' }]

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-2 z-30 flex justify-center font-mono select-none px-4">
      <div className="flex items-center gap-3 border border-line bg-black/95 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.95)] backdrop-blur-md">
        {/* ACTIVE COMBATANT STATS */}
        <div className="flex items-center gap-2.5 border-r border-line/50 pr-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-cyan/70 bg-cyan/15 text-[11px] font-bold text-cyan">
            {activeActor.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-white max-w-[120px] truncate">
              {activeActor.name}
            </span>
            <div className="flex items-center gap-2 text-[9.5px]">
              <span className="flex items-center gap-0.5 text-accent font-bold">
                <Shield className="h-3 w-3 text-accent" />
                AC {activeActor.ac ?? 12}
              </span>
              <span className="text-dim">
                HP {activeActor.hp.cur}/{activeActor.hp.max}
              </span>
            </div>
            {/* HP PROGRESS BAR */}
            <div className="h-1.5 w-24 border border-line/40 bg-black/60">
              <div
                className="h-full bg-cyan transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, (activeActor.hp.cur / activeActor.hp.max) * 100))}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* TACTICAL COMBAT ACTIONS */}
        <div className="flex items-center gap-1.5">
          {/* 1. STRIKE / ATTACK BUTTON */}
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-1">
              {attacks.map((att) => (
                <button
                  key={att.name}
                  type="button"
                  disabled={!isPlayerTurn || economy.actionUsed || !targetCombatant}
                  onClick={() => {
                    setSelectedAttack(att.name)
                    if (targetCombatant) onAttack(targetCombatant.id, att.name)
                  }}
                  title={
                    targetCombatant
                      ? `Strike ${targetCombatant.name} with ${att.name} (+${att.bonus} to hit, ${att.damage})`
                      : 'Select a target on the map or in the list first'
                  }
                  className={cn(
                    'flex h-8 items-center gap-1.5 border px-2.5 text-[10.5px] font-bold uppercase transition-all',
                    isPlayerTurn && !economy.actionUsed && targetCombatant
                      ? 'border-cyan bg-cyan/20 text-white hover:border-cyan hover:bg-cyan hover:text-black cursor-pointer shadow-[0_0_12px_rgba(0,216,246,0.25)]'
                      : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
                  )}
                >
                  <Swords className="h-3.5 w-3.5 text-cyan" />
                  <span>{att.name}</span>
                  <span className="border border-line/60 bg-line/20 px-1 text-[8.5px] text-cyan">
                    [1/F]
                  </span>
                </button>
              ))}
            </div>
            <span className="text-[8.5px] text-faint">
              {attacks.find((a) => a.name === selectedAttack)?.damage} DMG · +
              {attacks.find((a) => a.name === selectedAttack)?.bonus} TO HIT
            </span>
          </div>

          {/* 2. DASH BUTTON */}
          <button
            type="button"
            disabled={!isPlayerTurn || economy.actionUsed}
            onClick={dashAction}
            title="Dash: Doubles your movement speed for this turn (Action)"
            className={cn(
              'flex h-8 items-center gap-1.5 border px-2.5 text-[10.5px] font-bold uppercase transition-all',
              isPlayerTurn && !economy.actionUsed
                ? 'border-line/60 bg-black/60 text-white hover:border-accent hover:text-accent cursor-pointer'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <Footprints className="h-3.5 w-3.5 text-accent" />
            <span>DASH</span>
            <span className="border border-line/60 bg-line/20 px-1 text-[8.5px] text-dim">[2]</span>
          </button>

          {/* 3. DODGE BUTTON */}
          <button
            type="button"
            disabled={!isPlayerTurn || economy.actionUsed || economy.isDodging}
            onClick={dodgeAction}
            title="Dodge: Focus on defense; incoming attacks have disadvantage (Action)"
            className={cn(
              'flex h-8 items-center gap-1.5 border px-2.5 text-[10.5px] font-bold uppercase transition-all',
              economy.isDodging
                ? 'border-accent bg-accent/20 text-accent cursor-default'
                : isPlayerTurn && !economy.actionUsed
                ? 'border-line/60 bg-black/60 text-white hover:border-accent hover:text-accent cursor-pointer'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <Shield className="h-3.5 w-3.5 text-accent" />
            <span>DODGE</span>
            <span className="border border-line/60 bg-line/20 px-1 text-[8.5px] text-dim">[3]</span>
          </button>

          {/* 4. PARLEY / TALK WITH ENEMY (EMERGENT AGENT DIALOGUE) */}
          <button
            type="button"
            disabled={!targetCombatant}
            onClick={() => {
              if (targetCombatant) {
                const tree = defaultDialogueTree(targetCombatant.id, targetCombatant.name)
                useDialogue.getState().startDialogue(tree, targetCombatant.name)
              }
            }}
            title="Parley: Speak with the enemy agent to negotiate, intimidate, deceive, or recruit them (P)"
            className={cn(
              'flex h-8 items-center gap-1.5 border px-2.5 text-[10.5px] font-bold uppercase transition-all',
              targetCombatant
                ? 'border-purple/70 bg-purple/15 text-purple hover:border-purple hover:bg-purple hover:text-black cursor-pointer shadow-[0_0_12px_rgba(180,100,255,0.3)]'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-purple" />
            <span>PARLEY</span>
            <span className="border border-line/60 bg-line/20 px-1 text-[8.5px] text-purple">[P]</span>
          </button>

          {/* 5. END TURN BUTTON */}
          <button
            type="button"
            disabled={!isPlayerTurn}
            onClick={endTurn}
            className={cn(
              'flex h-8 items-center gap-1 border px-3 text-[10.5px] font-bold uppercase tracking-wider transition-all ml-1',
              isPlayerTurn
                ? 'border-cyan bg-cyan text-black hover:bg-cyan/90 cursor-pointer shadow-[0_0_16px_rgba(0,216,246,0.35)]'
                : 'border-line/40 bg-line/20 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>PASS [SPACE]</span>
          </button>
        </div>

        {/* TARGET STATUS SUMMARY */}
        <div className="flex items-center gap-2.5 border-l border-line/50 pl-3">
          {targetCombatant ? (
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-alert/70 bg-alert/15 text-[10.5px] font-bold text-alert">
                {targetCombatant.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-bold text-white max-w-[100px] truncate">
                    {targetCombatant.name}
                  </span>
                  <span className="border border-alert/60 bg-alert/20 px-1 text-[8px] font-bold text-alert">
                    AC {targetCombatant.ac ?? 10}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-dim">
                  <span>
                    HP {targetCombatant.hp.cur}/{targetCombatant.hp.max}
                  </span>
                  <span className="text-faint">·</span>
                  <span className="text-alert uppercase">
                    {targetCombatant.faction ?? 'HOSTILE'}
                  </span>
                </div>
                {/* TARGET HP BAR */}
                <div className="h-1 w-20 border border-line/40 bg-black/60">
                  <div
                    className="h-full bg-alert transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, (targetCombatant.hp.cur / targetCombatant.hp.max) * 100))}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-faint">
              <Target className="h-3.5 w-3.5 text-faint" />
              <span>Click any enemy to target</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
