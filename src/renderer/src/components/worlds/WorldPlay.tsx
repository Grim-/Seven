import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { placePath, type MapData, type PlaceVisitor, type WorldMapUse } from '@shared/maps'
import { ActionBar, EmptyState, Eyebrow, ShellTabs, openMenu } from '../ui'
import { Markdown } from '../chat/Markdown'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { startChatItems } from '../../views/data/entryMenu'
import { useEscapeLayer } from '../../lib/escape'
import { MapCanvas } from '../maps/MapCanvas'
import { CharacterRow } from '../maps/CharacterRow'
import { SheetPortrait } from '../data/SheetPortrait'
import { HpBar } from '../maps/HpBar'
import { placeName } from '../maps/placeShapes'
import { useWorldMaps } from '../maps/useMap'
import { usePresenceData } from '../maps/usePresence'
import { WorldMapLoad } from '../maps/WorldMapView'
import { objectHandlers } from '../maps/objectActions'
import { useMapTokens } from '../maps/useMapTokens'
import { JourneyStrip } from './Journey'
import { failed } from '../../lib/notify'
import type { PlaceData } from '../maps/usePlaceRecords'
import { PlayList } from '../play/PlayList'
import { placePlay } from '../play/playHolder'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { sceneLink, worldWhere } from '../play/playStore'
import { CardHand } from '../cards/CardHand'
import { playCard } from '../cards/playCard'
import { useDeckInUse } from '../cards/useDeckInUse'

const agentsOf = (here: PlaceVisitor[]) => here.flatMap((v) => (v.agent ? [v.agent] : []))

function PlayCard({ world, placeKey, data, player }: { world: string; placeKey: string; data: PlaceData; player: string | null }) {
  const { places, here } = data
  const place = places[placeKey] ?? {}
  const now = typeof place.Now === 'string' ? place.Now : ''
  const there = here[placeKey] ?? []
  return (
    <div className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-24px)] w-[340px] flex-col border border-line/70 bg-black/95 shadow-[-12px_0_24px_rgba(0,0,0,0.5)]">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
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
      </div>
      <ActionBar items={[{ label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(sceneLink(`@place:${placeKey}`, player) ?? '', agentsOf(there)) }]} className="shrink-0 grid-cols-1 border-t border-line/40 p-2.5" />
    </div>
  )
}

function PlayMap({ world, map, use, data, player, at }: { world: string; map: MapData; use: WorldMapUse; data: PlaceData; player: string | null; at: string | null }) {
  const [looking, setLooking] = useState<string | null>(at)
  const people = useMapTokens({ world, use, places: data.places, player, editing: false, save: (next) => void engine('worlds.saveMapUse', { id: world, use: next }).catch(failed('Could not save it')) })
  const shown = looking && data.places[looking] ? looking : null
  const deck = useDeckInUse(player ? { character: player } : null)
  const where = worldWhere(at ? `@place:${at}` : null, at ? agentsOf(data.here[at] ?? []) : [], world, player)
  useEscapeLayer(shown !== null, () => setLooking(null))
  return (
    <div className="relative min-h-0 flex-1 border border-line/40 bg-black/40">
      <MapCanvas map={map} shapes={use.shapes} places={data.places} here={data.here} place={`play.${world}.${map.id}`} selected={shown} onPick={(s) => setLooking(s.id)} onBlank={() => setLooking(null)} onBlankMenu={(e, point) => openMenu(e, map.name, [people.putHere(point)])} objects={objectHandlers(world, map.id, player)} tokens={people.tokens} onToken={people.handlers} className="h-full" />
      {shown && <PlayCard world={world} placeKey={shown} data={data} player={player} />}
      {deck && <CardHand entries={deck.entries} buttons onPlay={(card) => playCard(card, deck.ref, where)} className="!absolute inset-x-0 bottom-0" />}
    </div>
  )
}

function You({ player, here }: { player: string | null; here: Record<string, PlaceVisitor[]> }) {
  const me = Object.values(here).flat().find((v) => v.sheet === player)
  if (!player) return <span className="font-mono text-[11px] text-faint">Pick your character to play</span>
  if (!me) return <span className="font-mono text-[11px] text-faint">Your character isn't anywhere yet. Use Start here on a place in Maps.</span>
  return (
    <span className="flex items-center gap-2">
      <SheetPortrait image={me.image} className="h-7 w-7" />
      <span className="flex flex-col">
        <span className="text-[12.5px] font-semibold text-white">{me.name}</span>
        <span className="font-mono text-[10.5px] text-dim">{me.line}</span>
      </span>
      {me.dnd && (
        <span className="w-20">
          <HpBar hp={me.dnd.hp} />
        </span>
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
  if (uses && !uses.length) return <EmptyState title="Nothing to play on yet">Use a map in this world's Maps tab, draw its places, and put your character in one with Start here.</EmptyState>
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-3">
        <You player={player} here={here ?? {}} />
        <span className="flex-1" />
        {uses && uses.length > 1 && <ShellTabs value={current ?? ''} options={uses.map((u) => ({ value: u.map, label: names?.find((m) => m.id === u.map)?.name ?? u.map }))} onChange={setPicked} />}
      </div>
      {current && here && (
        <WorldMapLoad key={current} world={world} mapId={current}>
          {(map, use, data) => <PlayMap world={world} map={map} use={use} data={data} player={player} at={at} />}
        </WorldMapLoad>
      )}
      {player && <JourneyStrip world={world} sheet={player} />}
    </div>
  )
}
