import { lazy, Suspense } from 'react'
import { BLANK_GAMEPLAY } from '@shared/gameplayCard'
import type { KindVariationProps } from '../../registries/kinds'
import { failed } from '../../lib/notify'
import { engine } from '../../lib/ipc'
import { cardVariations } from '../cards/variations'

const Editor = lazy(() => import('./GameplayEditor').then((m) => ({ default: m.GameplayEditor })))
const Face = lazy(() => import('./GameplayFace').then((m) => ({ default: m.GameplayFace })))

const has = (raw: Record<string, unknown>) => !!raw.gameplay && typeof raw.gameplay === 'object'

cardVariations.add({
  id: 'gameplay',
  module: 'game',
  name: 'Gameplay',
  label: 'Gameplay',
  order: 20,
  has,
  attach: (raw) => ({ ...raw, gameplay: BLANK_GAMEPLAY }),
  remove: (raw) => ({ ...raw, gameplay: null }),
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
  playable: (card) => has(card.raw),
  target: () => true,
  blocked: async (_card, where) => {
    if (!where.sheet) return 'No character is playing'
    return (await engine('sheets.get', { id: where.sheet })).game ? null : 'Your character is not in the game'
  },
  play: (card, where) =>
    void import('./gameplay')
      .then(({ playGameplay }) => playGameplay(card, where))
      .catch(failed('Could not play the card'))
})
