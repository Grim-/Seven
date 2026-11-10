import { useEffect } from 'react'
import {
  RotateCcw,
  Skull,
  Sparkles,
  Trophy
} from 'lucide-react'
import { useGameState } from '../state/gameStateStore'
import { useGameplaySettings } from '../settings/gameplaySettingsStore'

export function CombatTurnHud() {
  const battle = useGameState((s) => s.battle)
  const endTurn = useGameState((s) => s.endTurn)
  const endBattle = useGameState((s) => s.endBattle)
  const executeAiTurn = useGameState((s) => s.executeAiTurn)

  // Hotkey: Space ends player turn
  useEffect(() => {
    if (!battle || battle.status !== 'active') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return

      const activeActor = battle.queue[battle.activeTurnIndex]
      if (!activeActor?.isPlayer) return
      const endTurnCode = useGameplaySettings.getState().settings.keybinds.endTurn?.code ?? 'Space'
      if (e.code === endTurnCode && !e.repeat) {
        e.preventDefault()
        endTurn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [battle, endTurn])

  // Automated enemy AI turn execution
  useEffect(() => {
    if (!battle || battle.status !== 'active') return
    const activeActor = battle.queue[battle.activeTurnIndex]
    if (!activeActor || activeActor.isPlayer) return

    const timer = setTimeout(() => {
      executeAiTurn()
    }, 1100)

    return () => clearTimeout(timer)
  }, [battle?.status, battle?.activeTurnIndex, battle?.queue, executeAiTurn])

  if (!battle) return null

  // VICTORY MODAL OVERLAY
  if (battle.status === 'victory') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm font-mono">
        <div className="flex w-[440px] flex-col border border-accent bg-black p-5 shadow-[0_16px_48px_rgba(255,160,0,0.25)]">
          <div className="flex items-center gap-2 border-b border-line/60 pb-3">
            <Trophy className="h-6 w-6 text-accent animate-bounce" />
            <span className="text-[16px] font-extrabold uppercase tracking-widest text-white">
              VICTORY ACHIEVED
            </span>
          </div>

          <div className="flex flex-col gap-2.5 py-4 text-[12px]">
            <p className="text-dim leading-relaxed">
              All hostile threats have been neutralized or recruited. The combat arena has cleared.
            </p>
            <div className="flex items-center justify-between border border-line/40 bg-white/[0.03] px-3 py-2 text-[11px]">
              <span className="text-faint">ROUNDS COMPLETED</span>
              <strong className="text-white">{battle.round}</strong>
            </div>
            <div className="flex items-center justify-between border border-line/40 bg-white/[0.03] px-3 py-2 text-[11px]">
              <span className="text-faint">COMBATANTS ENGAGED</span>
              <strong className="text-cyan">{battle.queue.length}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => endBattle('victory')}
            className="flex h-9 items-center justify-center gap-2 border border-accent bg-accent/20 text-[12px] font-bold uppercase tracking-wider text-accent hover:bg-accent hover:text-black transition-all cursor-pointer shadow-[0_0_16px_rgba(255,160,0,0.3)]"
          >
            <Sparkles className="h-4 w-4" />
            <span>CONTINUE EXPLORING</span>
          </button>
        </div>
      </div>
    )
  }

  // DEFEAT MODAL OVERLAY
  if (battle.status === 'defeat') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm font-mono">
        <div className="flex w-[440px] flex-col border border-alert bg-black p-5 shadow-[0_16px_48px_rgba(255,77,77,0.3)]">
          <div className="flex items-center gap-2 border-b border-line/60 pb-3">
            <Skull className="h-6 w-6 text-alert" />
            <span className="text-[16px] font-extrabold uppercase tracking-widest text-alert">
              PARTY DEFEATED
            </span>
          </div>

          <div className="flex flex-col gap-2.5 py-4 text-[12px]">
            <p className="text-dim leading-relaxed">
              Your party was overcome in combat. All active party members have collapsed.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => endBattle('flee')}
              className="flex h-9 flex-1 items-center justify-center gap-2 border border-line/60 bg-line/20 text-[11.5px] font-bold uppercase tracking-wider text-white hover:border-alert hover:text-alert transition-all cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>RETREAT (FLEE)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Victory/Defeat modals are returned above; in active battle, turn HUD is handled by InitiativeRibbon and TacticalActionDeck
  return null
}
