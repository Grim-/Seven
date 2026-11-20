import { useState, useEffect, useMemo, useRef } from 'react'
import { Flame, Footprints, MessageSquarePlus, Swords, UserPlus } from 'lucide-react'
import { usableAbilities } from '@shared/game/components'
import { GameEntity } from '@shared/game/core'
import { mapArea, mapInPlay, placePath, type MapData, type PlaceVisitor, type WorldMapUse } from '@shared/maps'
import { showName } from '@shared/ids'
import { placedKey } from '@shared/effects'
import type { MapToken } from '../maps/TokenLayer'
import type { EffectTargetRef } from '@shared/effects'
import { ActionBar, Button, EmptyState, Eyebrow, Modal, Popover, ShellTabs, openMenu, type MenuItem } from '../ui'
import { SlateContainer } from '../entries/EntrySlate'
import { Markdown } from '../chat/Markdown'
import { EntryPicker } from '../library/EntryPicker'
import { bringHere } from '../play/bringHere'
import { engine } from '../../lib/ipc'
import { useLive, useLibraryData } from '../../lib/useLive'
import { useKindEntries } from '../../views/data/useKindEntries'
import { openEntry } from '../../lib/library'
import { startChatItems } from '../../views/data/entryMenu'
import { useEscapeLayer } from '../../lib/escape'
import { PlayStage, type ClockControls, type StageNavigation } from './PlayStage'
import type { ClockView } from '../../game/explore/WorldClock'
import type { View } from '../../game/engine/Camera'
import { GameScreens } from '../play/screens'
import { CombatTurnHud } from '../play/hud'
import { usePlayScene } from '../play/scenes/sceneStore'
import type { PlayAim, PlayHud } from '../play/scenes/PlayScene'
import { useLatest } from '../../game/react/useLatest'
import { SavePicker } from '../play/SavePicker'
import { entryMenuAt } from '../../views/data/entryMenu'
import { useCurrentSave } from '../play/useSaves'
import { useTriggerPlay } from '../play/triggers/useTriggerPlay'
import { isTypingTarget, matchesKeybind } from '../../store/keybinds'
import { useGameplaySettings } from '../play/settings/gameplaySettingsStore'
import '../play/triggers'
import { useWorldViewHost } from '../play/viewActs'
import { CharacterRow } from '../maps/CharacterRow'
import { SheetPortrait } from '../data/SheetPortrait'
import { HpBar } from '../maps/HpBar'
import { RecordBars } from '../game/ResourceBars'
import { useGameCatalog } from '../game/useGameCatalog'
import { placeName } from '../maps/placeShapes'
import { useWorldMaps } from '../maps/useMap'
import { usePresenceData } from '../maps/usePresence'
import { WorldMapLoad } from '../maps/WorldMapView'
import { objectHandlers } from '../maps/objectActions'
import { useMapTokens } from '../maps/useMapTokens'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import type { PlaceData } from '../maps/usePlaceRecords'
import { PlayList } from '../play/PlayList'
import { placePlay } from '../play/playHolder'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { sceneLink, worldWhere } from '../play/playStore'
import { CardHand } from '../cards/CardHand'
import { playCard } from '../cards/playCard'
import { cardForms } from '../cards/cardForms'
import { useDeckInUse } from '../cards/useDeckInUse'
import { defaultDialogueTree } from '@shared/game/dialogue'
import { useDialogue } from '../play/dialogue/dialogueStore'
import { useGameState } from '../play/state/gameStateStore'

const agentsOf = (here: PlaceVisitor[]) => here.flatMap((v) => (v.agent ? [v.agent] : []))

