import type { ReactNode } from 'react'
import { ACTION_LANES, actionEffects } from '@shared/actions'
import { OPTION_LANES, optionEffects } from '@shared/decisions'
import { SIDE_LANES, sideEffects } from '@shared/opposedCheck'
import { EffectsView } from '../game/effects/EffectsView'
import type { Card } from '../cards/model'

function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[0.4em]">
      <b className="font-label text-[0.88em] caps-6 text-ink/95">{label}</b>
      {children}
    </div>
  )
}

export function RoleplayFace({ card }: { card: Card }) {
  if (card.use === 'action' && card.action) {
    const action = card.action
    return (
      <div className="flex flex-col gap-[0.65em]">
        <EffectsView defs={actionEffects(action)} lanes={ACTION_LANES} />
        {action.checks.map((c, i) =>
          actionEffects(c).length ? (
            <Part key={i} label={`Check ${i + 1}`}>
              <EffectsView defs={actionEffects(c)} lanes={ACTION_LANES} />
            </Part>
          ) : null
        )}
      </div>
    )
  }
  if (card.use === 'decision' && card.decision)
    return (
      <div className="flex flex-col gap-[0.65em]">
        {card.decision.options.map((o, i) => (
          <Part key={i} label={o.text}>
            <EffectsView defs={optionEffects(o)} lanes={OPTION_LANES} />
          </Part>
        ))}
      </div>
    )
  if (card.use === 'opposed' && card.opposed)
    return (
      <div className="flex flex-col gap-[0.65em]">
        {[card.opposed.a, card.opposed.b].map((side, i) => (
          <Part key={i} label={side.name || (i ? 'The target' : 'The player')}>
            <EffectsView defs={sideEffects(side)} lanes={SIDE_LANES} />
          </Part>
        ))}
      </div>
    )
  return null
}
