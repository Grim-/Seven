import { useState, useEffect, type ReactNode } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { placePath, type MapData, type PlaceVisitor, type WorldMapUse } from '@shared/maps'
import { ActionBar, EmptyState, Eyebrow, ShellTabs, openMenu, type MenuItem } from '../ui'
import { Markdown } from '../chat/Markdown'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { openEntry } from '../../lib/library'
import { startChatItems } from '../../views/data/entryMenu'
import { useEscapeLayer } from '../../lib/escape'
import { PlayStage, type ClockControls } from './PlayStage'
import type { ClockView } from '../../game/explore/WorldClock'
import { ClockHud } from '../play/hud/ClockHud'
import { PartyHud } from '../play/hud/PartyHud'
import { GameMenu, GameScreens } from '../play/screens'
import { ActionBarHud } from '../play/hud/ActionBarHud'
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
  const [screen, setScreen] = useState<string | null>(null)
  const [screenSheet, setScreenSheet] = useState<string | null>(null)
  const [aim, setAim] = useState<{ uid: string; label: string } | null>(null)
  const catalog = useGameCatalog()
  const save = useCurrentSave(world)
  const pickPlace = (key: string | null) => {
    setWho(null)
    setLooking(key)
  }
  const pickWho = (sheet: string) => {
    setLooking(null)
    setWho(sheet)
  }
  const people = useMapTokens({ world, use, places: data.places, player, editing: false, onSelect: pickWho, save: (next) => void engine('worlds.saveMapUse', { id: world, use: next }).catch(failed('Could not save it')) })
  const ruleSet = useRuleSet()
  const triggers = useTriggerPlay({ world, map, use, uses, save, catalog, ruleSet, tokens: people.tokens, onGo })
  const shown = looking && data.places[looking] ? looking : null
  const token = who ? (people.tokens.find((t) => t.visitor.sheet === who) ?? null) : null
  const deck = useDeckInUse(player ? { character: player } : null)
  const where = worldWhere(at ? `@place:${at}` : null, at ? agentsOf(data.here[at] ?? []) : [], world, player)
  useEscapeLayer(shown !== null || token !== null, () => pickPlace(null))
  useEscapeLayer(aim !== null, () => setAim(null))
  const actor = people.tokens.find((t) => t.visitor.sheet === (screenSheet ?? player) && t.visitor.game) ?? people.tokens.find((t) => t.visitor.game) ?? null
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
    if (catalog && people.tokens.some((t) => t.visitor.game)) return
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
  }, [catalog, people.tokens, screenSheet, player])

  return (
    <div className="relative min-h-0 flex-1 border border-line/40 bg-black/40">
      <PlayStage world={world} save={save} triggers={triggers.triggers} onTrigger={triggers.fire} onTime={setTime} onClock={setClock} map={map} shapes={use.shapes} places={data.places} here={data.here} place={`play.${world}.${map.id}`} tokens={people.tokens} mine={player} selected={shown} onPlace={pickPlace} onBlankMenu={(e, point) => openMenu(e, map.name, [people.putHere(point), ...triggers.menuItems(point)])} onTarget={target} tokenHandlers={people.handlers} objects={objectHandlers(world, map.id, player)} className="h-full" />
      
      {/* NO PLAYER BANNER */}
      {!player && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 border border-alert bg-black/95 px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)]">
          <span className="font-mono text-[11px] font-bold text-alert">[ ! NO ACTIVE PLAYER CHARACTER ]</span>
          <span className="text-[12px] text-white">Right-click any character on the map to &ldquo;Take Control&rdquo;, or select one in the World header</span>
        </div>
      )}

      {/* TACTICAL HUD */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-2">
        {catalog && <PartyHud tokens={people.tokens} player={player} catalog={catalog} onPick={pickWho} />}
        {catalog && people.tokens.some((t) => t.visitor.game) ? (
          <GameMenu open={screen} onOpen={setScreen} />
        ) : (
          (screenSheet || player) && (
            <div className="pointer-events-auto flex gap-1.5">
              <button
                type="button"
                onClick={() => openEntry('sheet', (screenSheet ?? player)!)}
                className="flex items-center gap-1.5 border border-line/60 bg-black/90 px-2.5 py-1 font-mono text-[11px] font-bold text-white hover:border-accent hover:text-accent"
              >
                <span className="border border-line/60 bg-line/20 px-1 text-[9px] text-cyan">C</span>
                <span>CHARACTER SHEET</span>
              </button>
            </div>
          )
        )}
      </div>

      {time && <ClockHud view={time} controls={clock} />}
      <ActionBarHud visitor={actor?.visitor ?? null} catalog={catalog} aiming={aim?.uid ?? null} onAim={setAim} />
      {aim && <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 border border-cyan/60 bg-black/90 px-3 py-1.5 font-mono text-[12px] text-cyan">{aim.label}: click a character, an object, or right-click a spot · Esc cancels</div>}
      {shown && <PlayCard world={world} placeKey={shown} data={data} player={player} />}
      {token && (
        <PlayPanel actions={people.items(token)}>
          <CharacterRow visitor={token.visitor} />
          <PlayList play={people.holder(token.visitor)} />
        </PlayPanel>
      )}
      {deck && <CardHand entries={deck.entries} buttons onPlay={(card) => playCard(card, deck.ref, where)} className="!absolute inset-x-0 bottom-0" />}
      {catalog && <GameScreens open={screen} sheet={screenSheet ?? player} tokens={people.tokens} catalog={catalog} onOpen={setScreen} onSheet={setScreenSheet} onAim={setAim} />}
    </div>
  )
}

