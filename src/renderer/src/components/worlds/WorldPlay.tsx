import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { Footprints, MessageSquarePlus, Swords, UserPlus } from 'lucide-react'
import { mapArea, placePath, type MapData, type PlaceVisitor, type WorldMapUse } from '@shared/maps'
import { showName } from '@shared/ids'
import type { MapToken } from '../maps/TokenLayer'
import { ActionBar, Button, EmptyState, Eyebrow, Modal, ShellTabs, openMenu, type MenuItem } from '../ui'
import { Markdown } from '../chat/Markdown'
import { EntryPicker } from '../library/EntryPicker'
import { bringHere } from '../play/bringHere'
import { engine } from '../../lib/ipc'
import { useLive, useLibraryData } from '../../lib/useLive'
import { openEntry } from '../../lib/library'
import { startChatItems } from '../../views/data/entryMenu'
import { useEscapeLayer } from '../../lib/escape'
import { PlayStage, type ClockControls, type StageNavigation } from './PlayStage'
import type { ClockView } from '../../game/explore/WorldClock'
import type { View } from '../../game/engine/Camera'
import { ClockHud } from '../play/hud/ClockHud'
import { GameMenu, GameScreens } from '../play/screens'
import {
  UnitCardStack,
  type UnitCardData,
  CompactCombatLog,
  AgentNarrationStream,
  InitiativeRibbon,
  TacticalActionDeck,
  CombatTurnHud,
  PlayerChatOverlay,
  SpeechBubbleOverlay
} from '../play/hud'
import { SavePicker } from '../play/SavePicker'
import { useCurrentSave } from '../play/useSaves'
import { useTriggerPlay } from '../play/triggers/useTriggerPlay'
import '../play/triggers'
import { CharacterRow } from '../maps/CharacterRow'
import { SheetPortrait } from '../data/SheetPortrait'
import { HpBar } from '../maps/HpBar'
import { RecordBars } from '../game/ResourceBars'
import { useGameCatalog } from '../game/useGameCatalog'
import { RuleSetProvider, useResolvedRuleSet, useRuleSet } from '../game/ruleSet'
import { placeName } from '../maps/placeShapes'
import { useWorldMaps } from '../maps/useMap'
import { usePresenceData } from '../maps/usePresence'
import { WorldMapLoad } from '../maps/WorldMapView'
import { objectHandlers } from '../maps/objectActions'
import { useMapTokens } from '../maps/useMapTokens'
import { JourneyStrip } from './Journey'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import type { PlaceData } from '../maps/usePlaceRecords'
import { PlayList } from '../play/PlayList'
import { placePlay } from '../play/playHolder'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { sceneLink, worldWhere } from '../play/playStore'
import { CardHand } from '../cards/CardHand'
import { playCard } from '../cards/playCard'
import { useDeckInUse } from '../cards/useDeckInUse'
import { defaultDialogueTree, combatParleyDialogueTree } from '@shared/game/dialogue'
import { useDialogue } from '../play/dialogue/dialogueStore'
import { useGameState } from '../play/state/gameStateStore'
import { combatantFromVisitor } from '@shared/game/state/BattleStateMachine'

const agentsOf = (here: PlaceVisitor[]) => here.flatMap((v) => (v.agent ? [v.agent] : []))

function PlayPanel({ children, actions }: { children: ReactNode; actions: MenuItem[] }) {
  return (
    <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-24px)] w-[340px] flex-col border border-line/70 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.5)]">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">{children}</div>
      <ActionBar items={actions} className="shrink-0 border-t border-line/40 p-2.5" />
    </div>
  )
}

