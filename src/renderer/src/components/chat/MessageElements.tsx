import type { ChatElement } from '@shared/chatElements'
import { useSessions } from '../../store/sessions'
import { useConversation } from '../../lib/conversation'
import { chatElementType, type TextCover } from '../../registries/chatElements'
import '../play/EffectLogElement'
import './Roleplay'
import './VnBeatElement'

const NONE: ChatElement[] = []

export function useMessageElements(messageId: string): ChatElement[] {
  const { sessionId } = useConversation()
  return useSessions((s) => (sessionId ? s.messages[sessionId]?.find((m) => m.id === messageId)?.elements : undefined)) ?? NONE
}

export function useTextCover(messageId: string): TextCover {
  const covers = useMessageElements(messageId).map((e) => chatElementType(e)?.covers?.(e.data) ?? null)
  return covers.find((c) => c === 'hide') ?? covers.find((c) => c === 'fold') ?? null
}

export function MessageElements({ messageId }: { messageId: string }) {
  const elements = useMessageElements(messageId)
  if (!elements.length) return null
  return (
    <div className="chat-elements">
      {elements.map((element, i) => {
        const type = chatElementType(element)
        return type ? <type.View key={i} data={element.data} messageId={messageId} /> : null
      })}
    </div>
  )
}
