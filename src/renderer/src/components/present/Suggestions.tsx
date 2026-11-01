import { useState } from 'react'
import { Check, CornerDownLeft } from 'lucide-react'
import { Button } from '../ui'
import { registerPresentation, type PresentationProps } from '../../registries/presentations'
import { useConversation } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { failed } from '../../lib/notify'

function Suggestions({ fields, draft }: PresentationProps) {
  const conv = useConversation()
  const running = useSessions((s) => (conv.sessionId ? Boolean(s.running[conv.sessionId]) : false))
  const [picked, setPicked] = useState<string | null>(null)
  const replies = (Array.isArray(fields.replies) ? fields.replies : []).filter((r): r is string => typeof r === 'string' && r.trim() !== '')
  const send = (text: string) => {
    setPicked(text)
    void useSessions
      .getState()
      .send(conv, text)
      .catch((err) => {
        setPicked(null)
        failed('Could not send')(err)
      })
  }
  return (
    <div className="my-2 flex flex-wrap gap-1.5">
      {replies.map((r, i) => (
        <Button key={i} size="sm" variant={picked === r ? 'primary' : 'secondary'} icon={picked === r ? <Check /> : <CornerDownLeft />} disabled={draft || running || (picked !== null && picked !== r)} onClick={() => send(r)} className="normal-case tracking-normal">
          {r}
        </Button>
      ))}
    </div>
  )
}

registerPresentation('suggest', Suggestions)
