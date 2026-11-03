import { useState } from 'react'
import { Dices, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { blankDecision, decisionModeLabel, type StoredDecision } from '@shared/storedDecision'
import { Button, EmptyState, MakeOrSaved, SaveState, confirmDelete, useAutosavedState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useBusy } from '../../lib/useBusy'
import { focusedConversation } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { useApp } from '../../store/app'
import { toast } from '../../store/toasts'
import type { KindScreenProps } from '../../registries/kinds'
import { DecisionEditor } from './DecisionEditor'

export const NEW_DECISION = '__new'

function playInChat(d: StoredDecision) {
  const conv = focusedConversation()
  if (!conv) return toast.info('No chat open', 'Open a chat first, then use the decision.')
  useApp.getState().setView('chat')
  void useSessions.getState().send(conv, `@decision:${d.id}`)
}

function NewDecision({ select }: { select: KindScreenProps['select'] }) {
  const [decision, setDecision] = useState(blankDecision)
  const [busy, run] = useBusy()
  const make = () =>
    void run(async () => {
      const saved = await engine('decisions.save', { decision, previousId: null })
      select({ kind: 'decision', id: saved.id })
    }, 'Could not make the decision')
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">New decision</span>
        <span className="flex-1" />
        <MakeOrSaved made={false} saver={{ status: 'idle', error: null }} what="decision" disabled={!decision.name.trim() || busy} onMake={make} />
      </div>
      <DecisionEditor decision={decision} onChange={setDecision} />
    </div>
  )
}

function EditDecision({ start, select }: { start: StoredDecision; select: KindScreenProps['select'] }) {
  const state = useAutosavedState<StoredDecision>(start, (decision) => engine('decisions.save', { decision, previousId: start.id }), { when: (d) => Boolean(d.name.trim()) })
  const d = state.value
  const remove = () => confirmDelete(`Delete ${d.name}?`, 'It is removed for good.', () => engine('library.remove', { entry: `@decision:${d.id}` }), () => select({ kind: 'decision', id: 'all' }))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] font-semibold text-white">{d.name || 'Decision'}</h2>
        <span className="border border-line/50 px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">{decisionModeLabel(d)}</span>
        <span className="flex-1" />
        <SaveState status={state.status} error={state.error} />
        <Button size="sm" variant="primary" icon={d.mode === 'roll' ? <Dices /> : <MessageSquare />} onClick={() => void state.flush().then(() => playInChat(d))}>
          {d.mode === 'roll' ? `Roll d${d.die}` : 'Pick'}
        </Button>
        <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
          Delete
        </Button>
        <Button size="sm" variant="ghost" icon={<Plus />} title="New decision" onClick={() => select({ kind: 'decision', id: NEW_DECISION })} />
      </div>
      <DecisionEditor decision={d} onChange={state.set} />
    </div>
  )
}

export function DecisionScreen({ id, select }: KindScreenProps) {
  const got = useLive(() => (id && id !== NEW_DECISION ? engine('decisions.get', { id }) : Promise.resolve(null)), 'decisions.changed')
  if (id === NEW_DECISION) return <NewDecision select={select} />
  if (!id) return null
  if (!got || got.id !== id) return <EmptyState title="Loading">One moment.</EmptyState>
  return <EditDecision key={got.id} start={got} select={select} />
}
