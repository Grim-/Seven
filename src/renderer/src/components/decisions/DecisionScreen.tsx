import { Dices, MessageSquare } from 'lucide-react'
import { blankDecision, decisionModeLabel, type StoredDecision } from '@shared/storedDecision'
import { Button } from '../ui'
import { engine } from '../../lib/ipc'
import { focusedConversation } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { useApp } from '../../store/app'
import { toast } from '../../store/toasts'
import type { KindScreenProps } from '../../registries/kinds'
import { DecisionEditor } from './DecisionEditor'
import { StoredScreen } from './StoredScreen'

function playInChat(d: StoredDecision) {
  const conv = focusedConversation()
  if (!conv) return toast.info('No chat open', 'Open a chat first, then use the decision.')
  useApp.getState().setView('chat')
  void useSessions.getState().send(conv, `@story_decision:${d.id}`)
}

export function DecisionScreen(props: KindScreenProps) {
  return (
    <StoredScreen<StoredDecision>
      {...props}
      what="story decision"
      event="decisions.changed"
      get={(id) => engine('decisions.get', { id })}
      save={(decision, previousId) => engine('decisions.save', { decision, previousId })}
      blank={blankDecision}
      badge={decisionModeLabel}
      Editor={DecisionEditor}
      actions={(d, flush) => (
        <Button size="sm" variant="primary" icon={d.mode === 'roll' ? <Dices /> : <MessageSquare />} onClick={() => void flush().then(() => playInChat(d))}>
          {d.mode === 'roll' ? `Roll d${d.die}` : 'Pick'}
        </Button>
      )}
    />
  )
}
