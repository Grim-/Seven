import { lazy, Suspense, useContext } from 'react'
import { Layers } from 'lucide-react'
import { kindUi, registerKindUi, type EntrySurfaceProps } from '../../registries/kinds'
import { registerSideTab } from '../../registries/side'
import { useTools } from '../../store/tools'
import { showInData } from '../../lib/library'
import { InsideSlateContext } from '../entries/EntryCard'
import { CardScreen } from './CardScreen'
import './facet'
import { CountCards, DeckScreen, SetScreen } from './DeckScreen'
import { LayoutScreen } from './LayoutScreen'
import { LiveCard } from './LiveCard'
import { cardVariations } from './variations'
import { registerChatElement } from '../../registries/chatElements'
import { CARD_PLAY } from './cardPlay'
import { CardPlayRecord } from './CardPlayRecord'

const ChatDecks = lazy(() => import('./ChatDecks').then((m) => ({ default: m.ChatDecks })))

export function registerCards(): void {
  registerChatElement(CARD_PLAY, { View: CardPlayRecord, covers: (data) => (data.hidden === true ? 'hide' : 'fold') })
  const addon = kindUi('page:addon')
  const cardUi = {
    ...addon,
    moduleLists: [{ label: 'Card variation', list: cardVariations }],
    variations: cardVariations,
    present: { ...addon.present, Screen: CardScreen, Chat: CardChat, Stage: CardStage, Face: LiveCard }
  }
  const setUi = { ...addon, present: { ...addon.present, Screen: SetScreen, Chat: CountCards, Stage: CountCards } }
  const deckUi = { ...addon, present: { ...addon.present, Screen: DeckScreen, Chat: CountCards, Stage: CountCards } }
  const layoutUi = { ...addon, present: { ...addon.present, Screen: LayoutScreen } }
  registerKindUi('card', cardUi)
  registerKindUi('card_set', setUi)
  registerKindUi('deck', deckUi)
  registerKindUi('card_layout', layoutUi)
  registerKindUi('cards.card', cardUi)
  registerKindUi('cards.set', setUi)
  registerKindUi('cards.deck', deckUi)
  registerKindUi('cards.layout', layoutUi)
  registerSideTab({
    id: 'cards',
    label: 'Decks',
    icon: <Layers className="h-3.5 w-3.5" />,
    order: 40,
    always: true,
    visible: () => useTools.getState().list.some((m) => m.id === 'cards' && m.state === 'on'),
    render: () => (
      <Suspense fallback={null}>
        <ChatDecks />
      </Suspense>
    )
  })
}

function CardChat({ id }: EntrySurfaceProps) {
  const insideSlate = useContext(InsideSlateContext)
  if (insideSlate) return <CardScreen kind="card" id={id} select={(sel) => sel && showInData(sel)} />
  return <LiveCard id={id} className="w-56" />
}

function CardStage({ id }: EntrySurfaceProps) {
  return <LiveCard id={id} className="w-80" />
}