function You({ player, here }: { player: string | null; here: Record<string, PlaceVisitor[]> }) {
  const me = Object.values(here).flat().find((v) => v.sheet === player)
  const catalog = useGameCatalog()
  if (!player) return <span className="font-mono text-[11px] text-alert font-bold">[ NO PLAYER ASSIGNED ]</span>
  if (!me) return <span className="font-mono text-[11px] text-faint">Your character isn't anywhere yet. Use Start here on a place in Maps.</span>
  return (
    <span
      className="flex items-center gap-2 cursor-pointer hover:opacity-90"
      onClick={() => openEntry('sheet', player)}
      title="Click to open character sheet"
    >
      <SheetPortrait image={me.image} className="h-7 w-7 border border-accent" />
      <span className="flex flex-col">
        <span className="text-[12.5px] font-semibold text-white">{me.name}</span>
        <span className="font-mono text-[10.5px] text-dim">{me.line}</span>
      </span>
      {me.game && catalog ? (
        <span className="w-28">
          <RecordBars record={me.game} catalog={catalog} compact />
        </span>
      ) : (
        me.dnd && (
          <span className="w-20">
            <HpBar hp={me.dnd.hp} />
          </span>
        )
      )}
    </span>
  )
}

export function WorldPlay({ world }: { world: string }) {
  const uses = useWorldMaps(world)
  const player = useWorldPlayer(world)
  const here = usePresenceData(world)
  const at = here ? (Object.entries(here).find(([, list]) => list.some((v) => v.sheet === player))?.[0] ?? null) : null
  const [picked, setPicked] = useState<string | null>(null)
  const home = uses?.find((u) => at && u.shapes[at])?.map ?? uses?.[0]?.map ?? null
  const current = uses?.find((u) => u.map === picked)?.map ?? home
  const names = useLive(() => engine('maps.list'), 'maps.changed')
  const ruleSet = useResolvedRuleSet(useLive(() => engine('worlds.list'), 'worlds.changed')?.find((w) => w.id === world)?.rules)
  if (uses && !uses.length) return <EmptyState title="Nothing to play on yet">Use a map in this world's Maps tab, draw its places, and put your character in one with Start here.</EmptyState>
  return (
    <RuleSetProvider ruleSet={ruleSet}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-3">
          <You player={player} here={here ?? {}} />
          <span className="flex-1" />
          <SavePicker world={world} />
          {uses && uses.length > 1 && <ShellTabs value={current ?? ''} options={uses.map((u) => ({ value: u.map, label: names?.find((m) => m.id === u.map)?.name ?? u.map }))} onChange={setPicked} />}
        </div>
        {current && here && (
          <WorldMapLoad key={current} world={world} mapId={current}>
            {(map, use, data) => <PlayMap world={world} map={map} use={use} uses={uses ?? []} data={data} player={player} at={at} onGo={setPicked} />}
          </WorldMapLoad>
        )}
        {player && <JourneyStrip world={world} sheet={player} />}
      </div>
    </RuleSetProvider>
  )
}
