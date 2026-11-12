import { MessageSquarePlus, Swords, UserCheck } from 'lucide-react'
import { parseActions } from '@shared/actions'
import { parseDecisions } from '@shared/decisions'
import { smallestAt } from '@shared/shapes'
import { showName } from '@shared/ids'
import { defaultDialogueTree } from '@shared/game/dialogue'
import { combatantFromVisitor } from '@shared/game/state/BattleStateMachine'
import type { MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { startChatItems } from '../../views/data/entryMenu'
import { actionItems, decisionItems, newPlayItems } from '../play/playHolder'
import { useDialogue } from '../play/dialogue/dialogueStore'
import { useGameState } from '../play/state/gameStateStore'
import { registerTokenSourceUi, type TokenContext } from '../../registries/tokenSources'
import { characterItems, setWhere } from './placeActions'

function engageItem(ctx: TokenContext): MenuItem {
  const t = ctx.token
  return {
    label: 'Engage Combat',
    icon: <Swords className="h-4 w-4 text-accent" />,
    onSelect: () =>
      ctx.approach(() => {
        const mine = ctx.tokens.find((tok) => tok.visitor.sheet === ctx.player)
        const playerCombatant = mine
          ? combatantFromVisitor(mine.visitor, mine.at, true)
          : {
              id: ctx.player ?? 'player',
              sheet: ctx.player ?? undefined,
              name: 'Player Character',
              isPlayer: true,
              hp: { cur: 12, max: 12 },
              ac: 14,
              speedMax: 30,
              at: t.at,
              attacks: [{ name: 'Strike', bonus: 4, damage: '1d8 + 2' }],
              faction: 'player'
            }
        useGameState.getState().startBattle([playerCombatant, combatantFromVisitor(t.visitor, t.at, false)])
      })
  }
}

function otherItems(ctx: TokenContext): MenuItem[] {
  const v = ctx.token.visitor
  return [
    {
      label: `Talk to ${showName(v.name)}`,
      icon: <MessageSquarePlus className="h-4 w-4 text-cyan" />,
      onSelect: () =>
        ctx.approach(() => {
          if (ctx.onSelect) ctx.onSelect(v.sheet)
          else useDialogue.getState().startDialogue(defaultDialogueTree(v.sheet, v.name), v.name)
        })
    },
    {
      label: 'Take Control (Set as Player)',
      icon: <UserCheck />,
      onSelect: () => void engine('worlds.setPlayer', { id: ctx.world, sheet: v.sheet }).catch(failed('Could not set player'))
    },
    engageItem(ctx)
  ]
}

function withApproach(ctx: TokenContext, item: MenuItem, label: string): MenuItem {
  const run = item.onSelect
  return { ...item, label, onSelect: run ? () => ctx.approach(run) : undefined }
}

registerTokenSourceUi('sheet', {
  items: (ctx) => {
    const v = ctx.token.visitor
    return [
      ...(v.sheet !== ctx.player ? otherItems(ctx) : []),
      { label: 'Continue here', icon: <MessageSquarePlus />, children: startChatItems(`@sheet:${v.sheet}`, v.agent ? [v.agent] : []) },
      ...parseActions(ctx.standing.actions).map((a, i) => withApproach(ctx, actionItems(ctx.holder, a, i)[0], a.attempt)),
      ...parseDecisions(ctx.standing.decisions).map((d, i) => withApproach(ctx, decisionItems(ctx.holder, d, i, null)[0], d.question)),
      ...(ctx.editing ? newPlayItems(ctx.holder) : []),
      ...characterItems(v, ctx.places, smallestAt(ctx.use.shapes, ctx.token.at))
    ]
  },
  pick: (ctx, e) => (ctx.onSelect ? ctx.onSelect(ctx.token.visitor.sheet) : ctx.openMenu(e)),
  moved: (ctx, at) => {
    const place = smallestAt(ctx.use.shapes, at)
    if (place) void setWhere(ctx.token.visitor.sheet, place).catch(failed('Could not move them'))
  }
})