function PlayCard({ world, placeKey, data, player, onClose }: { world: string; placeKey: string; data: PlaceData; player: string | null; onClose: () => void }) {
  const [expanded, setExpanded] = useState(true)
  const { places, here } = data
  const place = places[placeKey] ?? {}
  const now = typeof place.Now === 'string' ? place.Now : ''
  const there = here[placeKey] ?? []
  const breadcrumb = placePath(places, placeKey).map((k) => placeName(places, k)).join(' › ')
  const actions: MenuItem[] = [{ label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(sceneLink(`@place:${placeKey}`, player) ?? '', agentsOf(there)) }]
  return (
    <SlateContainer
      title={placeName(places, placeKey)}
      tag="PLACE"
      subtitle={breadcrumb}
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      onRemove={onClose}
      className="pointer-events-auto absolute right-3 top-3 z-20 flex max-h-[calc(100%-24px)] w-[340px] flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
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
      </div>
      <ActionBar items={actions} className="shrink-0 border-t border-line/40 p-2.5" />
    </SlateContainer>
  )
}

function PlayMap({ world, map, use, uses, data, player, at, onGo, embedded = false }: { world: string; map: MapData; use: WorldMapUse; uses: WorldMapUse[]; data: PlaceData; player: string | null; at: string | null; onGo: (map: string) => void; embedded?: boolean }) {
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
  const flagState = JSON.stringify([save?.flags ?? {}, save?.thingFlags ?? {}])
  const shownMap = useMemo(() => mapInPlay(map, use, save?.flags ?? {}, (id) => save?.thingFlags[placedKey({ map: map.id, id })] ?? {}), [map, use.layerGating, use.propGating, flagState])

  const timeDef = catalog ? (catalog.time(save?.clockId ?? '') ?? catalog.times()[0] ?? null) : null
  const roundSeconds = timeDef?.roundSeconds ?? 0
  const tileFeet = timeDef?.tileFeet ?? 5
  const battle = useGameState((s) => s.battle)
  const sheets = useKindEntries('sheet')

  // Auto-place player character at map center if not yet positioned on this map
  useEffect(() => {
    if (!player || !world || !map || !sheets) return
    if (!sheets.some((s) => s.id === player)) return
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
  }, [player, world, map, use, sheets])

  // Wake real creature spawners for this map & save on enter
  useEffect(() => {
    if (!world || !map.id || !save?.id) return
    void engine('worlds.wakeSpawners', { world, map: map.id, entering: true }).catch(failed('Could not wake map spawners'))
  }, [world, map.id, save?.id])

  const pickPlace = (key: string | null) => {
    setWho(null)
    setLooking(key)
  }

  const pickWhoRef = useRef<(id: string) => void>(() => undefined)

  const people = useMapTokens({
    world,
    use,
    places: data.places,
    player,
    editing: false,
    onSelect: (sheet) => pickWhoRef.current(sheet),
    save: (next) => void engine('worlds.saveMapUse', { id: world, use: next }).catch(failed('Could not save it')),
    onWalk: nav ? (t) => nav.walkTo(t) : undefined,
    onApproach: nav ? (t, cb) => nav.smartApproach(t, cb) : undefined
  })

  const allTokens = people.tokens
  const latestTokens = useLatest(allTokens)
  const tokensSig = allTokens
    .map((t) => `${t.visitor.sheet}:${t.visitor.token}:${t.at.x},${t.at.y}:${t.visitor.hp?.cur ?? ''}/${t.visitor.hp?.max ?? ''}:${JSON.stringify(t.visitor.game ?? null)}`)
    .join('|')
  const activeParticipant = battle?.status === 'active' ? (battle.queue[battle.activeTurnIndex] ?? null) : null
  const isMyTurn = !battle || battle.status !== 'active' || Boolean(activeParticipant?.isPlayer)

  useEffect(() => {
    useGameState.getState().syncFromSave({
      world,
      map: map.id,
      tileWidth: map.tile.w,
      tileFeet,
      record: save?.battle ?? null,
      tokens: latestTokens.current,
      tokensSig,
      catalog,
      timeDef
    })
  }, [world, map.id, map.tile.w, tileFeet, save?.battle, tokensSig, catalog, timeDef, latestTokens])

  // Clear active targeting if combat turn passes away from the party
  useEffect(() => {
    if (!isMyTurn && aim) setAim(null)
  }, [isMyTurn, activeParticipant?.id])

  const combatActor =
    battle?.status === 'active' && activeParticipant?.isPlayer
      ? allTokens.find((t) => (activeParticipant.sheet && t.visitor.sheet === activeParticipant.sheet) || t.visitor.token === activeParticipant.id) ?? null
      : null

  const actor =
    combatActor ??
    allTokens.find((t) => t.visitor.sheet === (screenSheet ?? player) && t.visitor.game) ??
    allTokens.find((t) => t.visitor.source !== 'creature' && t.visitor.game) ??
    allTokens.find((t) => t.visitor.sheet === (screenSheet ?? player)) ??
    null

  const aimRange = useMemo(() => {
    if (!aim || !actor?.visitor.game || !catalog) return 0
    const found = usableAbilities(GameEntity.fromRecord(actor.visitor.game, catalog)).find((a) => a.uid === aim.uid || a.id === aim.uid)
    return found ? found.reach() : 0
  }, [aim, actor?.visitor.game, catalog])

  const refOf = (picked: { sheet: string | null; token?: string }): EffectTargetRef | null =>
    picked.sheet ? { sheet: picked.sheet } : picked.token ? { creature: picked.token } : null
  const castAt = (aimed: PlayAim, user: MapToken, picked: { sheet: string | null; token?: string; at: { x: number; y: number }; label: string }) => {
    if (!user.visitor.sheet) return
    if (
      battle?.status === 'active' &&
      (!isMyTurn || (activeParticipant && activeParticipant.sheet !== user.visitor.sheet && activeParticipant.id !== user.visitor.token))
    ) {
      toast.info('Combat Turn', 'Wait for your turn before casting.')
      return
    }
    const feet = (Math.hypot(picked.at.x - user.at.x, picked.at.y - user.at.y) / Math.max(1, map.tile.w)) * tileFeet
    void engine('game.useAbility', { sheet: user.visitor.sheet, ability: aimed.uid, target: refOf(picked), world, at: picked.at, distance: Math.round(feet) })
      .then((said) => toast.info(aimed.label, said))
      .catch(failed(`Could not use ${aimed.label}`))
  }

  const isSelfToken = (t: MapToken | undefined | null) => Boolean(player && t && t.visitor.sheet === player)

  const pickWho = (id: string) => {
    const picked = allTokens.find((t) => t.visitor.token === id || t.visitor.sheet === id)
    if (aim && actor && picked) {
      castAt(aim, actor, { sheet: picked.visitor.sheet, token: picked.visitor.token, at: picked.at, label: picked.visitor.name })
      setAim(null)
      return
    }
    // Never select the player's own character as an interaction/combat target
    if ((player && id === player) || isSelfToken(picked)) {
      if (who !== null) {
        setWho(null)
        useDialogue.getState().closeDialogue()
      }
      return
    }
    // Clicking the already-selected target unselects it
    const alreadySelected =
      who !== null &&
      (who === id || (picked ? who === picked.visitor.token || (Boolean(picked.visitor.sheet) && who === picked.visitor.sheet) : false))
    if (alreadySelected) {
      setWho(null)
      useDialogue.getState().closeDialogue()
      return
    }
    setLooking(null)
    setWho(id)
    if (picked && picked.visitor.sheet && picked.visitor.sheet !== player && (!battle || battle.status !== 'active')) {
      const tree = defaultDialogueTree(picked.visitor.sheet, picked.visitor.name)
      useDialogue.getState().startDialogue(tree, picked.visitor.name)
    }
  }
  pickWhoRef.current = pickWho

  const triggers = useTriggerPlay({ world, map, use, uses, save, catalog, tokens: allTokens, onGo })
  useWorldViewHost({ world, map, save, catalog, tokens: allTokens, goTo: triggers.goTo, stand: triggers.stand })
  const shown = looking && data.places[looking] ? looking : null
  const token =
    who && who !== player
      ? (allTokens.find((t) => (t.visitor.token === who || t.visitor.sheet === who) && t.visitor.sheet !== player) ?? null)
      : null
  const deck = useDeckInUse(player ? { character: player } : null)
  const where = worldWhere(at ? `@place:${at}` : null, at ? agentsOf(data.here[at] ?? []) : [], world, player)
  useEscapeLayer(shown !== null || token !== null, () => {
    pickPlace(null)
    useDialogue.getState().closeDialogue()
  })
  useEscapeLayer(aim !== null, () => setAim(null))
  const target = (picked: { sheet: string | null; token?: string; at: { x: number; y: number }; label: string }) => {
    if (!aim || !actor) return false
    castAt(aim, actor, picked)
    setAim(null)
    return true
  }
  const aimAbility = (aimed: PlayAim | null) => {
    if (aimed && actor && token && (token.visitor.token || token.visitor.sheet) !== (actor.visitor.token || actor.visitor.sheet)) {
      return castAt(aimed, actor, { sheet: token.visitor.sheet, token: token.visitor.token, at: token.at, label: token.visitor.name })
    }
    setAim(aimed)
  }

  // Fallback hotkey listener for character sheet when character uses standard sheet rather than game defs
  useEffect(() => {
    if (catalog && allTokens.some((t) => t.visitor.game)) return
    const targetSheet = screenSheet ?? player
    if (!targetSheet) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      const sheetCode = useGameplaySettings.getState().settings.keybinds.sheet?.code ?? 'KeyC'
      if (e.code === sheetCode) {
        e.preventDefault()
        openEntry('sheet', targetSheet)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [catalog, allTokens, screenSheet, player])

  const scene = usePlayScene((s) => s.scene)
  const hud: PlayHud = {
    world,
    saveId: save?.id ?? null,
    mapId: map.id,
    embedded,
    tokens: allTokens,
    camera,
    player,
    partyIds: save?.party?.length ? save.party : (player ? [player] : []),
    who,
    setWho,
    pickWho,
    target: token,
    actor,
    catalog,
    screen,
    setScreen,
    screenSheet,
    nav,
    time,
    clock,
    aim,
    setAim: aimAbility,
    roundSeconds,
    placeKey: shown ?? at,
    placeName: (shown ?? at) ? placeName(data.places, (shown ?? at)!) : null,
    placeCard: shown ? <PlayCard world={world} placeKey={shown} data={data} player={player} onClose={() => pickPlace(null)} /> : null,
    cardHand: deck ? <CardHand entries={deck.entries} buttons formsFor={(card) => cardForms(card, where)} onPlay={(card, form) => void playCard(card, deck.ref, where, form)} className="!absolute inset-x-0 bottom-0" /> : null
  }
  const latestHud = useLatest(hud)

  // Target interaction hotkeys
  useEffect(() => {
    if (!token || token.visitor.sheet === player) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || isTypingTarget(e)) return

      const cancelCode = useGameplaySettings.getState().settings.keybinds.cancel?.code ?? 'Escape'
      const sheetCode = useGameplaySettings.getState().settings.keybinds.sheet?.code ?? 'KeyC'
      if (e.code === cancelCode && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setWho(null)
        useDialogue.getState().closeDialogue()
      } else if (matchesKeybind('tactical.targetTalk', e)) {
        e.preventDefault()
        scene.talk(token)
      } else if (matchesKeybind('tactical.targetApproach', e)) {
        e.preventDefault()
        if (nav) nav.smartApproach(token.at, () => undefined)
      } else if (e.code === sheetCode && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        openEntry('sheet', token.visitor.sheet)
      } else if (matchesKeybind('tactical.targetAttack', e)) {
        e.preventDefault()
        scene.act(token, latestHud.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [token, player, nav, scene])

  const combinedTokenHandlers = useMemo(
    () => ({
      mine: player,
      onPick: (t: MapToken) => {
        pickWhoRef.current(t.visitor.token)
      },
      onMenu: (t: MapToken, e: any) => {
        if (t.visitor.sheet.startsWith('spawner:')) {
          openMenu(e, t.visitor.name, [
            {
              label: 'Engage in Combat',
              icon: <Swords className="h-4 w-4 text-alert" />,
              onSelect: () => scene.act(t, latestHud.current)
            },
            {
              label: `Talk to ${showName(t.visitor.name)}`,
              icon: <MessageSquarePlus className="h-4 w-4 text-cyan" />,
              onSelect: () => pickWhoRef.current(t.visitor.token)
            },
            {
              label: 'Move towards creature',
              icon: <Footprints className="h-4 w-4" />,
              onSelect: () => {
                if (nav) nav.smartApproach(t.at, () => undefined)
              }
            }
          ])
          return
        }
        people.handlers.onMenu?.(t, e)
      },
      onMove: people.handlers.onMove
    }),
    [player, allTokens, nav, people.handlers, scene, pickWhoRef]
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
        onWalked={(sheet, feet) => {
          scene.walked(latestHud.current, sheet, feet)
          void engine('worlds.wakeSpawners', { world, map: map.id, entering: false }).catch(failed('Could not wake proximity spawners'))
        }}
        onBattleMove={(at) => void useGameState.getState().moveActor(at)}
        map={shownMap}
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
        aimRange={aimRange}
        activeActorId={actor?.visitor.token || actor?.visitor.sheet || null}
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

      <scene.Screen hud={hud} />
      {catalog && <GameScreens open={screen} sheet={screenSheet ?? player} partyIds={hud.partyIds} tokens={allTokens} catalog={catalog} onOpen={setScreen} onSheet={setScreenSheet} onAim={aimAbility} />}
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
  const worldEventsList = useLive(() => engine('worldEvents.list', { worldId: world }), 'worldEvents.changed') ?? []
  const activeEventCount = worldEventsList.filter((e) => e.status === 'active').length
  const home = uses?.find((u) => at && u.shapes[at])?.map ?? uses?.[0]?.map ?? null
  const current = uses?.find((u) => u.map === picked)?.map ?? home
  const names = useLive(() => engine('maps.list'), 'maps.changed')
  if (uses && !uses.length) return <EmptyState title="Nothing to play on yet">Use a map in this world's Maps tab, draw its places, and put your character in one with Start here.</EmptyState>
  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${embedded ? 'h-full gap-0' : 'gap-2'}`}>
        {!embedded && (
          <div className="flex items-center gap-3">
            <You
              player={player}
              onPick={() => setShowTopPickModal(true)}
            />
            <span className="flex-1" />
            <Popover
              align="end"
              trigger={
                <span className="inline-flex h-6 cursor-pointer items-center gap-1.5 border border-line/70 bg-black/80 px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-dim hover:border-accent hover:text-white">
                  <Flame className={activeEventCount > 0 ? 'h-3 w-3 text-accent animate-pulse' : 'h-3 w-3'} />
                  <span>Events{activeEventCount > 0 ? ` (${activeEventCount})` : ''}</span>
                </span>
              }
              className="w-72 p-2 font-mono text-[11px]"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between border-b border-line/50 pb-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-accent">World Events</span>
                  <button
                    type="button"
                    onClick={() => openEntry('world_event', '__new')}
                    className="border border-line/60 px-1.5 py-0.5 text-[9px] uppercase text-cyan hover:border-cyan cursor-pointer"
                  >
                    + New
                  </button>
                </div>
                {worldEventsList.length === 0 ? (
                  <span className="py-2 text-center text-[10px] text-faint">No world events yet.</span>
                ) : (
                  worldEventsList.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => openEntry('world_event', ev.id)}
                      onContextMenu={(e) => entryMenuAt(e, 'world_event', ev.id, ev.title, [])}
                      className="flex w-full items-center justify-between gap-2 border border-line/40 bg-black/60 px-2 py-1.5 text-left hover:border-accent hover:text-white cursor-pointer"
                    >
                      <span className="truncate text-white">{ev.title}</span>
                      <span className="shrink-0 text-[8.5px] uppercase text-dim">{ev.status}</span>
                    </button>
                  ))
                )}
              </div>
            </Popover>
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
            {(map, use, data) => <PlayMap world={world} map={map} use={use} uses={uses ?? []} data={data} player={player} at={at} onGo={setPicked} embedded={embedded} />}
          </WorldMapLoad>
        )}
    </div>
  )
}
