import { Footprints, LogOut, UserPlus, Skull } from 'lucide-react'
import type { PlaceVisitor, Standing, TokenVisitor, WorldMapUse } from '@shared/maps'
import type { Point } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'
import { showName } from '@shared/ids'
import { openMenu, type MenuEvent, type MenuItem } from '../ui'
import { SpawnTokenModal, type SpawnTab } from './SpawnTokenModal'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLibraryData } from '../../lib/useLive'
import { closePlay, showPlay, worldWhere } from '../play/playStore'
import type { PlayHolder } from '../play/playHolder'
import { tokenSourceUi, type TokenContext } from '../../registries/tokenSources'
import { syncTokenLocation } from './placeActions'
import { bringHere } from '../play/bringHere'
import type { MapToken, TokenHandlers } from './TokenLayer'

interface Options {
  world: string
  use: WorldMapUse
  places: Record<string, WorldEntity>
  player: string | null
  editing: boolean
  save: (use: WorldMapUse) => void
  onSelect?: (sheet: string) => void
  onWalk?: (target: Point) => void
  onApproach?: (target: Point, onReach: () => void) => void
}

const NONE: Standing = { at: { x: 0, y: 0 }, actions: '', decisions: '' }

export function useMapTokens({ world, use, places, player, editing, save, onSelect, onWalk, onApproach }: Options) {
  const ids = Object.keys(use.stand)
  const visitors = useLibraryData(() => (ids.length ? engine('places.tokens', { world, tokens: ids }) : Promise.resolve([] as TokenVisitor[])), `tokens.${ids.join(',')}`) ?? []
  const tokens: MapToken[] = visitors.filter((visitor) => visitor.token in use.stand).map((visitor) => ({ visitor, at: use.stand[visitor.token].at }))
  const setStanding = (token: string, next: Standing | null) => {
    const { [token]: _old, ...rest } = use.stand
    save({ ...use, stand: next ? { ...rest, [token]: next } : rest })
  }
  const settle = (sheet: string, at: Point) => {
    void syncTokenLocation(sheet, world, use, at).catch(failed('Could not update character location'))
  }
  const holder = (v: PlaceVisitor): PlayHolder => {
    const standing = use.stand[v.sheet] ?? NONE
    return {
      texts: { action: standing.actions, decision: standing.decisions },
      save: async (kind, text) => setStanding(v.sheet, { ...standing, ...(kind === 'action' ? { actions: text } : { decisions: text }) }),
      keepLabel: `Keep on ${showName(v.name)}`,
      character: player,
      where: worldWhere(`@sheet:${v.sheet}`, v.agent ? [v.agent] : [], world, player)
    }
  }
  const context = (t: MapToken): TokenContext => ({
    token: t,
    tokens,
    world,
    use,
    places,
    player,
    editing,
    standing: use.stand[t.visitor.token] ?? NONE,
    holder: holder(t.visitor),
    setStanding,
    approach: (cb) => (onApproach ? onApproach(t.at, cb) : cb()),
    openMenu: (e) => open(t, e),
    onSelect
  })
  const items = (t: MapToken): MenuItem[] => [
    ...(onWalk && t.visitor.sheet !== player ? [{ label: 'Move here', icon: <Footprints className="h-4 w-4 text-secondary-ink" />, onSelect: () => onWalk(t.at) }] : []),
    ...(tokenSourceUi(t.visitor.source)?.items(context(t)) ?? []),
    ...(editing ? [{ label: 'Take off this map', icon: <LogOut />, danger: true, onSelect: () => setStanding(t.visitor.token, null) }] : [])
  ]
  const open = (t: MapToken, e: MenuEvent) => openMenu(e, showName(t.visitor.name), items(t))
  const handlers: TokenHandlers = {
    mine: player,
    onPick: (t, e) => {
      const ui = tokenSourceUi(t.visitor.source)
      if (ui?.pick) ui.pick(context(t), e)
      else open(t, e)
    },
    onMenu: open,
    onMove: (token, at) => {
      setStanding(token, { ...(use.stand[token] ?? NONE), at })
      const t = tokens.find((x) => x.visitor.token === token)
      if (t) {
        tokenSourceUi(t.visitor.source)?.moved?.(context(t), at)
        if (!editing && t.visitor.game) {
          void engine('game.onMove', { sheet: t.visitor.sheet || undefined, world, token: t.visitor.token, distance: 5 }).catch(
            failed('Could not run move triggers')
          )
        }
      }
    }
  }
  const placeSheet = (sheet: string, at: Point) => {
    closePlay()
    const place = () => {
      setStanding(sheet, { ...(use.stand[sheet] ?? NONE), at })
      settle(sheet, at)
    }
    if (editing) return place()
    void bringHere(world, sheet)
      .then((ok) => ok && place())
      .catch(failed('Could not put them here'))
  }
  const spawner = (at: Point, start: SpawnTab, title: string) => () => showPlay(title, <SpawnTokenModal world={world} map={use.map} at={at} start={start} onPickSheet={(sheet) => placeSheet(sheet, at)} onClose={closePlay} />)
  const putHere = (at: Point): MenuItem => ({ label: 'Place character…', icon: <UserPlus />, onSelect: spawner(at, 'cast', 'Place character') })
  const spawnCreatureHere = (at: Point): MenuItem => ({ label: 'Spawn creature…', icon: <Skull className="h-4 w-4 text-alert" />, onSelect: spawner(at, 'bestiary', 'Spawn creature') })
  return { tokens, handlers, putHere, spawnCreatureHere, holder, items }
}
