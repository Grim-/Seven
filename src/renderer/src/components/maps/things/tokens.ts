import { Users } from 'lucide-react'
import { showName } from '@shared/ids'
import { TOKEN_THING } from '@shared/maps'
import { circleBounds, inCircle, registerMapThing, thingKey } from './registry'

const SMALLEST = 40

registerMapThing({
  type: TOKEN_THING,
  label: 'Character',
  icon: Users,
  rank: 50,
  things: ({ props, zoom }) => {
    const handlers = props.onToken ?? {}
    if (!handlers.onPick && !handlers.onMenu) return []
    const r = Math.max(SMALLEST, props.map.tile.w * 2 * zoom) / zoom / 2
    return (props.tokens ?? []).map((t) => ({
      key: thingKey(TOKEN_THING, t.visitor.token),
      type: TOKEN_THING,
      id: t.visitor.token,
      label: showName(t.visitor.name),
      rank: 50,
      bounds: circleBounds(t.at, r),
      hit: inCircle(t.at, r),
      pick: (e) => handlers.onPick?.(t, e),
      menu: handlers.onMenu && ((e) => handlers.onMenu!(t, e))
    }))
  }
})
