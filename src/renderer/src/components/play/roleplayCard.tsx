import { lazy, Suspense } from 'react'
import type { KindVariationProps } from '../../registries/kinds'
import { failed } from '../../lib/notify'
import { actionEffects } from '@shared/actions'
import { optionEffects } from '@shared/decisions'
import { cardVariations } from '../cards/variations'
import type { Card } from '../cards/model'
import './characterTargets'
import './placedTargets'

const usesEffects = (card: Card): boolean =>
  card.use === 'opposed' ||
  (card.use === 'action' && !!card.action && [card.action, ...card.action.checks].some((o) => actionEffects(o).length > 0)) ||
  (card.use === 'decision' && !!card.decision && card.decision.options.some((o) => optionEffects(o).length > 0))

const Editor = lazy(() => import('./RoleplayEditor').then((m) => ({ default: m.RoleplayEditor })))
const Face = lazy(() => import('./RoleplayFace').then((m) => ({ default: m.RoleplayFace })))

cardVariations.add({
  id: 'roleplay',
  module: 'world',
  name: 'Roleplay',
  label: 'Roleplay',
  order: 10,
  has: (raw) => raw.use === 'action' || raw.use === 'decision' || raw.use === 'opposed',
  attach: (raw) => ({ ...raw, use: 'action' }),
  remove: (raw) => ({ ...raw, use: 'generic' }),
  Editor: (props: KindVariationProps<Record<string, unknown>>) => (
    <Suspense fallback={null}>
      <Editor {...props} />
    </Suspense>
  ),
  Face: ({ card }) => (
    <Suspense fallback={null}>
      <Face card={card} />
    </Suspense>
  ),
  playable: (card) => (card.use === 'action' && card.action !== null) || (card.use === 'decision' && card.decision !== null) || (card.use === 'opposed' && card.opposed !== null),
  target: usesEffects,
  play: (card, where) =>
    void import('./play')
      .then(({ decide, oppose, rollAction }) => {
        if (card.use === 'action' && card.action) return rollAction(card.action, card.action.by ? null : (where.sheet ?? null), where)
        if (card.use === 'opposed' && card.opposed) return oppose(card.opposed, where)
        if (card.decision) decide(card.decision, where)
      })
      .catch(failed('Could not play the card'))
})
