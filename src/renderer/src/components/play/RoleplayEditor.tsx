import type { CardUse } from '@shared/cardDecks'
import { Segmented } from '../ui'
import type { KindVariationProps } from '../../registries/kinds'
import { readCard } from '../cards/model'
import { ActionForm, BLANK_ACTION } from './ActionForm'
import { BLANK_DECISION, DecisionForm } from './DecisionForm'
import { BLANK_OPPOSED, OpposedCardForm } from '../decisions/OpposedCardForm'

const MODES: { value: CardUse; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'decision', label: 'Decision' },
  { value: 'opposed', label: 'Opposed check' }
]

const TRY = { link: null, agents: [] }

export function RoleplayEditor({ entry, change }: KindVariationProps<Record<string, unknown>>) {
  const card = readCard(entry, '')
  const set = (patch: Record<string, unknown>) => change({ ...entry, ...patch })
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Segmented value={card.use} options={MODES} onChange={(use) => set({ use })} />
      {card.use === 'action' && <ActionForm initial={card.action ?? BLANK_ACTION} character={null} where={TRY} onChange={(action) => set({ action })} keepLabel="" />}
      {card.use === 'decision' && <DecisionForm initial={card.decision ?? BLANK_DECISION} where={TRY} onChange={(decision) => set({ decision })} keepLabel="" />}
      {card.use === 'opposed' && <OpposedCardForm value={card.opposed ?? BLANK_OPPOSED} onChange={(opposed) => set({ opposed })} />}
    </div>
  )
}