function PlayCard({ world, placeKey, data, player }: { world: string; placeKey: string; data: PlaceData; player: string | null }) {
  const { places, here } = data
  const place = places[placeKey] ?? {}
  const now = typeof place.Now === 'string' ? place.Now : ''
  const there = here[placeKey] ?? []
  return (
    <PlayPanel actions={[{ label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(sceneLink(`@place:${placeKey}`, player) ?? '', agentsOf(there)) }]}>
        <div className="font-mono text-[11px] text-dim">{placePath(places, placeKey).map((k) => placeName(places, k)).join(' › ')}</div>
        <div className="text-[15px] font-semibold uppercase tracking-[0.06em] text-white">{placeName(places, placeKey)}</div>
        {now ? <Markdown text={now} className="border border-cyan/25 bg-cyan/[0.04] px-2.5 py-1.5 text-[13px] leading-relaxed text-white/90" /> : <span className="text-[12px] text-faint">Nothing is happening here.</span>}
        {there.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Who is here</Eyebrow>
            {there.map((v) => (
              <CharacterRow key={v.sheet} visitor={v} />
            ))}
          </div>
        )}
        <PlayList play={placePlay(world, placeKey, place, player, agentsOf(there))} />
    </PlayPanel>
  )
}

function PlayMap({ world, map, use, uses, data, player, at, onGo }: { world: string; map: MapData; use: WorldMapUse; uses: WorldMapUse[]; data: PlaceData; player: string | null; at: string | null; onGo: (map: string) => void }) {
  const [looking, setLooking] = useState<string | null>(at)
  const [who, setWho] = useState<string | null>(null)
  const [time, setTime] = useState<ClockView | null>(null)
  const [clock, setClock] = useState<ClockControls | null>(null)
  const [nav, setNav] = useState<StageNavigation | null>(null)
  const [screen, setScreen] = useState<string | null>(null)
  const [screenSheet, setScreenSheet] = useState<string | null>(null)
  const [aim, setAim] = useState<{ uid: string; label: string } | null>(null)
  const [camera, setCamera] = useState<View | null>(null)
  const [showPickPlayer, setShowPickPlayer] = useState(false)
  const catalog = useGameCatalog()
  const save = useCurrentSave(world)

  const battle = useGameState((s) => s.battle)
  const attackTarget = useGameState((s) => s.attackTarget)
  const startBattle = useGameState((s) => s.startBattle)
  const endBattle = useGameState((s) => s.endBattle)
  const inCombat = battle !== null && battle.status === 'active'

  // Auto-place player character at map center if not yet positioned on this map
  useEffect(() => {
    if (!player || !world || !map) return
    if (!use.stand[player]) {
      const area = mapArea(map)
      const at = {
        x: Math.max(16, Math.round(area.w / 2)),
        y: Math.max(16, Math.round(area.h / 2))
      }
      const next: WorldMapUse = {
        ...use,
        stand: {
          ...use.stand,
          [player]: { at, actions: '', decisions: '' }
        }
      }
      void engine('worlds.saveMapUse', { id: world, use: next }).catch(failed('Could not auto-place player token'))
    }
  }, [player, world, map, use])

  // Derive interactive creature tokens from map spawners
  const spawnerTokens = useMemo<MapToken[]>(() => {
    const list = map.spawners ?? []
    if (!list.length) return []
    return list.map((s) => {
      const isHostile = s.disposition === 'hostile'
      const isNeutral = s.disposition === 'neutral'
      const line = `${isHostile ? 'HOSTILE' : isNeutral ? 'NEUTRAL' : 'FRIENDLY'} · ${s.monsterId || 'Creature'}`
      return {
        at: s.at,
        visitor: {
          sheet: `spawner:${s.id}`,
          name: s.name,
          image: null,
          line,
          dnd: {
            hp: { cur: 15, max: 15, temp: 0 },
            ac: 13,
            stats: { str: 12, dex: 12, con: 12, int: 8, wis: 10, cha: 8 },
            conditions: []
          },
          faction: s.faction ?? (isHostile ? 'monsters' : 'neutral'),
          agent: null
        }
      }
    })
  }, [map.spawners])

  const pickPlace = (key: string | null) => {
    setWho(null)
    setLooking(key)
  }

  const people = useMapTokens({
    world,
    use,
    places: data.places,
    player,
    editing: false,
    onSelect: (sheet) => pickWho(sheet),
    save: (next) => void engine('worlds.saveMapUse', { id: world, use: next }).catch(failed('Could not save it')),
    onWalk: nav ? (t) => nav.walkTo(t) : undefined,
    onApproach: nav ? (t, cb) => nav.smartApproach(t, cb) : undefined
  })

  const allTokens = useMemo(() => {
    const sheetSet = new Set(people.tokens.map((t) => t.visitor.sheet))
    return [...people.tokens, ...spawnerTokens.filter((st) => !sheetSet.has(st.visitor.sheet))]
  }, [people.tokens, spawnerTokens])

  const pickWho = (sheet: string) => {
    setLooking(null)
    setWho(sheet)
    const targetToken = allTokens.find((t) => t.visitor.sheet === sheet)
    if (targetToken && targetToken.visitor.sheet !== player) {
      const tree = defaultDialogueTree(targetToken.visitor.sheet, targetToken.visitor.name)
      useDialogue.getState().startDialogue(tree, targetToken.visitor.name)
    }
  }

  const ruleSet = useRuleSet()
  const triggers = useTriggerPlay({ world, map, use, uses, save, catalog, ruleSet, tokens: allTokens, onGo })
  const shown = looking && data.places[looking] ? looking : null
  const token = who ? (allTokens.find((t) => t.visitor.sheet === who) ?? null) : null
  const deck = useDeckInUse(player ? { character: player } : null)
  const where = worldWhere(at ? `@place:${at}` : null, at ? agentsOf(data.here[at] ?? []) : [], world, player)
  useEscapeLayer(shown !== null || token !== null, () => {
    pickPlace(null)
    useDialogue.getState().closeDialogue()
  })
  useEscapeLayer(aim !== null, () => setAim(null))
  const actor = allTokens.find((t) => t.visitor.sheet === (screenSheet ?? player) && t.visitor.game) ?? allTokens.find((t) => t.visitor.game) ?? allTokens.find((t) => t.visitor.sheet === (screenSheet ?? player)) ?? null
  const target = (picked: { sheet: string | null; at: { x: number; y: number }; label: string }) => {
    if (!aim || !actor) return false
    const feet = (Math.hypot(picked.at.x - actor.at.x, picked.at.y - actor.at.y) / Math.max(1, map.tile.w)) * 5
    void engine('game.useAbility', { sheet: actor.visitor.sheet, ability: aim.uid, target: picked.sheet, at: picked.at, distance: Math.round(feet) })
      .then((said) => toast.info(aim.label, said))
      .catch(failed(`Could not use ${aim.label}`))
    setAim(null)
    return true
  }

  // Fallback hotkey listener for C when character uses standard sheet rather than game defs
  useEffect(() => {
    if (catalog && allTokens.some((t) => t.visitor.game)) return
    const targetSheet = screenSheet ?? player
    if (!targetSheet) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        openEntry('sheet', targetSheet)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [catalog, allTokens, screenSheet, player])

  // Symmetric CRPG Encounter Stacks: Allies (Party) and Hostiles (Enemies)
  const partyUnits: UnitCardData[] = useMemo(() => {
    if (inCombat && battle) {
      return battle.queue
        .filter((c) => c.isPlayer)
        .map((c) => ({
          id: c.id,
          name: c.name,
          sheet: c.sheet,
          image: c.image ?? allTokens.find((t) => t.visitor.sheet === c.sheet)?.visitor.image ?? null,
          hp: c.hp,
          ac: c.ac,
          isPlayer: true,
          isActiveTurn: battle.queue[battle.activeTurnIndex]?.id === c.id,
          isSelected: who === c.id || who === c.sheet,
          faction: c.faction ?? 'PLAYER'
        }))
    }

    const partyTokens = allTokens
      .filter((t) => t.visitor.game || t.visitor.sheet === player)
      .sort((a, b) => Number(b.visitor.sheet === player) - Number(a.visitor.sheet === player))

    return partyTokens.map((t) => ({
      id: t.visitor.sheet,
      name: t.visitor.name,
      sheet: t.visitor.sheet,
      image: t.visitor.image ?? null,
      subtitle: t.visitor.line || null,
      ac: t.visitor.dnd?.ac ?? 14,
      hp: t.visitor.dnd?.hp ? { cur: t.visitor.dnd.hp.cur, max: t.visitor.dnd.hp.max } : { cur: 25, max: 25 },
      conditions: t.visitor.dnd?.conditions ?? [],
      isPlayer: t.visitor.sheet === player,
      isActiveTurn: t.visitor.sheet === player,
      isSelected: who === t.visitor.sheet,
      faction: t.visitor.faction ?? 'PARTY'
    }))
  }, [inCombat, battle, allTokens, player, who])

  const hostileUnits: UnitCardData[] = useMemo(() => {
    if (inCombat && battle) {
      return battle.queue
        .filter((c) => !c.isPlayer)
        .map((c) => ({
          id: c.id,
          name: c.name,
          sheet: c.sheet,
          image: c.image ?? allTokens.find((t) => t.visitor.sheet === c.sheet)?.visitor.image ?? null,
          hp: c.hp,
          ac: c.ac ?? 12,
          isPlayer: false,
          isActiveTurn: battle.queue[battle.activeTurnIndex]?.id === c.id,
          isSelected: who === c.id || who === c.sheet,
          faction: c.faction ?? 'HOSTILE'
        }))
    }

    if (token && token.visitor.sheet !== player) {
      return [
        {
          id: token.visitor.sheet,
          name: token.visitor.name,
          sheet: token.visitor.sheet,
          image: token.visitor.image ?? null,
          subtitle: token.visitor.line || null,
          ac: token.visitor.dnd?.ac ?? 12,
          hp: token.visitor.dnd?.hp ? { cur: token.visitor.dnd.hp.cur, max: token.visitor.dnd.hp.max } : { cur: 15, max: 15 },
          conditions: token.visitor.dnd?.conditions ?? [],
          isPlayer: false,
          isSelected: true,
          faction: token.visitor.faction ?? 'CREATURE'
        }
      ]
    }

    return []
  }, [inCombat, battle, allTokens, token, player, who])

  // Target interaction hotkeys (Esc, T, A, C, F)
  useEffect(() => {
    if (!token || token.visitor.sheet === player) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return

      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        setWho(null)
        useDialogue.getState().closeDialogue()
      } else if (k === 't') {
        e.preventDefault()
        const tree = inCombat
          ? combatParleyDialogueTree(token.visitor.sheet, token.visitor.name)
          : defaultDialogueTree(token.visitor.sheet, token.visitor.name)
        useDialogue.getState().startDialogue(tree, token.visitor.name)
      } else if (k === 'a') {
        e.preventDefault()
        if (nav) nav.walkTo(token.at)
      } else if (k === 'c') {
        e.preventDefault()
        openEntry('sheet', token.visitor.sheet)
      } else if (k === 'f') {
        e.preventDefault()
        if (inCombat) {
          attackTarget(token.visitor.sheet)
        } else {
          const playerTok = allTokens.find((tok) => tok.visitor.sheet === player)
          const playerCombatant = playerTok
            ? combatantFromVisitor(playerTok.visitor, playerTok.at, true)
            : {
                id: player ?? 'player',
                sheet: player ?? undefined,
                name: 'Player Character',
                isPlayer: true,
                hp: { cur: 12, max: 12 },
                ac: 14,
                speedMax: 30,
                at: token.at,
                attacks: [{ name: 'Strike', bonus: 4, damage: '1d8 + 2' }],
                faction: 'player'
              }
          const targetCombatant = combatantFromVisitor(token.visitor, token.at, false)
          startBattle([playerCombatant, targetCombatant])
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [token, player, nav, inCombat, attackTarget, startBattle, allTokens])

  const combinedTokenHandlers = useMemo(
    () => ({
      mine: player,
      onPick: (t: MapToken) => {
        pickWho(t.visitor.sheet)
      },
      onMenu: (t: MapToken, e: any) => {
        if (t.visitor.sheet.startsWith('spawner:')) {
          openMenu(e, t.visitor.name, [
            {
              label: 'Engage in Combat',
              icon: <Swords className="h-4 w-4 text-alert" />,
              onSelect: () => {
                const playerTok = allTokens.find((tok) => tok.visitor.sheet === player)
                const playerCombatant = playerTok
                  ? combatantFromVisitor(playerTok.visitor, playerTok.at, true)
                  : {
                      id: player ?? 'player',
                      sheet: player ?? undefined,
                      name: 'Player Character',
                      isPlayer: true,
                      hp: { cur: 12, max: 12 },
                      ac: 14,
                      speedMax: 30,
                      at: t.at,
                      attacks: [{ name: 'Strike', bonus: 4, damage: '1d8 + 2' }],
                      faction: 'player'
                    }
                const targetCombatant = combatantFromVisitor(t.visitor, t.at, false)
                startBattle([playerCombatant, targetCombatant])
              }
            },
            {
              label: `Talk to ${showName(t.visitor.name)}`,
              icon: <MessageSquarePlus className="h-4 w-4 text-cyan" />,
              onSelect: () => pickWho(t.visitor.sheet)
            },
            {
              label: 'Move towards creature',
              icon: <Footprints className="h-4 w-4" />,
              onSelect: () => {
                if (nav) nav.walkTo(t.at)
              }
            }
          ])
          return
        }
        people.handlers.onMenu?.(t, e)
      },
      onMove: people.handlers.onMove
    }),
    [player, allTokens, nav, people.handlers, startBattle]
  )

  return (
    <div className="relative min-h-0 flex-1 border border-line/40 bg-black/40">
      <PlayStage
        world={world}
        save={save}
        triggers={triggers.triggers}
        onTrigger={triggers.fire}
        onTime={setTime}
        onClock={setClock}
        map={map}
        shapes={use.shapes}
        places={data.places}
        here={data.here}
        place={`play.${world}.${map.id}`}
        tokens={allTokens}
        mine={player}
        selected={shown}
        onPlace={pickPlace}
        onBlankMenu={(e) => {
          if (aim) {
            setAim(null)
            return
          }
          openMenu(e, 'Terrain', [
            ...(shown ? [{ label: `Clear Selection (${shown})`, onSelect: () => pickPlace(null) }] : []),
            ...(who ? [{ label: 'End Conversation', onSelect: () => { setWho(null); useDialogue.getState().closeDialogue() } }] : [])
          ])
        }}
        onTarget={target}
        onCamera={setCamera}
        aiming={Boolean(aim)}
        battle={battle}
        tokenHandlers={combinedTokenHandlers}
        objects={objectHandlers(
          world,
          map.id,
          player,
          nav ? (t) => nav.walkTo(t) : undefined,
          nav ? (t, cb) => nav.smartApproach(t, cb) : undefined
        )}
        onNavigation={setNav}
        className="h-full"
      />
      
      {/* NO PLAYER BANNER - INTERACTIVE TO CHOOSE CHARACTER IMMEDIATELY */}
      {!player && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3 border border-alert bg-black/95 px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.85)]">
          <span className="font-mono text-[11px] font-bold text-alert">[ ! NO ACTIVE PLAYER CHARACTER ]</span>
          <span className="text-[12px] text-dim">Select which character you are playing as:</span>
          <Button
            size="sm"
            variant="primary"
            icon={<UserPlus className="h-3.5 w-3.5" />}
            onClick={() => setShowPickPlayer(true)}
            className="text-[11px]"
          >
            SELECT CHARACTER
          </Button>
        </div>
      )}

      {/* MODAL TO PICK ACTIVE PLAYER CHARACTER */}
      {showPickPlayer && (
        <Modal
          open={true}
          title="Select Active Player Character"
          onClose={() => setShowPickPlayer(false)}
        >
          <div className="flex flex-col gap-3 font-mono">
            <p className="text-[12px] text-dim">
              Choose a character from your library to take control of in this world:
            </p>
            <EntryPicker
              kind="sheet"
              title="Select Character"
              inline
              onClose={() => setShowPickPlayer(false)}
              onPick={async (hit) => {
                setShowPickPlayer(false)
                try {
                  await engine('worlds.setPlayer', { id: world, sheet: hit.id })
                  await bringHere(world, hit.id)
                  if (!use.stand[hit.id]) {
                    const area = mapArea(map)
                    const next = {
                      ...use,
                      stand: {
                        ...use.stand,
                        [hit.id]: {
                          at: {
                            x: Math.max(16, Math.round(area.w / 2)),
                            y: Math.max(16, Math.round(area.h / 2))
                          },
                          actions: '',
                          decisions: ''
                        }
                      }
                    }
                    await engine('worlds.saveMapUse', { id: world, use: next })
                  }
                  toast.success('Player Selected', `Now playing as ${hit.title}`)
                } catch (err) {
                  failed('Could not set player')(err)
                }
              }}
            />
          </div>
        </Modal>
      )}

      {/* 1. TACTICAL COMBAT TURN OVERLAYS (VICTORY / DEFEAT MODALS) */}
      <CombatTurnHud />

      {/* 2. DIEGETIC IN-WORLD SPEECH BUBBLES */}
      <SpeechBubbleOverlay tokens={allTokens} camera={camera} />

      {/* 3. TOP BAR CENTER: INITIATIVE RIBBON */}
      {inCombat && battle && (
        <InitiativeRibbon
          battle={battle}
          selectedCombatantId={who}
          onSelectCombatant={(id) => setWho(id)}
          onFlee={() => endBattle('flee')}
          className="absolute left-1/2 top-2.5 -translate-x-1/2 z-30"
        />
      )}

      {/* 4. CINEMATIC DM BROADCAST BANNER (BELOW TOP BAR) */}
      <AgentNarrationStream className="absolute left-1/2 top-12 -translate-x-1/2 z-20" />

      {/* 5. SYMMETRIC LEFT EDGE: ALLIED PARTY STACK */}
      <div className="pointer-events-none absolute left-3 top-12 z-20 flex flex-col items-start gap-1.5">
        <UnitCardStack
          side="left"
          title="PARTY"
          units={partyUnits}
          activeId={inCombat && battle ? battle.queue[battle.activeTurnIndex]?.id : player}
          selectedId={who}
          onSelect={pickWho}
        />
        {catalog && allTokens.some((t) => t.visitor.game) ? (
          <GameMenu open={screen} onOpen={setScreen} />
        ) : (
          (screenSheet || player) && (
            <div className="pointer-events-auto flex gap-1.5 mt-0.5">
              <button
                type="button"
                onClick={() => openEntry('sheet', (screenSheet ?? player)!)}
                className="flex items-center gap-1.5 border border-line/60 bg-black/90 px-2.5 py-1 font-mono text-[11px] font-bold text-white hover:border-accent hover:text-accent transition-colors cursor-pointer"
              >
                <span className="border border-line/60 bg-line/20 px-1 text-[9px] text-cyan">C</span>
                <span>CHARACTER SHEET</span>
              </button>
            </div>
          )
        )}
      </div>

      {/* 6. SYMMETRIC RIGHT EDGE: HOSTILE ENCOUNTER STACK */}
      {hostileUnits.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-12 z-20 flex flex-col items-end gap-1.5">
          <UnitCardStack
            side="right"
            title={inCombat ? 'HOSTILES' : 'TARGET'}
            units={hostileUnits}
            activeId={inCombat && battle ? battle.queue[battle.activeTurnIndex]?.id : null}
            selectedId={who}
            onSelect={(id) => setWho(id)}
            onClear={() => {
              setWho(null)
              useDialogue.getState().closeDialogue()
            }}
          />
          {token && token.visitor.sheet !== player && (
            <div className="pointer-events-auto flex w-60 flex-col gap-1 mt-1 font-mono">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const tree = inCombat
                      ? combatParleyDialogueTree(token.visitor.sheet, token.visitor.name)
                      : defaultDialogueTree(token.visitor.sheet, token.visitor.name)
                    useDialogue.getState().startDialogue(tree, token.visitor.name)
                  }}
                  title="Talk with entity (T)"
                  className="flex-1 flex items-center justify-center gap-1 border border-line/60 bg-black/90 py-1 text-[10px] font-bold text-dim hover:border-purple hover:text-purple transition-colors cursor-pointer"
                >
                  <span className="text-[8.5px] text-faint">[T]</span>
                  <span>TALK</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (nav) nav.walkTo(token.at)
                  }}
                  title="Approach entity (A)"
                  className="flex-1 flex items-center justify-center gap-1 border border-line/60 bg-black/90 py-1 text-[10px] font-bold text-dim hover:border-cyan hover:text-cyan transition-colors cursor-pointer"
                >
                  <span className="text-[8.5px] text-faint">[A]</span>
                  <span>APPROACH</span>
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => openEntry('sheet', token.visitor.sheet)}
                  title="Inspect sheet (C)"
                  className="flex-1 flex items-center justify-center gap-1 border border-line/60 bg-black/90 py-1 text-[10px] font-bold text-dim hover:border-accent hover:text-accent transition-colors cursor-pointer"
                >
                  <span className="text-[8.5px] text-faint">[C]</span>
                  <span>INSPECT</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (inCombat) {
                      attackTarget(token.visitor.sheet)
                    } else {
                      const playerTok = allTokens.find((t) => t.visitor.sheet === player)
                      const playerCombatant = playerTok
                        ? combatantFromVisitor(playerTok.visitor, playerTok.at, true)
                        : {
                            id: player ?? 'player',
                            sheet: player ?? undefined,
                            name: 'Player Character',
                            isPlayer: true,
                            hp: { cur: 12, max: 12 },
                            ac: 14,
                            speedMax: 30,
                            at: token.at,
                            attacks: [{ name: 'Strike', bonus: 4, damage: '1d8 + 2' }],
                            faction: 'player'
                          }
                      const targetCombatant = combatantFromVisitor(token.visitor, token.at, false)
                      startBattle([playerCombatant, targetCombatant])
                    }
                  }}
                  title={inCombat ? 'Attack target (F)' : 'Engage in combat (F)'}
                  className="flex-1 flex items-center justify-center gap-1 border border-alert/70 bg-alert/15 py-1 text-[10px] font-bold text-alert hover:border-alert hover:bg-alert hover:text-white transition-all cursor-pointer shadow-[0_0_8px_rgba(255,77,77,0.25)]"
                >
                  <span className="text-[8.5px] text-alert/70">[F]</span>
                  <span>{inCombat ? 'ATTACK' : 'ENGAGE'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. FLOATING BOTTOM-LEFT EXPANDABLE PLAYER CHAT */}
      <PlayerChatOverlay
        playerSheet={player}
        playerName={actor?.visitor.name ?? 'Alistair Finch'}
        targetSheet={token?.visitor.sheet ?? null}
        targetName={token?.visitor.name ?? null}
      />

      {/* 8. PASSIVE UNOBTRUSIVE COMBAT LOG AT BOTTOM-RIGHT */}
      <CompactCombatLog className="absolute bottom-3 right-3 z-30" />

      {/* 9. CLOCK HUD */}
      {time && <ClockHud view={time} controls={clock} offsetRight={Boolean(shown)} />}

      {/* 10. DENSE 3-ROW CRPG TACTICAL ACTION DECK AT BOTTOM-CENTER */}
      <TacticalActionDeck
        visitor={actor?.visitor ?? null}
        catalog={catalog}
        aiming={aim?.uid ?? null}
        onAim={setAim}
        selectedTargetId={who}
        onAttack={(tid, att) => attackTarget(tid, att)}
      />

      {aim && <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 border border-cyan/60 bg-black/90 px-3 py-1.5 font-mono text-[12px] text-cyan">{aim.label}: click a character, an object, or right-click a spot · Esc cancels</div>}
      {shown && <PlayCard world={world} placeKey={shown} data={data} player={player} />}
      {deck && <CardHand entries={deck.entries} buttons onPlay={(card) => playCard(card, deck.ref, where)} className="!absolute inset-x-0 bottom-0" />}
      {catalog && <GameScreens open={screen} sheet={screenSheet ?? player} tokens={allTokens} catalog={catalog} onOpen={setScreen} onSheet={setScreenSheet} onAim={setAim} />}
    </div>
  )
}

