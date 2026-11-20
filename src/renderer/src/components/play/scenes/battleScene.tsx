import { combatParleyDialogueTree } from '@shared/game/dialogue'
import type { BattleState } from '@shared/game/state/BattleStateMachine'
import { useDialogue } from '../dialogue/dialogueStore'
import { useGameState } from '../state/gameStateStore'
import { findGameplaySession } from '../gameplaySession'
import { useSessions } from '../../../store/sessions'
import { AgentNarrationStream, CompactCombatLog, InitiativeRibbon, PlayerChatOverlay, TacticalActionDeck, UnitCardStack, type UnitCardData } from '../hud'
import { ClockHud } from '../hud/ClockHud'
import { buffChips } from '../battle/buffChips'
import type { PlayHud, PlayScene } from './PlayScene'
import { AimHint } from './AimHint'
import { exploreScene } from './exploreScene'

function unitsOf(battle: BattleState, hud: PlayHud, players: boolean): UnitCardData[] {
  const active = battle.queue[battle.activeTurnIndex]?.id
  return battle.queue
    .filter((c) => c.isPlayer === players)
    .map((c) => {
      const tok = hud.tokens.find((t) => (c.sheet && t.visitor.sheet === c.sheet) || t.visitor.token === c.id)
      return {
        id: c.id,
        name: c.name,
        sheet: c.sheet,
        image: c.image ?? tok?.visitor.image ?? null,
        hp: c.hp,
        ac: c.ac,
        conditions: buffChips(tok?.visitor.game, hud.catalog, hud.roundSeconds),
        isPlayer: players,
        isActiveTurn: active === c.id,
        isSelected: hud.who === c.id || (Boolean(c.sheet) && hud.who === c.sheet),
        faction: c.faction ?? (players ? 'PLAYER' : 'HOSTILE')
      }
    })
}

function BattleScreen({ hud }: { hud: PlayHud }) {
  const battle = useGameState((s) => s.battle)
  const attackTarget = useGameState((s) => s.attackTarget)
  const endBattle = useGameState((s) => s.endBattle)
  const sessions = useSessions((s) => s.list)
  const gameplaySession = findGameplaySession(sessions, hud.world, hud.saveId)
  if (!battle) return <exploreScene.Screen hud={hud} />
  const active = battle.queue[battle.activeTurnIndex]?.id ?? null
  const hostiles = unitsOf(battle, hud, false)
  return (
    <>
      <InitiativeRibbon battle={battle} selectedCombatantId={hud.who} onSelectCombatant={(id) => hud.pickWho(id)} onFlee={() => endBattle('flee')} className="absolute left-1/2 top-2.5 z-30 max-w-[calc(100%-1.5rem)] -translate-x-1/2 phone:top-14" />
      <AgentNarrationStream sessionId={gameplaySession?.id ?? null} className="absolute left-1/2 top-14 -translate-x-1/2 z-25" />
      {hud.time && <ClockHud view={hud.time} controls={null} />}
      <div className="pointer-events-none absolute left-3 top-14 z-20 flex flex-col items-start phone:top-24">
        <UnitCardStack side="left" title="PARTY" units={unitsOf(battle, hud, true)} activeId={active} selectedId={hud.target ? hud.who : null} onSelect={(id) => hud.pickWho(id)} className="phone:w-[124px]" />
      </div>
      {hostiles.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-14 z-20 flex flex-col items-end phone:top-24">
          <UnitCardStack
            side="right"
            title="HOSTILES"
            units={hostiles}
            activeId={active}
            selectedId={hud.target ? hud.who : null}
            onSelect={(id) => hud.pickWho(id)}
            onClear={
              hud.target
                ? () => {
                    hud.setWho(null)
                    useDialogue.getState().closeDialogue()
                  }
                : undefined
            }
            className="phone:w-[124px]"
          />
        </div>
      )}
      <CompactCombatLog className="absolute bottom-3 right-3 z-30 tablet:hidden" />
      {!hud.embedded && (
        <PlayerChatOverlay
          worldId={hud.world}
          saveId={hud.saveId}
          mapId={hud.mapId}
          playerSheet={hud.player}
          playerName={hud.actor?.visitor.name ?? 'Player'}
          targetSheet={hud.target?.visitor.sheet ?? null}
          targetName={hud.target?.visitor.name ?? null}
          placeKey={hud.placeKey}
          placeName={hud.placeName}
        />
      )}
      <TacticalActionDeck
        visitor={hud.actor?.visitor ?? null}
        catalog={hud.catalog}
        aiming={hud.aim?.uid ?? null}
        onAim={hud.setAim}
        selectedTargetId={hud.target ? (hud.target.visitor.token || hud.target.visitor.sheet) : null}
        onAttack={(tid, att) => attackTarget(tid, att)}
      />
      <AimHint aim={hud.aim} />
    </>
  )
}

export const battleScene: PlayScene = {
  Screen: BattleScreen,
  talk: (target) => useDialogue.getState().startDialogue(combatParleyDialogueTree(target.visitor.sheet, target.visitor.name), target.visitor.name),
  act: (target) => {
    useGameState.getState().attackTarget(target.visitor.token || target.visitor.sheet)
  },
  walked: () => undefined,
  endBattle: () => exploreScene
}
