import { cardPlayed, type DeckRef } from '@shared/cardDecks'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { decide, rollAction } from '../play/play'
import { playText, showPlay, type PlayWhere } from '../play/playStore'
import { CardPlayed } from './CardPlayed'
import type { Card } from './model'

export async function playCard(card: Card, ref: DeckRef, where: PlayWhere): Promise<void> {
  try {
    await engine('decks.take', { ref, card: card.name })
  } catch (err) {
    return failed('Could not play the card')(err)
  }
  const played: PlayWhere = { ...where, deck: ref, lead: cardPlayed(card.name) }
  if (card.use === 'action' && card.action) return rollAction(card.action, card.action.by ? null : (where.sheet ?? null), played)
  if (card.use === 'decision' && card.decision) return decide(card.decision, played)
  const { text } = await engine('library.rollText', { text: card.prompt || (typeof card.raw.text === 'string' ? card.raw.text : card.name) })
  if (where.onText) return where.onText(playText(played, text))
  showPlay(card.name, <CardPlayed text={text} where={played} />)
}
