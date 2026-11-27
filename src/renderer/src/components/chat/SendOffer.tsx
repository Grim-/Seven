import { Send, X } from 'lucide-react'
import type { AgentProfile } from '@shared/types'
import { useConversation } from '../../lib/conversation'
import { dropSendOffer, useSendOffer } from '../../lib/composer'
import { chatCanAnswer } from '../../lib/sendOrQueue'
import { Button } from '../ui'

export function SendOffer({ agent, onSend }: { agent: AgentProfile | null; onSend: () => void }) {
  const { key, sessionId } = useConversation()
  const offered = useSendOffer(key)
  if (!offered || !agent || !chatCanAnswer(agent)) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-secondary-ink/40 bg-secondary-ink/[0.06] px-3 py-2 text-[13px]">
      <span className="min-w-48 flex-1">{sessionId ? 'Send this?' : 'Start a chat with the current settings and send this?'}</span>
      <Button
        size="sm"
        icon={<Send />}
        onClick={() => {
          dropSendOffer(key)
          onSend()
        }}
      >
        {sessionId ? 'Send' : 'Start and send'}
      </Button>
      <Button size="sm" variant="ghost" icon={<X />} onClick={() => dropSendOffer(key)}>
        Keep in the box
      </Button>
    </div>
  )
}
