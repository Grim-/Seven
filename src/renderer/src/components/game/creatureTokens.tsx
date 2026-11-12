import { Swords, Trash2 } from 'lucide-react'
import { combatantFromVisitor } from '@shared/game/state/BattleStateMachine'
import { useGameState } from '../play/state/gameStateStore'
import { registerTokenSourceUi } from '../../registries/tokenSources'

registerTokenSourceUi('creature', {
  items: (ctx) => {
    const t = ctx.token
    const mine = ctx.tokens.find((tok) => tok.visitor.sheet === ctx.player)
    return [
      ...(mine
        ? [
            {
              label: 'Engage Combat',
              icon: <Swords className="h-4 w-4 text-accent" />,
              onSelect: () => ctx.approach(() => useGameState.getState().startBattle([combatantFromVisitor(mine.visitor, mine.at, true), combatantFromVisitor(t.visitor, t.at, false, t.visitor.token)]))
            }
          ]
        : []),
      { label: 'Remove creature', icon: <Trash2 />, danger: true, onSelect: () => ctx.setStanding(t.visitor.token, null) }
    ]
  },
  pick: (ctx, e) => ctx.openMenu(e)
})
