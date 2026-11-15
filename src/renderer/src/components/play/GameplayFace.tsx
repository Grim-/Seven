import { cleanGameplay, GAMEPLAY_LANES } from '@shared/gameplayCard'
import { EffectsView } from '../game/effects/EffectsView'
import type { Card } from '../cards/model'

const signed = (n: number): string => (n ? ` ${n > 0 ? '+' : '−'} ${Math.abs(n)}` : '')

export function GameplayFace({ card }: { card: Card }) {
  const g = cleanGameplay(card.raw.gameplay)
  return (
    <div className="flex flex-col gap-1.5">
      <span>
        Roll <b>{g.check ?? 'd20'}</b>
        {signed(g.bonus)} against {g.defence ? <b>the target's {g.defence}</b> : <b>DC {g.dc}</b>}
      </span>
      <EffectsView defs={g.effects} lanes={GAMEPLAY_LANES} />
    </div>
  )
}
