import { Pencil } from 'lucide-react'
import { userSide } from '@shared/cardDecks'
import type { AgentProfile } from '@shared/types'
import type { Conversation } from '../../lib/conversation'
import { openMenu } from '../ui'
import { chatCanAnswer } from '../../lib/sendOrQueue'
import type { PlayWhere } from '../play/playStore'
import { CardHand } from './CardHand'
import { openTrayTab } from '../side/SidePanel'
import { playCard } from './playCard'
import { cardForms } from './cardForms'
import type { CardVariation } from './variations'
import { stageSurface } from './playStage'
import { chatPlay } from './cardPlay'
import { useDeckInUse } from './useDeckInUse'
import { useChatPlayer } from '../chat/useChatPlayer'
import type { Card } from './model'

export function ChatHand({ conv, agent, running }: { conv: Conversation; agent: AgentProfile | null; running: boolean }) {
  const player = useChatPlayer(agent)
  const ref = agent ? userSide(player) : null
  const deck = useDeckInUse(ref)
  if (!deck || !agent || !ref) return null
  const play = async (card: Card, form?: CardVariation | null) => {
    const send = conv.sessionId !== null && chatCanAnswer(agent)
    const sent = chatPlay(conv, card, send)
    const where: PlayWhere = { link: null, agents: [agent.id], sheet: player, onText: sent.text, surface: stageSurface(card, sent.done) }
    sent.said(await playCard(card, ref, where, form))
    deck.refresh()
  }
  const editDeck = () => openTrayTab('cards')
  return (
    <CardHand
      entries={deck.entries}
      disabled={running}
      burns={false}
      formsFor={(card) => cardForms(card, { sheet: player })}
      onPlay={play}
      onMenu={(e) => openMenu(e, 'Hand', [{ label: 'Edit decks', icon: <Pencil />, onSelect: editDeck }])}
    />
  )
}