function You({
  player,
  onPick
}: {
  player: string | null
  onPick?: () => void
}) {
  const visitors = useLibraryData(() => (player ? engine('places.visitors', { sheets: [player] }) : Promise.resolve([] as PlaceVisitor[])), `you.${player}`) ?? []
  const me = visitors[0] ?? null
  const catalog = useGameCatalog()
  if (!player) {
    return (
      <Button
        size="sm"
        variant="primary"
        icon={<UserPlus className="h-3 w-3" />}
        onClick={onPick}
        className="h-6 border-alert bg-alert/20 text-alert hover:bg-alert/30 text-[10px]"
        title="Pick which character you are playing as"
      >
        [ SELECT CHARACTER TO PLAY ]
      </Button>
    )
  }
  return (
    <span
      className="flex items-center gap-2 cursor-pointer hover:opacity-90"
      onClick={() => openEntry('sheet', player)}
      title="Click to open character sheet"
    >
      <SheetPortrait image={me?.image ?? null} className="h-7 w-7 border border-accent" />
      <span className="flex flex-col">
        <span className="text-[12.5px] font-semibold text-white">{me?.name ?? player}</span>
        <span className="font-mono text-[10.5px] text-dim">{me?.line ?? 'Player Character'}</span>
      </span>
      {me?.game && catalog ? (
        <span className="w-28">
          <RecordBars record={me.game} catalog={catalog} compact />
        </span>
      ) : (
        me?.dnd && (
          <span className="w-20">
            <HpBar hp={me.dnd.hp} />
          </span>
        )
      )}
    </span>
  )
}

