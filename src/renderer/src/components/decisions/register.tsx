import { registerKindUi } from '../../registries/kinds'
import { registerUiRequest } from '../../registries/ui-requests'
import { DecisionScreen, NEW_DECISION } from './DecisionScreen'
import { DecideCard } from './DecideCard'
import { RolledCard } from './RolledCard'
import { OpposedCard } from './OpposedCard'

export function registerDecisions(): void {
  registerKindUi('decision', {
    present: { Screen: DecisionScreen },
    addLabel: 'New decision',
    add: (kind, select) => () => select({ kind, id: NEW_DECISION })
  })
  registerUiRequest('decide', DecideCard)
  registerUiRequest('rolled', RolledCard)
  registerUiRequest('opposed', OpposedCard)
}
