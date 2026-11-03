import { registerKindUi } from '../../registries/kinds'
import { registerUiRequest } from '../../registries/ui-requests'
import { NEW_ENTRY } from './StoredScreen'
import { DecisionScreen } from './DecisionScreen'
import { StoryActionScreen } from './StoryActionScreen'
import { DecideCard } from './DecideCard'
import { RolledCard } from './RolledCard'
import { OpposedCard } from './OpposedCard'

export function registerDecisions(): void {
  registerKindUi('story_decision', {
    present: { Screen: DecisionScreen },
    addLabel: 'New story decision',
    add: (kind, select) => () => select({ kind, id: NEW_ENTRY })
  })
  registerKindUi('story_action', {
    present: { Screen: StoryActionScreen },
    addLabel: 'New story action',
    add: (kind, select) => () => select({ kind, id: NEW_ENTRY })
  })
  registerUiRequest('decide', DecideCard)
  registerUiRequest('rolled', RolledCard)
  registerUiRequest('opposed', OpposedCard)
}
