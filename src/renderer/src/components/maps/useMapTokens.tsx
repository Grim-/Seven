import { Footprints, LogOut, MessageSquarePlus, Swords, UserCheck, UserPlus, Skull } from 'lucide-react'
import { parseActions } from '@shared/actions'
import { parseDecisions } from '@shared/decisions'
import type { PlaceVisitor, Standing, WorldMapUse } from '@shared/maps'
import { smallestAt, type Point } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'
import { showName } from '@shared/ids'
import { defaultDialogueTree } from '@shared/game/dialogue'
import { openMenu, type MenuEvent, type MenuItem } from '../ui'
import { EntryPicker } from '../library/EntryPicker'
import { QuickCreatureSpawner } from './QuickCreatureSpawner'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLibraryData } from '../../lib/useLive'
import { startChatItems } from '../../views/data/entryMenu'
import { closePlay, showPlay, worldWhere } from '../play/playStore'
import { actionItems, decisionItems, newPlayItems, type PlayHolder } from '../play/playHolder'
import { useDialogue } from '../play/dialogue/dialogueStore'
import { useGameState } from '../play/state/gameStateStore'
import { combatantFromVisitor } from '@shared/game/state/BattleStateMachine'
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
  onWalk?: (target: Point) => void
  onApproach?: (target: Point, onReach: () => void) => void
}

const NONE: Standing = { at: { x: 0, y: 0 }, actions: '', decisions: '' }

export function useMapTokens({ world, use, places, player, editing, save, onSelect, onWalk, onApproach }: Options) {
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
    const isSelf = t.visitor.sheet === player

    const withApproach = (cb: () => void) => {
      if (onApproach) onApproach(t.at, cb)
      else cb()
    }

    return [
      ...(onWalk
        ? [
            {
              label: 'Move here',
              icon: <Footprints className="h-4 w-4 text-cyan" />,
              onSelect: () => onWalk(t.at)
            }
          ]
        : []),
      ...(!isSelf
        ? [
            {
              label: `Talk to ${showName(t.visitor.name)}`,
              icon: <MessageSquarePlus className="h-4 w-4 text-cyan" />,
              onSelect: () =>
                withApproach(() => {
                  if (onSelect) {
                    onSelect(t.visitor.sheet)
                  } else {
                    const tree = defaultDialogueTree(t.visitor.sheet, t.visitor.name)
                    useDialogue.getState().startDialogue(tree, t.visitor.name)
                  }
                })
            },
            {
              label: 'Take Control (Set as Player)',
              icon: <UserCheck />,
              onSelect: () => void engine('worlds.setPlayer', { id: world, sheet: t.visitor.sheet }).catch(failed('Could not set player'))
            },
            {
              label: 'Engage Combat',
              icon: <Swords className="h-4 w-4 text-accent" />,
              onSelect: () =>
                withApproach(() => {
                  const playerTok = tokens.find((tok) => tok.visitor.sheet === player)
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
                  useGameState.getState().startBattle([playerCombatant, targetCombatant])
                })
            }
          ]
        : []),
      { label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(`@sheet:${t.visitor.sheet}`, t.visitor.agent ? [t.visitor.agent] : []) },
      ...parseActions(standing.actions).map((a, i) => {
        const item = actionItems(play, a, i)[0]
        return {
          ...item,
          label: a.attempt,
          onSelect: item.onSelect ? () => withApproach(item.onSelect!) : undefined
        }
      }),
      ...parseDecisions(standing.decisions).map((d, i) => {
        const item = decisionItems(play, d, i, null)[0]
        return {
          ...item,
          label: d.question,
          onSelect: item.onSelect ? () => withApproach(item.onSelect!) : undefined
        }
      }),
      ...(editing ? newPlayItems(play) : []),
      ...characterItems(t.visitor, places, smallestAt(use.shapes, t.at)),
      ...(editing ? [{ label: 'Take off this map', icon: <LogOut />, danger: true, onSelect: () => setStanding(t.visitor.sheet, null) }] : [])
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
            if (editing) {
              setStanding(hit.id, { ...(use.stand[hit.id] ?? NONE), at })
              settle(hit.id, at)
            } else {
              void bringHere(world, hit.id)
                .then((ok) => {
                  if (!ok) return
                  setStanding(hit.id, { ...(use.stand[hit.id] ?? NONE), at })
                  settle(hit.id, at)
                })
                .catch(failed('Could not put them here'))
            }
          }}
        />
      )
  })
  const spawnCreatureHere = (at: Point): MenuItem => ({
    label: 'Spawn creature template here',
    icon: <Skull className="h-4 w-4 text-alert" />,
    onSelect: () =>
      showPlay(
        'Spawn creature template here',
        <QuickCreatureSpawner
          worldId={world}
          at={at}
          onSpawn={(sheetId) => {
            closePlay()
            setStanding(sheetId, { ...(use.stand[sheetId] ?? NONE), at })
            settle(sheetId, at)
          }}
          onClose={closePlay}
        />
      )
  })
  return { tokens, handlers, putHere, spawnCreatureHere, holder, items }
}
