import { LogOut, MessageSquarePlus, UserCheck, UserPlus } from 'lucide-react'
import { parseActions } from '@shared/actions'
import { parseDecisions } from '@shared/decisions'
import type { PlaceVisitor, Standing, WorldMapUse } from '@shared/maps'
import { smallestAt, type Point } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'
import { showName } from '@shared/ids'
import { openMenu, type MenuEvent, type MenuItem } from '../ui'
import { EntryPicker } from '../library/EntryPicker'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLibraryData } from '../../lib/useLive'
import { startChatItems } from '../../views/data/entryMenu'
import { closePlay, showPlay, worldWhere } from '../play/playStore'
import { actionItems, decisionItems, newPlayItems, type PlayHolder } from '../play/playHolder'
import { characterItems, setWhere } from './placeActions'
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
}

const NONE: Standing = { at: { x: 0, y: 0 }, actions: '', decisions: '' }

export function useMapTokens({ world, use, places, player, editing, save, onSelect }: Options) {
  const ids = Object.keys(use.stand)
  const visitors = useLibraryData(() => (ids.length ? engine('places.visitors', { sheets: ids }) : Promise.resolve([] as PlaceVisitor[])), `tokens.${ids.join(',')}`) ?? []
  const tokens: MapToken[] = visitors.map((visitor) => ({ visitor, at: use.stand[visitor.sheet].at }))
  const setStanding = (sheet: string, next: Standing | null) => {
    const { [sheet]: _old, ...rest } = use.stand
    save({ ...use, stand: next ? { ...rest, [sheet]: next } : rest })
  }
  const settle = (sheet: string, at: Point) => {
    const place = smallestAt(use.shapes, at)
    if (place) void setWhere(sheet, place).catch(failed('Could not move them'))
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
  const items = (t: MapToken): MenuItem[] => {
    const play = holder(t.visitor)
    const standing = use.stand[t.visitor.sheet] ?? NONE
    return [
      ...(t.visitor.sheet !== player
        ? [
            {
              label: 'Take Control (Set as Player)',
              icon: <UserCheck />,
              onSelect: () => void engine('worlds.setPlayer', { id: world, sheet: t.visitor.sheet }).catch(failed('Could not set player'))
            }
          ]
        : []),
      { label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(`@sheet:${t.visitor.sheet}`, t.visitor.agent ? [t.visitor.agent] : []) },
      ...parseActions(standing.actions).map((a, i) => ({ ...actionItems(play, a, i)[0], label: a.attempt })),
      ...parseDecisions(standing.decisions).map((d, i) => ({ ...decisionItems(play, d, i, null)[0], label: d.question })),
      ...(editing ? newPlayItems(play) : []),
      ...characterItems(t.visitor, places, smallestAt(use.shapes, t.at)),
      { label: 'Take off this map', icon: <LogOut />, danger: true, onSelect: () => setStanding(t.visitor.sheet, null) }
    ]
  }
  const open = (t: MapToken, e: MenuEvent) => openMenu(e, showName(t.visitor.name), items(t))
  const handlers: TokenHandlers = {
    mine: player,
    onPick: onSelect ? (t) => onSelect(t.visitor.sheet) : open,
    onMenu: open,
    onMove: (sheet, at) => {
      setStanding(sheet, { ...(use.stand[sheet] ?? NONE), at })
      settle(sheet, at)
    }
  }
  const putHere = (at: Point): MenuItem => ({
    label: 'Put a character here',
    icon: <UserPlus />,
    onSelect: () =>
      showPlay(
        'Put a character here',
        <EntryPicker
          kind="sheet"
          title="Put a character here"
          inline
          onClose={closePlay}
          onPick={(hit) => {
            closePlay()
            void bringHere(world, hit.id)
              .then((ok) => {
                if (!ok) return
                setStanding(hit.id, { ...(use.stand[hit.id] ?? NONE), at })
                settle(hit.id, at)
              })
              .catch(failed('Could not put them here'))
          }}
        />
      )
  })
  return { tokens, handlers, putHere, holder, items }
}
