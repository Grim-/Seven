import { ListPane, ListToggle, Split } from '../components/ui'
import { useSessions } from '../store/sessions'
import { useListPrefs } from '../lib/listPrefs'
import { useConversation } from '../lib/conversation'
import { ChatList } from './chat/ChatList'
import { Conversation } from './chat/Conversation'
import { CinemaChat } from './chat/CinemaChat'
import { useCinema } from '../lib/cinema'

export function ChatView() {
  const conv = useConversation()
  const [listPrefs, saveList] = useListPrefs('chatList', { open: true, width: 288 })
  const [cinema, setCinema] = useCinema()
  if (cinema) return <CinemaChat onLeave={() => setCinema(false)} />
  return (
    <div className="h-full p-3">
      <Split>
        <ListPane id="chats" open={listPrefs.open} width={listPrefs.width} min={200} max={560} reset={288} onWidth={(w) => saveList({ width: w })}>
          <ChatList selected={conv.sessionId} onOpen={(id) => conv.go(id)} onNew={(agentId) => useSessions.getState().startNew(conv, agentId)} onDeleted={(id) => id === conv.sessionId && conv.go(null)} />
        </ListPane>
        <Conversation lead={<ListToggle open={listPrefs.open} onToggle={() => saveList({ open: !listPrefs.open })} what="the chat list" />} />
      </Split>
    </div>
  )
}
