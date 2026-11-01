import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { toId } from '@shared/ids'
import type { DeckEntry } from '@shared/cardDecks'
import { FaceCount } from '../ui'
import { usePage } from '../../store/data'
import { cn } from '../../lib/cn'
import { CardOf } from './LiveCard'
import { CARD_TYPE, USE_VERB, readCard, useLayoutNamed, useTypePages, type Card } from './model'

const BURN_MS = 1100
const DRAG_PLAY = -70
const SPREAD = 600

interface CardProps {
  id: string
  count: number
  style: CSSProperties
  buttons: boolean
  burning: boolean
  onPlay: (card: Card) => void
}

function HandCard({ id, count, style, buttons, burning, onPlay }: CardProps) {
  const page = usePage(id)
  const card = page ? readCard(page.data, page.title) : null
  const layout = useLayoutNamed(card?.layout ?? null)
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  if (!card) return null
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    start.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const up = () => {
    if (start.current === null) return
    start.current = null
    setDy(0)
    if (dy < DRAG_PLAY || (!buttons && dy > -4)) onPlay(card)
  }
  return (
    <div
      className="card-hand-card"
      data-burning={burning || undefined}
      data-dragging={dy < 0 || undefined}
      style={{ ...style, '--dy': `${dy}px` } as CSSProperties}
      onPointerDown={down}
      onPointerMove={(e) => start.current !== null && setDy(Math.min(0, e.clientY - start.current))}
      onPointerUp={up}
      onPointerCancel={() => {
        start.current = null
        setDy(0)
      }}
    >
      <CardOf card={card} layout={layout} />
      <FaceCount count={count > 1 ? count : undefined} />
      {buttons && (
        <button type="button" className="card-hand-go" data-use={card.use} onClick={() => onPlay(card)}>
          {USE_VERB[card.use]}
        </button>
      )}
    </div>
  )
}

export function CardHand({ entries, onPlay, buttons = false, disabled = false, className }: { entries: DeckEntry[]; onPlay: (card: Card) => Promise<void> | void; buttons?: boolean; disabled?: boolean; className?: string }) {
  const cards = useTypePages(CARD_TYPE)
  const [burning, setBurning] = useState<string | null>(null)
  const held = entries.flatMap((e) => {
    const meta = cards.find((c) => toId(c.title) === toId(e.card))
    return meta ? [{ id: meta.id, count: e.count }] : []
  })
  if (!held.length) return null
  const step = Math.min(70, SPREAD / held.length)
  const play = (id: string, card: Card) => {
    if (burning) return
    setBurning(id)
    window.setTimeout(() => void Promise.resolve(onPlay(card)).finally(() => setBurning(null)), BURN_MS)
  }
  return (
    <div className={cn('card-hand', className)} data-disabled={disabled || undefined}>
      <div className="card-hand-fan">
        {held.map((h, i) => {
          const at = i - (held.length - 1) / 2
          return <HandCard key={h.id} id={h.id} count={h.count} buttons={buttons} burning={burning === h.id} style={{ '--x': `${at * step}px`, '--r': `${at * 6}deg`, zIndex: i } as CSSProperties} onPlay={(card) => play(h.id, card)} />
        })}
      </div>
    </div>
  )
}
