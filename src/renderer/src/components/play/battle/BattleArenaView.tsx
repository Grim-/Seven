import { useEffect, useState, useRef } from 'react'
import {
  Footprints,
  MessageSquarePlus,
  Shield,
  Skull,
  Swords,
  Zap
} from 'lucide-react'
import type { BattleState } from '@shared/game/state/BattleStateMachine'
import { activeCombatManeuvers } from '../state/combatGate'
import { useGameState } from '../state/gameStateStore'
import { useDialogue } from '../dialogue/dialogueStore'
import { defaultDialogueTree } from '@shared/game/dialogue'
import { cn } from '../../../lib/cn'

interface BattleArenaViewProps {
  battle: BattleState
  selectedTargetId: string | null
  onSelectTarget: (id: string | null) => void
  onAttack: (targetId: string, attackName?: string) => void
}

export function BattleArenaView({
  battle,
  selectedTargetId,
  onSelectTarget,
  onAttack
}: BattleArenaViewProps) {
  const activeActor = battle.queue[battle.activeTurnIndex]
  const isPlayerTurn = activeActor?.isPlayer ?? false
  const { economy } = battle

  const endTurn = useGameState((s) => s.endTurn)
  const endBattle = useGameState((s) => s.endBattle)
  const dashAction = useGameState((s) => s.dashAction)
  const dodgeAction = useGameState((s) => s.dodgeAction)
  const tokens = useGameState((s) => s.tokens)
  const catalog = useGameState((s) => s.catalog)
  const maneuvers = activeCombatManeuvers(battle, tokens, catalog)

  const logBottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll combat log
  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [battle.logs.length])

  // Filter players and enemies
  const playerCombatants = battle.queue.filter((c) => c.isPlayer)
  const enemyCombatants = battle.queue.filter((c) => !c.isPlayer)

  // Target combatant
  const targetCombatant = enemyCombatants.find((c) => c.id === selectedTargetId) ?? enemyCombatants[0] ?? null

  const [selectedAttack, setSelectedAttack] = useState<string>(
    activeActor?.attacks?.[0]?.id ?? activeActor?.attacks?.[0]?.name ?? ''
  )

  const attacks = activeActor?.attacks ?? []

  return (
    <div className="relative flex h-full w-full flex-col bg-black/95 font-mono select-none overflow-hidden">
      {/* BACKGROUND ARENA ATMOSPHERE */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan/10 via-black to-black opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#00d8f608_1px,transparent_1px),linear-gradient(to_bottom,#00d8f608_1px,transparent_1px)] bg-[size:32px_32px]" />

      {/* TOP ARENA HEADER & INITIATIVE */}
      <div className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b border-line/60 bg-black/85 px-4">
        {/* ROUND & STATUS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-accent/60 bg-accent/15 px-2.5 py-1 text-[11px] font-extrabold text-accent">
            <Swords className="h-4 w-4 text-accent" />
            <span>ROUND {battle.round}</span>
          </div>
          <span className="text-[12px] font-bold text-white tracking-widest uppercase">
            TACTICAL BATTLE ARENA
          </span>
        </div>

        {/* INITIATIVE ORDER CAROUSEL */}
        <div className="flex items-center gap-1">
          {battle.queue.map((c, idx) => {
            const isActive = idx === battle.activeTurnIndex
            const isDead = c.hp.cur <= 0
            return (
              <div
                key={c.id}
                onClick={() => !c.isPlayer && onSelectTarget(c.id)}
                className={cn(
                  'flex items-center gap-1.5 border px-2 py-1 text-[10px] transition-all cursor-pointer',
                  isDead
                    ? 'border-line/20 bg-black/30 text-faint line-through opacity-40'
                    : isActive
                    ? c.isPlayer
                      ? 'border-cyan bg-cyan/20 text-white font-bold shadow-[0_0_12px_rgba(0,216,246,0.4)] scale-105'
                      : 'border-alert bg-alert/20 text-alert font-bold shadow-[0_0_12px_rgba(255,77,77,0.4)] scale-105'
                    : c.id === selectedTargetId
                    ? 'border-alert/70 bg-alert/10 text-white'
                    : 'border-line/40 bg-black/60 text-dim hover:text-white'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2',
                    c.isPlayer ? 'bg-cyan' : 'bg-alert'
                  )}
                />
                <span className="max-w-[90px] truncate">{c.name}</span>
                <span className="text-[8.5px] text-faint">({c.initiative})</span>
                {isActive && (
                  <span
                    className={cn(
                      'px-1 text-[8px] font-bold uppercase',
                      c.isPlayer ? 'bg-cyan text-black' : 'bg-alert text-black'
                    )}
                  >
                    ACT
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* VIEW TOGGLES & FLEE */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => endBattle('flee')}
            title="Disengage and flee"
            className="flex items-center gap-1 border border-line/40 bg-line/10 px-2 py-1 text-[10.5px] text-faint hover:border-alert hover:text-alert transition-colors cursor-pointer"
          >
            <Skull className="h-3.5 w-3.5" />
            <span>FLEE</span>
          </button>
        </div>
      </div>

      {/* MAIN 3-COLUMN ARENA STAGE */}
      <div className="relative z-10 flex min-h-0 flex-1 gap-3 p-4">
        {/* LEFT COLUMN: PLAYER PARTY CARDS */}
        <div className="flex w-[280px] shrink-0 flex-col gap-2.5 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-line/40 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-dim">
            <span>PARTY ALLIES ({playerCombatants.length})</span>
            <span className="text-cyan">FACTION: PLAYER</span>
          </div>

          {playerCombatants.map((c) => {
            const isActive = battle.queue[battle.activeTurnIndex]?.id === c.id
            const isDead = c.hp.cur <= 0
            return (
              <div
                key={c.id}
                className={cn(
                  'flex flex-col gap-2 border p-3 transition-all',
                  isDead
                    ? 'border-line/30 bg-black/40 opacity-40'
                    : isActive
                    ? 'border-cyan bg-cyan/[0.07] shadow-[0_0_16px_rgba(0,216,246,0.25)]'
                    : 'border-line/60 bg-black/70'
                )}
              >
                {/* ACTOR ROW */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center border border-cyan/70 bg-cyan/15 text-[11px] font-bold text-cyan">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-white">{c.name}</span>
                      <span className="text-[9.5px] text-dim">
                        INIT: {c.initiative} · SPEED: {c.speedMax} FT
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 border border-cyan/60 bg-cyan/15 px-2 py-0.5 text-[10px] font-bold text-cyan">
                    <Shield className="h-3 w-3" />
                    <span>AC {c.ac}</span>
                  </div>
                </div>

                {/* HP GAUGE */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-faint">HIT POINTS</span>
                    <strong className={c.hp.cur <= c.hp.max * 0.25 ? 'text-alert' : 'text-white'}>
                      {c.hp.cur} / {c.hp.max} HP
                    </strong>
                  </div>
                  <div className="h-2 w-full border border-line/50 bg-black/80">
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        c.hp.cur <= c.hp.max * 0.25
                          ? 'bg-alert shadow-[0_0_8px_rgba(255,77,77,0.5)]'
                          : 'bg-cyan shadow-[0_0_8px_rgba(0,216,246,0.5)]'
                      )}
                      style={{
                        width: `${Math.max(0, Math.min(100, (c.hp.cur / c.hp.max) * 100))}%`
                      }}
                    />
                  </div>
                </div>

                {/* ATTACKS LIST */}
                <div className="flex flex-col gap-1 border-t border-line/30 pt-1.5 text-[9.5px]">
                  <span className="text-faint uppercase font-bold">ATTACK ARSENAL</span>
                  {c.attacks?.map((att) => (
                    <div
                      key={att.name}
                      className="flex items-center justify-between text-dim"
                    >
                      <span className="text-white">{att.name}</span>
                      <span>{att.range} ft{att.damage ? ` (${att.damage})` : ''}</span>
                    </div>
                  ))}
                </div>

                {isActive && (
                  <div className="border border-cyan/60 bg-cyan/20 px-2 py-0.5 text-center text-[9px] font-extrabold uppercase text-cyan">
                    ACTIVE COMBATANT
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* CENTER COLUMN: ARENA THEATER & COMBAT LOG */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* COMBAT ARENA STAGE CARD */}
          <div className="flex flex-col border border-line/70 bg-black/80 p-3 shadow-md">
            {/* CURRENT ENGAGEMENT SUMMARY */}
            <div className="flex items-center justify-between border-b border-line/40 pb-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-faint uppercase font-bold">CURRENT ENGAGEMENT:</span>
                <span className="font-bold text-cyan">{activeActor?.name ?? 'Player'}</span>
                <span className="text-dim">VS</span>
                <span className="font-bold text-alert">
                  {targetCombatant?.name ?? 'No Target'}
                </span>
              </div>
              {targetCombatant && (
                <div className="flex items-center gap-1.5 text-[9.5px]">
                  <span className="border border-alert/60 bg-alert/20 px-1.5 py-0.5 font-bold text-alert">
                    AC {targetCombatant.ac}
                  </span>
                  <span className="text-dim">
                    HP {targetCombatant.hp.cur}/{targetCombatant.hp.max}
                  </span>
                </div>
              )}
            </div>

            {/* LATEST ACTION SUMMARY */}
            <div className="flex min-h-[90px] items-center justify-center p-2">
              {battle.logs.length > 0 ? (
                <div className="flex flex-col items-center gap-1 text-center text-[11px]">
                  <span className="text-[9.5px] uppercase tracking-wider text-cyan">
                    {battle.logs[battle.logs.length - 1].actorName}
                  </span>
                  <span className="text-white/90">
                    {battle.logs[battle.logs.length - 1].text}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-faint">
                  <Swords className="h-4 w-4 text-faint" />
                  <span>Execute an attack or wait for incoming actions...</span>
                </div>
              )}
            </div>
          </div>

          {/* REAL-TIME COMBAT LOG STREAM */}
          <div className="flex min-h-0 flex-1 flex-col border border-line/60 bg-black/90">
            <div className="flex items-center justify-between border-b border-line/40 bg-white/[0.02] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-dim">
              <span>TACTICAL COMBAT LOG</span>
              <span className="text-faint">{battle.logs.length} ENTRIES</span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2.5 text-[11px]">
              {battle.logs.map((log) => {
                const isAttack = log.type === 'attack'
                const isDmg = log.type === 'damage'
                const isTurn = log.type === 'turn'
                const isParley = log.type === 'parley'

                return (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-start gap-2 border-l-2 py-0.5 pl-2 leading-relaxed',
                      isParley
                        ? 'border-purple text-purple'
                        : isDmg
                        ? 'border-alert text-alert'
                        : isAttack
                        ? 'border-cyan text-white/90'
                        : isTurn
                        ? 'border-accent text-accent'
                        : 'border-line text-dim'
                    )}
                  >
                    <span className="text-[9px] text-faint shrink-0">[R{log.round}]</span>
                    <span>{log.text}</span>
                  </div>
                )
              })}
              <div ref={logBottomRef} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ENEMY HOSTILES */}
        <div className="flex w-[300px] shrink-0 flex-col gap-2.5 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-line/40 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-dim">
            <span>HOSTILE THREATS ({enemyCombatants.length})</span>
            <span className="text-alert">TARGET SELECTION</span>
          </div>

          {enemyCombatants.map((c) => {
            const isTarget = c.id === targetCombatant?.id
            const isActive = battle.queue[battle.activeTurnIndex]?.id === c.id
            const isDead = c.hp.cur <= 0

            return (
              <div
                key={c.id}
                onClick={() => onSelectTarget(c.id)}
                className={cn(
                  'flex flex-col gap-2 border p-3 transition-all cursor-pointer',
                  isDead
                    ? 'border-line/20 bg-black/40 opacity-40 line-through'
                    : isTarget
                    ? 'border-alert bg-alert/[0.08] shadow-[0_0_16px_rgba(255,77,77,0.3)] ring-1 ring-alert'
                    : isActive
                    ? 'border-alert/80 bg-alert/[0.04]'
                    : 'border-line/60 bg-black/70 hover:border-line'
                )}
              >
                {/* ENEMY HEADER */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center border border-alert/70 bg-alert/15 text-[11px] font-bold text-alert">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-white">{c.name}</span>
                      <span className="text-[9px] text-alert uppercase">
                        {c.faction ? `FACTION: ${c.faction}` : 'CREATURE'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 border border-alert/60 bg-alert/20 px-2 py-0.5 text-[10px] font-bold text-alert">
                    <Shield className="h-3 w-3" />
                    <span>AC {c.ac}</span>
                  </div>
                </div>

                {/* HP GAUGE */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-faint">HEALTH</span>
                    <strong className="text-alert">
                      {c.hp.cur} / {c.hp.max} HP
                    </strong>
                  </div>
                  <div className="h-2 w-full border border-line/50 bg-black/80">
                    <div
                      className="h-full bg-alert shadow-[0_0_8px_rgba(255,77,77,0.5)] transition-all duration-300"
                      style={{
                        width: `${Math.max(0, Math.min(100, (c.hp.cur / c.hp.max) * 100))}%`
                      }}
                    />
                  </div>
                </div>

                {/* ACTIONS ON THIS ENEMY */}
                {!isDead && (
                  <div className="flex items-center gap-2 pt-1">
                    {/* STRIKE BUTTON */}
                    <button
                      type="button"
                      disabled={!isPlayerTurn || economy.actionUsed}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectTarget(c.id)
                        onAttack(c.id, selectedAttack)
                      }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 border py-1 text-[10px] font-bold uppercase transition-all',
                        isPlayerTurn && !economy.actionUsed
                          ? 'border-alert bg-alert/20 text-white hover:bg-alert hover:text-black cursor-pointer shadow-[0_0_12px_rgba(255,77,77,0.3)]'
                          : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
                      )}
                    >
                      <Swords className="h-3 w-3" />
                      <span>STRIKE</span>
                    </button>

                    {/* PARLEY / AGENT CHAT BUTTON */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const tree = defaultDialogueTree(c.id, c.name)
                        useDialogue.getState().startDialogue(tree, c.name)
                      }}
                      title="Parley with agent playing this enemy (P)"
                      className="flex items-center gap-1 border border-purple/60 bg-purple/15 px-2.5 py-1 text-[10px] font-bold uppercase text-purple hover:bg-purple hover:text-black transition-all cursor-pointer shadow-[0_0_12px_rgba(180,100,255,0.25)]"
                    >
                      <MessageSquarePlus className="h-3 w-3" />
                      <span>PARLEY</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* BOTTOM ARENA COMMAND DOCK */}
      <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-t border-line/60 bg-black/90 px-4">
        {/* ACTION ECONOMY BADGES */}
        <div className="flex items-center gap-2.5 text-[10px]">
          <span className="text-dim">
            ACTOR:{' '}
            <strong className={isPlayerTurn ? 'text-cyan' : 'text-alert'}>
              {activeActor?.name ?? 'None'}
            </strong>
          </span>

          <span className="text-line">|</span>

          {/* ACTION */}
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 font-bold',
              !economy.actionUsed
                ? 'border border-ok bg-ok/20 text-ok'
                : 'border border-line/30 text-faint line-through'
            )}
          >
            <Zap className="h-3 w-3" />
            ACTION
          </span>

          {/* BONUS */}
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 font-bold',
              !economy.bonusActionUsed
                ? 'border border-cyan bg-cyan/20 text-cyan'
                : 'border border-line/30 text-faint line-through'
            )}
          >
            BONUS
          </span>

          {/* SPEED */}
          <span className="text-dim">
            SPEED:{' '}
            <strong className="text-accent">
              {economy.movementRemaining} / {activeActor?.speedMax ?? economy.movementMax} FT
            </strong>
          </span>
        </div>

        {/* COMBAT ACTIONS BAR */}
        <div className="flex items-center gap-2">
          {/* STRIKE ATTACK */}
          {attacks.map((att) => (
            <button
              key={att.name}
              type="button"
              disabled={!isPlayerTurn || economy.actionUsed || !targetCombatant}
              onClick={() => {
                setSelectedAttack(att.name)
                if (targetCombatant) onAttack(targetCombatant.id, att.name)
              }}
              className={cn(
                'flex h-8 items-center gap-1.5 border px-3 text-[11px] font-bold uppercase transition-all',
                isPlayerTurn && !economy.actionUsed && targetCombatant
                  ? 'border-cyan bg-cyan text-black hover:bg-cyan/90 cursor-pointer shadow-[0_0_12px_rgba(0,216,246,0.35)]'
                  : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
              )}
            >
              <Swords className="h-3.5 w-3.5" />
              <span>{att.name} ({att.damage})</span>
            </button>
          ))}

          {/* DASH */}
          <button
            type="button"
            disabled={!maneuvers.canDash}
            onClick={dashAction}
            className={cn(
              'flex h-8 items-center gap-1.5 border px-3 text-[11px] font-bold uppercase transition-all',
              maneuvers.canDash
                ? 'border-line/60 bg-black/60 text-white hover:border-accent hover:text-accent cursor-pointer'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <Footprints className="h-3.5 w-3.5 text-accent" />
            <span>{maneuvers.dashLabel}</span>
          </button>

          {/* DODGE */}
          <button
            type="button"
            disabled={!maneuvers.canDodge}
            onClick={dodgeAction}
            className={cn(
              'flex h-8 items-center gap-1.5 border px-3 text-[11px] font-bold uppercase transition-all',
              economy.isDodging
                ? 'border-accent bg-accent/20 text-accent cursor-default'
                : maneuvers.canDodge
                ? 'border-line/60 bg-black/60 text-white hover:border-accent hover:text-accent cursor-pointer'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <Shield className="h-3.5 w-3.5 text-accent" />
            <span>{maneuvers.dodgeLabel}</span>
          </button>

          {/* PARLEY */}
          <button
            type="button"
            disabled={!targetCombatant}
            onClick={() => {
              if (targetCombatant) {
                const tree = defaultDialogueTree(targetCombatant.id, targetCombatant.name)
                useDialogue.getState().startDialogue(tree, targetCombatant.name)
              }
            }}
            className={cn(
              'flex h-8 items-center gap-1.5 border px-3 text-[11px] font-bold uppercase transition-all',
              targetCombatant
                ? 'border-purple bg-purple/20 text-purple hover:bg-purple hover:text-black cursor-pointer shadow-[0_0_12px_rgba(180,100,255,0.3)]'
                : 'border-line/30 bg-black/40 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>PARLEY</span>
          </button>

          {/* END TURN */}
          <button
            type="button"
            disabled={!isPlayerTurn}
            onClick={endTurn}
            className={cn(
              'flex h-8 items-center gap-1 border px-3.5 text-[11px] font-bold uppercase tracking-wider transition-all ml-1',
              isPlayerTurn
                ? 'border-accent bg-accent text-black hover:bg-accent/90 cursor-pointer shadow-[0_0_16px_rgba(255,160,0,0.4)]'
                : 'border-line/40 bg-line/20 text-faint cursor-not-allowed opacity-50'
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>END TURN [SPACE]</span>
          </button>
        </div>
      </div>
    </div>
  )
}
