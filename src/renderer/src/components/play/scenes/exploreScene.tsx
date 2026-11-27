import { recordHealth, recordStat } from '@shared/game/components'
import { defaultDialogueTree } from '@shared/game/dialogue'
import type { MapToken } from '../../maps/TokenLayer'
import { openEntry } from '../../../lib/library'
import { buffChips } from '../battle/buffChips'
import { useDialogue } from '../dialogue/dialogueStore'
import { useGameState } from '../state/gameStateStore'
import { findGameplaySession } from '../gameplaySession'
import { useSessions } from '../../../store/sessions'
import { AgentNarrationStream, PlayerChatOverlay, SpeechBubbleOverlay, TacticalActionDeck, UnitCardStack, type UnitCardData } from '../hud'
import { ClockHud } from '../hud/ClockHud'
import { GameMenu } from '../screens'
import type { PlayHud, PlayScene } from './PlayScene'
import { AimHint } from './AimHint'
import { battleScene } from './battleScene'

function partyOf(hud: PlayHud): UnitCardData[] {
  const defaultAc = hud.catalog?.stat('armour')?.default ?? 0
  const partySet = new Set(hud.partyIds.length ? hud.partyIds : (hud.player ? [hud.player] : []))
  return hud.tokens
    .filter((t) => t.visitor.source !== 'creature' && partySet.has(t.visitor.sheet))
    .sort((a, b) => Number(b.visitor.sheet === hud.player) - Number(a.visitor.sheet === hud.player))
    .map((t) => {
      const gHp = recordHealth(t.visitor.game, hud.catalog)
      const hp = gHp ? { cur: gHp.cur, max: gHp.max } : (t.visitor.hp ?? t.visitor.dnd?.hp ?? { cur: 0, max: 0 })
      const ac = recordStat(t.visitor.game, hud.catalog, 'armour') ?? t.visitor.dnd?.ac ?? defaultAc
      return {
        id: t.visitor.token || t.visitor.sheet,
        name: t.visitor.name,
        sheet: t.visitor.sheet,
        image: t.visitor.image ?? null,
        subtitle: t.visitor.line || null,
        ac,
        hp,
        conditions: t.visitor.game ? buffChips(t.visitor.game, hud.catalog, hud.roundSeconds) : (t.visitor.dnd?.conditions ?? []),
        isPlayer: t.visitor.sheet === hud.player,
        isActiveTurn: false,
        isSelected: t.visitor.sheet !== hud.player && hud.who === (t.visitor.token || t.visitor.sheet),
        faction: t.visitor.faction ?? 'PARTY'
      }
    })
}

function targetOf(target: MapToken, hud: PlayHud): UnitCardData {
  const defaultAc = hud.catalog?.stat('armour')?.default ?? 0
  const gHp = recordHealth(target.visitor.game, hud.catalog)
  const hp = gHp ? { cur: gHp.cur, max: gHp.max } : (target.visitor.hp ?? target.visitor.dnd?.hp ?? { cur: 0, max: 0 })
  const ac = recordStat(target.visitor.game, hud.catalog, 'armour') ?? target.visitor.dnd?.ac ?? defaultAc
  return {
    id: target.visitor.token || target.visitor.sheet,
    name: target.visitor.name,
    sheet: target.visitor.sheet,
    image: target.visitor.image ?? null,
    subtitle: target.visitor.line || null,
    ac,
    hp,
    conditions: target.visitor.game ? buffChips(target.visitor.game, hud.catalog, hud.roundSeconds) : (target.visitor.dnd?.conditions ?? []),
    isPlayer: false,
    isSelected: true,
    faction: target.visitor.faction ?? (target.visitor.source === 'creature' ? 'CREATURE' : 'NPC')
  }
}

function engage(target: MapToken, hud: PlayHud): void {
  if (!hud.player) return
  void useGameState.getState().startBattle(hud.player, [target.visitor.token || target.visitor.sheet])
}

const BUTTON = 'flex-1 flex items-center justify-center gap-1 border border-line/60 tone-well-90 py-1 text-[10px] font-bold text-dim transition-colors cursor-pointer'

