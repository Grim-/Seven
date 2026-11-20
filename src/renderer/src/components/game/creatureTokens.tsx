import { Swords, Trash2 } from 'lucide-react'
import { useGameState } from '../play/state/gameStateStore'
import { registerTokenSourceUi } from '../../registries/tokenSources'

registerTokenSourceUi('creature', {
  items: (ctx) => {
    const t = ctx.token
    return [
      ...(ctx.player
        ? [
            {
              label: 'Engage Combat',
              icon: <Swords className="h-4 w-4 text-accent" />,
              onSelect: () => ctx.approach(() => void useGameState.getState().startBattle(ctx.player!, [t.visitor.token]))
            }
          ]
        : []),
      { label: 'Remove creature', icon: <Trash2 />, danger: true, onSelect: () => ctx.setStanding(t.visitor.token, null) }
    ]
  },
  pick: (ctx, e) => (ctx.onSelect ? ctx.onSelect(ctx.token.visitor.token) : ctx.openMenu(e))
})
