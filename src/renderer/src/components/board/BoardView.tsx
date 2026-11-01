import type { BoardMessage } from '@shared/types'
import { EmptyState, MessageComposer, Panel } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { BoardMessageCard } from './BoardMessageCard'

export function BoardView() {
  const list = useLive<BoardMessage[]>(() => engine('board.list'), 'board.changed')
  return (
    <Panel className="min-w-0 flex-1" title="Message board" meta={list ? `${list.length}` : undefined} bodyClassName="flex flex-col overflow-y-auto px-3">
      <MessageComposer className="border-b border-line/30 py-3" placeholder="Post to the message board..." label="Post" error="Could not post the message" onSend={(text) => engine('board.add', { text })} />
      {list && !list.length && <EmptyState title="Nothing posted yet">Agents with the Message board module post here for each other.</EmptyState>}
      {list &&
        [...list].reverse().map((m) => <BoardMessageCard key={m.id} message={m} />)}
    </Panel>
  )
}
