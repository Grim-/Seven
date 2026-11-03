import { blankStoredAction, type StoredAction } from '@shared/storedAction'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from './StoredScreen'
import { StoryActionEditor } from './StoryActionEditor'

export function StoryActionScreen(props: KindScreenProps) {
  return (
    <StoredScreen<StoredAction>
      {...props}
      what="story action"
      event="storyActions.changed"
      get={(id) => engine('storyActions.get', { id })}
      save={(action, previousId) => engine('storyActions.save', { action, previousId })}
      blank={blankStoredAction}
      Editor={StoryActionEditor}
    />
  )
}
