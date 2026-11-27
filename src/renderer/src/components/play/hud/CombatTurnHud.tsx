import { useEffect, useRef } from 'react'
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
  const aiTurnDelayMs = useGameplaySettings((s) => s.settings.aiTurnDelayMs)
  const aiTurnRef = useRef<string | null>(null)

  // Hotkey: Space ends active party member turn
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
        void endTurn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [battle, endTurn])

  // Engine-driven AI turn execution (deduplicated per encounter round + turn index)
  useEffect(() => {
    if (!battle || battle.status !== 'active') {
      aiTurnRef.current = null
      return
    }
    const activeActor = battle.queue[battle.activeTurnIndex]
    if (!activeActor || activeActor.isPlayer) {
      aiTurnRef.current = null
      return
    }

    const turnKey = `${battle.id}:${battle.round}:${battle.activeTurnIndex}`
    if (aiTurnRef.current === turnKey) return

    const timer = setTimeout(() => {
      if (aiTurnRef.current === turnKey) return
      aiTurnRef.current = turnKey
      void executeAiTurn()
    }, Math.max(0, aiTurnDelayMs))

    return () => clearTimeout(timer)
  }, [battle?.id, battle?.status, battle?.round, battle?.activeTurnIndex, battle?.queue, aiTurnDelayMs, executeAiTurn])

  if (!battle) return null

  // VICTORY MODAL OVERLAY
  if (battle.status === 'victory') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-scrim/80 backdrop-blur-[var(--panel-blur)] font-ui">
        <div className="flex w-[440px] flex-col border border-accent bg-panel p-5 shadow-[0_16px_48px_color-mix(in_srgb,rgb(255,160,0)_calc(25%*var(--glow)),transparent)]">
          <div className="flex items-center gap-2 border-b border-line/60 pb-3">
            <Trophy className="h-6 w-6 text-accent animate-bounce" />
            <span className="text-[16px] font-extrabold caps-10 text-ink">
              VICTORY ACHIEVED
            </span>
          </div>

          <div className="flex flex-col gap-2.5 py-4 text-[12px]">
            <p className="text-dim leading-relaxed">
              All hostile threats have been neutralized or recruited. The combat arena has cleared.
            </p>
            <div className="flex items-center justify-between border border-line/40 bg-ink/[0.03] px-3 py-2 text-[11px]">
              <span className="text-faint caps">Rounds completed</span>
              <strong className="text-ink">{battle.round}</strong>
            </div>
            <div className="flex items-center justify-between border border-line/40 bg-ink/[0.03] px-3 py-2 text-[11px]">
              <span className="text-faint caps">Combatants engaged</span>
              <strong className="text-tint-cyan">{battle.queue.length}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => endBattle('victory')}
            className="flex h-9 items-center justify-center gap-2 border border-accent bg-accent/20 text-[12px] font-bold caps-5 text-accent hover:bg-accent hover:text-on-accent transition-all cursor-pointer shadow-[0_0_16px_color-mix(in_srgb,rgb(255,160,0)_calc(30%*var(--glow)),transparent)]"
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
      <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-scrim/85 backdrop-blur-[var(--panel-blur)] font-ui">
        <div className="flex w-[440px] flex-col border border-alert bg-panel p-5 shadow-[0_16px_48px_color-mix(in_srgb,rgb(255,77,77)_calc(30%*var(--glow)),transparent)]">
          <div className="flex items-center gap-2 border-b border-line/60 pb-3">
            <Skull className="h-6 w-6 text-alert" />
            <span className="text-[16px] font-extrabold caps-10 text-alert">
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
              className="flex h-9 flex-1 items-center justify-center gap-2 border border-line/60 bg-line/20 text-[11.5px] font-bold caps-5 text-ink hover:border-alert hover:text-alert transition-all cursor-pointer"
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
