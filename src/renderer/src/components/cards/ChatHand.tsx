import type { AgentProfile } from '@shared/types'
import type { Conversation } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { failed } from '../../lib/notify'
import type { PlayWhere } from '../play/playStore'
import { CardHand } from './CardHand'
import { playCard } from './playCard'
import { useDeckInUse } from './useDeckInUse'

export function ChatHand({ conv, agent, running }: { conv: Conversation; agent: AgentProfile | null; running: boolean }) {
  const deck = useDeckInUse(agent && conv.sessionId ? { chat: conv.sessionId, agent: agent.id } : null, [agent?.cards ?? null, agent?.player ?? null])
  if (!deck || !agent) return null
  const where: PlayWhere = { link: null, agents: [], sheet: agent.player ?? null, onText: (text) => void useSessions.getState().send(conv, text).catch(failed('Could not send')) }
  return <CardHand entries={deck.entries} disabled={running} onPlay={(card) => playCard(card, deck.ref, where).then(deck.refresh)} />
}
