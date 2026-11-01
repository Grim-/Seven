import { kindUi, registerKindUi, type EntrySurfaceProps } from '../../registries/kinds'
import { CardScreen } from './CardScreen'
import { CountCards, DeckScreen, SetScreen } from './DeckScreen'
import { LayoutScreen } from './LayoutScreen'
import { LiveCard } from './LiveCard'

export function registerCards(): void {
  const addon = kindUi('page:addon')
  registerKindUi('cards.card', { ...addon, present: { ...addon.present, Screen: CardScreen, Chat: CardChat, Stage: CardStage, Face: LiveCard } })
  registerKindUi('cards.set', { ...addon, present: { ...addon.present, Screen: SetScreen, Chat: CountCards, Stage: CountCards } })
  registerKindUi('cards.deck', { ...addon, present: { ...addon.present, Screen: DeckScreen, Chat: CountCards, Stage: CountCards } })
  registerKindUi('cards.layout', { ...addon, present: { ...addon.present, Screen: LayoutScreen } })
}

function CardChat({ id }: EntrySurfaceProps) {
  return <LiveCard id={id} className="w-56" />
}

function CardStage({ id }: EntrySurfaceProps) {
  return <LiveCard id={id} className="w-80" />
}