export function WorldPlay({ world, embedded = false }: { world: string; embedded?: boolean }) {
  const uses = useWorldMaps(world)
  const player = useWorldPlayer(world)
  const here = usePresenceData(world)
  const at = here ? (Object.entries(here).find(([, list]) => list.some((v) => v.sheet === player))?.[0] ?? null) : null
  const [picked, setPicked] = useState<string | null>(null)
  const [showTopPickModal, setShowTopPickModal] = useState(false)
  const home = uses?.find((u) => at && u.shapes[at])?.map ?? uses?.[0]?.map ?? null
  const current = uses?.find((u) => u.map === picked)?.map ?? home
  const names = useLive(() => engine('maps.list'), 'maps.changed')
  const ruleSet = useResolvedRuleSet(useLive(() => engine('worlds.list'), 'worlds.changed')?.find((w) => w.id === world)?.rules)
  if (uses && !uses.length) return <EmptyState title="Nothing to play on yet">Use a map in this world's Maps tab, draw its places, and put your character in one with Start here.</EmptyState>
  return (
    <RuleSetProvider ruleSet={ruleSet}>
      <div className={`flex min-h-0 flex-1 flex-col ${embedded ? 'h-full gap-0' : 'gap-2'}`}>
        {!embedded && (
          <div className="flex items-center gap-3">
            <You
              player={player}
              onPick={() => setShowTopPickModal(true)}
            />
            <span className="flex-1" />
            <SavePicker world={world} />
            {uses && uses.length > 1 && <ShellTabs value={current ?? ''} options={uses.map((u) => ({ value: u.map, label: names?.find((m) => m.id === u.map)?.name ?? u.map }))} onChange={setPicked} />}
          </div>
        )}
        {showTopPickModal && (
          <Modal
            open={true}
            title="Select Active Player Character"
            onClose={() => setShowTopPickModal(false)}
          >
            <div className="flex flex-col gap-3 font-mono">
              <p className="text-[12px] text-dim">
                Choose which character you want to control in this world:
              </p>
              <EntryPicker
                kind="sheet"
                title="Select Character"
                inline
                onClose={() => setShowTopPickModal(false)}
                onPick={async (hit) => {
                  setShowTopPickModal(false)
                  try {
                    await engine('worlds.setPlayer', { id: world, sheet: hit.id })
                    await bringHere(world, hit.id)
                    const targetUse = uses?.find((u) => u.map === current) ?? uses?.[0]
                    if (targetUse && !targetUse.stand[hit.id]) {
                      const stand = {
                        ...targetUse.stand,
                        [hit.id]: { at: { x: 400, y: 300 }, actions: '', decisions: '' }
                      }
                      await engine('worlds.saveMapUse', { id: world, use: { ...targetUse, stand } })
                    }
                    toast.success('Player Selected', `Now playing as ${hit.title}`)
                  } catch (err) {
                    failed('Could not set player')(err)
                  }
                }}
              />
            </div>
          </Modal>
        )}
        {current && here && (
          <WorldMapLoad key={current} world={world} mapId={current}>
            {(map, use, data) => <PlayMap world={world} map={map} use={use} uses={uses ?? []} data={data} player={player} at={at} onGo={setPicked} />}
          </WorldMapLoad>
        )}
        {!embedded && player && <JourneyStrip world={world} sheet={player} />}
      </div>
    </RuleSetProvider>
  )
}
