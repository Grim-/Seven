import { blankWorldEvent } from '@shared/game/worldEvents'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from '../decisions/StoredScreen'
import { WorldEventEditor, type EditableWorldEvent } from './WorldEventEditor'

const toEditable = (e: ReturnType<typeof blankWorldEvent>): EditableWorldEvent => ({ ...e, name: e.title })

export function WorldEventScreen(props: KindScreenProps) {
  return (
    <StoredScreen<EditableWorldEvent>
      {...props}
      what="world event"
      event="worldEvents.changed"
      get={(id) => engine('worldEvents.get', { id }).then((e) => ({ ...e, name: e.title }))}
      save={(event, previousId) =>
        engine('worldEvents.save', { event: { ...event, title: event.name }, previousId }).then((saved) => ({
          ...saved,
          name: saved.title
        }))
      }
      blank={() => toEditable(blankWorldEvent())}
      badge={(e) => `${e.status.toUpperCase()} · ${e.scope.level.toUpperCase()}`}
      Editor={WorldEventEditor}
    />
  )
}
