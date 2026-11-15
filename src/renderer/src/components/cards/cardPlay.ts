import type { ChatElement } from '@shared/chatElements'
import type { Conversation } from '../../lib/conversation'
import { sendOrQueue } from '../../lib/sendOrQueue'
import type { PlayOutcome, PlayTone } from '../play/playStore'
import type { Card } from './model'

export const CARD_PLAY = 'card_play'

const TONES: PlayTone[] = ['ok', 'alert', 'purple', 'cyan']

export function cardPlayElement(card: Card, said: string, outcome: PlayOutcome): ChatElement {
  return { type: CARD_PLAY, data: { card: card.name, said, outcome, hidden: card.hideInstructions } }
}

export function readOutcome(value: unknown): PlayOutcome | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Partial<PlayOutcome>
  if (typeof o.label !== 'string' || !TONES.includes(o.tone as PlayTone)) return null
  const effects = Array.isArray(o.effects) ? o.effects.filter((e): e is string => typeof e === 'string') : []
  return { tone: o.tone as PlayTone, label: o.label, detail: typeof o.detail === 'string' ? o.detail : '', effects }
}

export function chatPlay(conv: Conversation, card: Card, send: boolean) {
  let text: string | null = null
  let said = ''
  return {
    text: (next: string) => {
      text = next
    },
    said: (next: string | null) => {
      said = next ?? ''
    },
    done: (outcome: PlayOutcome | null) => {
      if (text === null) return
      sendOrQueue(conv, text, send, outcome ? [cardPlayElement(card, said, outcome)] : [])
      text = null
    }
  }
}
