import { blankStoredTriggerAction, type StoredTriggerAction } from '@shared/game/triggerActions'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from '../decisions/StoredScreen'
import { TriggerActionEditor } from './TriggerActionEditor'

export function TriggerActionScreen(props: KindScreenProps) {
  return (
    <StoredScreen<StoredTriggerAction>
      {...props}
      what="trigger_action"
      event="triggerActions.changed"
      get={(id) => engine('triggerActions.get', { id }).then((a) => a ?? blankStoredTriggerAction())}
      save={(action, previousId) => engine('triggerActions.save', { action, previousId })}
      blank={blankStoredTriggerAction}
      badge={(a) => `${a.actionType}`}
      Editor={TriggerActionEditor}
    />
  )
}
