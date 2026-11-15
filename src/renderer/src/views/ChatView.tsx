import { useEffect } from 'react'
import { ListPane, ListToggle, Split } from '../components/ui'
import { useSessions } from '../store/sessions'
import { useListPrefs } from '../lib/listPrefs'
import { useCompactLayout } from '../lib/form'
import { useConversation } from '../lib/conversation'
import { ChatList } from './chat/ChatList'
import { Conversation } from './chat/Conversation'
import { CinemaChat } from './chat/CinemaChat'
import { ChatViewSwitcherModal } from './chat/ChatViewSwitcherModal'
import { useCinema } from '../lib/cinema'
import { useChatViewSwitcher } from '../lib/chatViewMode'
import { matchesKeybind } from '../store/keybinds'

export function ChatView() {
  const conv = useConversation()
  const [listPrefs, saveList] = useListPrefs('chatList', { open: true, width: 288 })
  const compact = useCompactLayout()
  const [cinema, setCinema] = useCinema()
  const toggleViewSwitcher = useChatViewSwitcher((s) => s.toggle)
  const setViewSwitcherOpen = useChatViewSwitcher((s) => s.setOpen)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return
      if (!matchesKeybind('chat.cycleMode', e)) return
      const target = e.target as HTMLElement | null
      const open = useChatViewSwitcher.getState().open
      if (!open && target?.closest('input, textarea, select, [contenteditable]')) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      toggleViewSwitcher()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      setViewSwitcherOpen(false)
    }
  }, [toggleViewSwitcher, setViewSwitcherOpen])

  return (
    <>
      {cinema ? (
        <CinemaChat onLeave={() => setCinema(false)} />
      ) : (
        <div className="h-full p-3 tablet:p-0">
          <Split>
            <ListPane
              id="chats"
              open={listPrefs.open}
              width={listPrefs.width}
              min={200}
              max={560}
              reset={288}
              onWidth={(w) => saveList({ width: w })}
              onClose={() => saveList({ open: false })}
            >
              <ChatList
                selected={conv.sessionId}
                onOpen={(id) => {
                  conv.go(id)
                  if (compact) saveList({ open: false })
                }}
                onNew={(agentId) => {
                  useSessions.getState().startNew(conv, agentId)
                  if (compact) saveList({ open: false })
                }}
                onDeleted={(id) => id === conv.sessionId && conv.go(null)}
              />
            </ListPane>
            <Conversation lead={<ListToggle open={listPrefs.open} onToggle={() => saveList({ open: !listPrefs.open })} what="the chat list" />} />
          </Split>
        </div>
      )}
      <ChatViewSwitcherModal />
    </>
  )
}
