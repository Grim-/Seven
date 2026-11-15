import { X } from 'lucide-react'
import { useConversation } from '../../lib/conversation'
import { draftOf, useSessions } from '../../store/sessions'
import { chatElementType } from '../../registries/chatElements'
import { Button } from '../ui'

export function DraftElements() {
  const { key } = useConversation()
  const elements = useSessions((s) => draftOf(s, key).elements)
  if (!elements.length) return null
  return (
    <div className="chat-elements border-t border-line/60 bg-black/40 px-3 pt-2">
      {elements.map((element, i) => {
        const type = chatElementType(element)
        if (!type) return null
        return (
          <div key={i} className="flex items-start gap-1.5">
            <type.View data={element.data} messageId="" />
            <Button size="sm" variant="ghost" icon={<X />} title="Don't send this" onClick={() => useSessions.getState().detachElement(key, i)} />
          </div>
        )
      })}
    </div>
  )
}
