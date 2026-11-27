import { useEffect } from 'react'
import { Footprints, MessageSquarePlus, Swords, User, X } from 'lucide-react'
import type { Catalog } from '@shared/game/core'
import type { MapToken } from '../../maps/TokenLayer'
import type { StoredFaction } from '@shared/game/factions'
import { getFactionStance, STANCE_BADGE } from '@shared/game/factions'
import { GamePortrait, HudButton } from '../../../game/ui'
import { useLive } from '../../../lib/useLive'
import { engine } from '../../../lib/ipc'
import { cn } from '../../../lib/cn'
import { isTypingTarget, matchesKeybind } from '../../../store/keybinds'
import { useGameplaySettings } from '../settings/gameplaySettingsStore'

interface TargetHudProps {
  target: MapToken
  playerToken: MapToken | null
  catalog?: Catalog | null
  tileW?: number
  inCombat?: boolean
  onClear: () => void
  onTalk?: () => void
  onApproach?: () => void
  onInspect?: () => void
  onAttack?: () => void
  onEngageCombat?: () => void
  className?: string
}

export function TargetHud({
  target,
  playerToken,
  catalog,
  inCombat = false,
  onClear,
  onTalk,
  onApproach,
  onInspect,
  onAttack,
  onEngageCombat,
  className
}: TargetHudProps) {
  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const playerFaction = playerToken?.visitor.faction || 'player_party'
  const targetFaction = target.visitor.faction || 'monsters'
  const stance = getFactionStance(factions, playerFaction, targetFaction)
  const badge = STANCE_BADGE[stance]

  // Hotkeys: Esc (Clear Target), T (Talk), A (Approach), C (Inspect), F (Attack/Engage)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || isTypingTarget(e)) return
      const cancelCode = useGameplaySettings.getState().settings.keybinds.cancel?.code ?? 'Escape'
      const inspectCode = useGameplaySettings.getState().settings.keybinds.sheet?.code ?? 'KeyC'
      if (e.code === cancelCode && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        onClear()
      } else if (matchesKeybind('tactical.targetTalk', e) && onTalk) {
        e.preventDefault()
        onTalk()
      } else if (matchesKeybind('tactical.targetApproach', e) && onApproach) {
        e.preventDefault()
        onApproach()
      } else if (e.code === inspectCode && !e.ctrlKey && !e.metaKey && !e.altKey && onInspect) {
        e.preventDefault()
        onInspect()
      } else if (matchesKeybind('tactical.targetAttack', e)) {
        e.preventDefault()
        if (inCombat && onAttack) onAttack()
        else if (!inCombat && onEngageCombat) onEngageCombat()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClear, onTalk, onApproach, onInspect, onAttack, onEngageCombat, inCombat])

  return (
    <div className={cn('pointer-events-auto flex flex-col items-start gap-1.5 select-none font-ui', className)}>
      {/* TARGET UNIT FRAME - REUSABLE GamePortrait IN MATCHING w-64 CONTAINER */}
      <div
        className={cn(
          'flex w-64 flex-col border tone-panel-90 shadow-lg transition-colors',
          stance === 'hostile'
            ? 'border-alert/70'
            : stance === 'allied' || stance === 'friendly'
            ? 'border-ok/70'
            : 'border-line/60'
        )}
      >
        {/* FACTION & STANCE HEADER */}
        <div className="flex items-center justify-between border-b border-line/40 bg-ink/[0.04] px-2 py-0.5 text-[9px]">
          <span className={cn('font-bold caps-5 ', badge.cls.split(' ')[0])}>
            [{badge.label}]
          </span>
          <span className="truncate text-dim caps max-w-[130px]">
            {target.visitor.faction ? `FACTION: ${target.visitor.faction}` : 'CREATURE'}
          </span>
          <button
            type="button"
            onClick={onClear}
            title="Clear target (Esc)"
            className="text-dim hover:text-alert p-0.5 cursor-pointer transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <GamePortrait visitor={target.visitor} catalog={catalog} />
      </div>

      {/* TARGET QUICK BUTTONS - MATCHING GameMenu / HudButton ROW UNDERNEATH */}
      <div className="flex items-center gap-1.5">
        {onTalk && (
          <HudButton
            icon={<MessageSquarePlus />}
            label="Talk"
            keyHint="T"
            onClick={onTalk}
          />
        )}
        {onApproach && (
          <HudButton
            icon={<Footprints />}
            label="Approach"
            keyHint="A"
            onClick={onApproach}
          />
        )}
        {onInspect && (
          <HudButton
            icon={<User />}
            label="Inspect Sheet"
            keyHint="C"
            onClick={onInspect}
          />
        )}
        {inCombat && onAttack ? (
          <HudButton
            icon={<Swords className="text-alert" />}
            label="Attack"
            keyHint="F"
            onClick={onAttack}
          />
        ) : !inCombat && onEngageCombat ? (
          <HudButton
            icon={<Swords className="text-accent" />}
            label="Engage"
            keyHint="F"
            onClick={onEngageCombat}
          />
        ) : null}
      </div>
    </div>
  )
}
