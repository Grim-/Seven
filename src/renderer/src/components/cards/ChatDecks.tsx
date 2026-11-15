import { agentSide, userSide } from '@shared/cardDecks'
import { useChatAgent } from '../chat/useOpenChat'
import { useChatPlayer } from '../chat/useChatPlayer'
import type { PlayingSide } from './DeckOwnerList'
import { OwnerDecks } from './OwnerDecks'

export function ChatDecks() {
  const agent = useChatAgent()
  const you = userSide(useChatPlayer(agent))
  const playing: PlayingSide[] = [{ owner: you, note: 'Your hand in this chat' }, ...(agent ? [{ owner: agentSide(agent), note: `${agent.name}'s side in this chat` }] : [])]
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <OwnerDecks key={JSON.stringify(you)} start={you} playing={playing} />
    </div>
  )
}