function ExploreScreen({ hud }: { hud: PlayHud }) {
  const attackTarget = useGameState((s) => s.attackTarget)
  const sessions = useSessions((s) => s.list)
  const gameplaySession = findGameplaySession(sessions, hud.world, hud.saveId)
  const target = hud.target && hud.target.visitor.sheet !== hud.player ? hud.target : null
  const sheet = hud.screenSheet ?? hud.player
  return (
    <>
      <SpeechBubbleOverlay tokens={hud.tokens} camera={hud.camera} />
      <AgentNarrationStream sessionId={gameplaySession?.id ?? null} className="absolute left-1/2 top-12 -translate-x-1/2 z-20" />

      <div className="pointer-events-none absolute left-3 top-12 z-20 flex flex-col items-start gap-1.5">
        <UnitCardStack side="left" title="PARTY" units={partyOf(hud)} activeId={null} selectedId={target ? hud.who : null} onSelect={hud.pickWho} />
        {hud.catalog && hud.tokens.some((t) => t.visitor.game) ? (
          <GameMenu open={hud.screen} onOpen={hud.setScreen} />
        ) : (
          sheet && (
            <div className="pointer-events-auto flex gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={() => openEntry('sheet', sheet)}
                className="flex items-center gap-1.5 border border-line/60 tone-well-90 px-2.5 py-1 font-ui text-[11px] font-bold text-ink hover:border-accent hover:text-accent transition-colors cursor-pointer"
              >
                <span className="border border-line/60 bg-line/20 px-1 text-[9px] text-secondary-ink">C</span>
                <span>CHARACTER SHEET</span>
              </button>
            </div>
          )
        )}
      </div>

      {target && (
        <div className="pointer-events-none absolute right-3 top-12 z-20 flex flex-col items-end gap-1.5">
          <UnitCardStack
            side="right"
            title="TARGET"
            units={[targetOf(target, hud)]}
            selectedId={hud.who}
            onSelect={(id) => hud.pickWho(id)}
            onClear={() => {
              hud.setWho(null)
              useDialogue.getState().closeDialogue()
            }}
            footer={
              <div className="flex flex-col gap-1 font-ui">
                <div className="flex gap-1">
                  {target.visitor.sheet && (
                    <button type="button" onClick={() => exploreScene.talk(target)} title="Talk with entity (T)" className={`${BUTTON} hover:border-tint-purple hover:text-tint-purple`}>
                      <span className="text-[8.5px] text-faint">[T]</span>
                      <span>TALK</span>
                    </button>
                  )}
                  <button type="button" onClick={() => hud.nav?.smartApproach(target.at, () => undefined)} title="Approach entity (A)" className={`${BUTTON} hover:border-secondary-ink hover:text-secondary-ink`}>
                    <span className="text-[8.5px] text-faint">[A]</span>
                    <span>APPROACH</span>
                  </button>
                </div>
                <div className="flex gap-1">
                  {target.visitor.sheet && (
                    <button type="button" onClick={() => openEntry('sheet', target.visitor.sheet)} title="Inspect sheet (C)" className={`${BUTTON} hover:border-accent hover:text-accent`}>
                      <span className="text-[8.5px] text-faint">[C]</span>
                      <span>INSPECT</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => exploreScene.act(target, hud)}
                    title="Engage in combat (F)"
                    className="flex-1 flex items-center justify-center gap-1 border border-alert/70 bg-alert/15 py-1 text-[10px] font-bold text-alert hover:border-alert hover:bg-alert hover:text-ink transition-all cursor-pointer shadow-[0_0_8px_color-mix(in_srgb,rgb(255,77,77)_calc(25%*var(--glow)),transparent)]"
                  >
                    <span className="text-[8.5px] text-alert/70">[F]</span>
                    <span>ENGAGE</span>
                  </button>
                </div>
              </div>
            }
          />
        </div>
      )}

      {!hud.embedded && (
        <PlayerChatOverlay
          worldId={hud.world}
          saveId={hud.saveId}
          mapId={hud.mapId}
          playerSheet={hud.player}
          playerName={hud.actor?.visitor.name ?? 'Player'}
          targetSheet={target?.visitor.sheet ?? null}
          targetName={target?.visitor.name ?? null}
          placeKey={hud.placeKey}
          placeName={hud.placeName}
        />
      )}

      {hud.time && (
        <ClockHud
          view={hud.time}
          controls={hud.clock}
          party={hud.tokens
            .filter((t) => {
              const partySet = new Set(hud.partyIds.length ? hud.partyIds : (hud.player ? [hud.player] : []))
              return t.visitor.source !== 'creature' && partySet.has(t.visitor.sheet) && Boolean(t.visitor.game)
            })
            .map((t) => ({ sheet: t.visitor.sheet, name: t.visitor.name, hitDice: t.visitor.dnd?.hitDice ?? null }))}
          offsetRight={Boolean(hud.placeKey)}
        />
      )}

      <TacticalActionDeck
        visitor={hud.actor?.visitor ?? null}
        catalog={hud.catalog}
        aiming={hud.aim?.uid ?? null}
        onAim={hud.setAim}
        selectedTargetId={target ? (target.visitor.token || target.visitor.sheet) : null}
        onAttack={(tid, att) => attackTarget(tid, att)}
      />

      <AimHint aim={hud.aim} />
      {hud.placeCard}
      {hud.cardHand}
    </>
  )
}

export const exploreScene: PlayScene = {
  Screen: ExploreScreen,
  talk: (target) => useDialogue.getState().startDialogue(defaultDialogueTree(target.visitor.sheet, target.visitor.name), target.visitor.name),
  act: engage,
  walked: (hud, sheet, feet) => {
    const t = hud.tokens.find((x) => x.visitor.sheet === sheet)
    if (!t) return
    const speedStat = useGameState.getState().timeDef?.speedStat ?? ''
    const speed = (speedStat ? recordStat(t.visitor.game, hud.catalog, speedStat) : null) ?? t.visitor.dnd?.speed ?? 0
    if (speed > 0) hud.clock?.pass((feet / speed) * hud.roundSeconds, 'walk')
  },
  startBattle: () => battleScene
}
