import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import type { DeckEntry } from '@shared/cardDecks'
import { FaceCount } from '../ui'
import { usePage } from '../../store/data'
import { cn } from '../../lib/cn'
import { CardOf } from './LiveCard'
import { USE_VERB, readCard, useLayoutNamed, type Card } from './model'
import { useHeldCards } from './useHeldCards'
import { useEscapeLayer } from '../../lib/escape'
import type { CardForm } from './cardForms'
import type { CardVariation } from './variations'

const BURN_MS = 1100
const DRAG_PLAY = -70
const SPREAD = 600

export type PlayChosen = (card: Card, form?: CardVariation | null) => Promise<void> | void

interface CardProps {
  id: string
  count: number
  style: CSSProperties
  buttons: boolean
  burning: boolean
  formsFor?: (card: Card) => Promise<CardForm[]>
  onPlay: PlayChosen
  onMenu?: (e: MouseEvent, card: Card) => void
}

function FormFan({ card, layout, forms, onPick }: { card: Card; layout: ReturnType<typeof useLayoutNamed>; forms: CardForm[]; onPick: (form: CardForm) => void }) {
  const step = 104
  return (
    <div className="card-hand-forms">
      {forms.map((form, i) => {
        const at = i - (forms.length - 1) / 2
        return (
          <button
            key={form.id}
            type="button"
            className="card-hand-form"
            data-blocked={form.blocked ? true : undefined}
            disabled={!!form.blocked}
            title={form.blocked ?? `Play as ${form.label}`}
            style={{ '--fx': `${at * step}px`, '--fr': `${at * 9}deg` } as CSSProperties}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onPick(form)
            }}
          >
            <span className="card-hand-form-body">
              <CardOf card={card} layout={layout} form={form.variation?.id ?? null} />
              <span className="card-hand-form-label">
                {form.label}
                {form.blocked && <span className="card-hand-form-why">{form.blocked}</span>}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function HandCard({ id, count, style, buttons, burning, formsFor, onPlay, onMenu }: CardProps) {
  const page = usePage(id)
  const card = page ? readCard(page.data, page.title) : null
  const layout = useLayoutNamed(card?.layout ?? null)
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  const self = useRef<HTMLDivElement | null>(null)
  const [forms, setForms] = useState<CardForm[] | null>(null)
  useEscapeLayer(forms !== null, () => setForms(null))
  useEffect(() => {
    if (!forms) return
    const away = (e: globalThis.PointerEvent) => {
      if (!self.current?.contains(e.target as Node)) setForms(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [forms])
  if (!card) return null
  const choose = async () => {
    if (forms) return setForms(null)
    if (!formsFor) return onPlay(card)
    const list = await formsFor(card)
    if (list.length >= 2) return setForms(list)
    onPlay(card, list[0]?.variation ?? undefined)
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    start.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const up = () => {
    if (start.current === null) return
    start.current = null
    setDy(0)
    if (dy < DRAG_PLAY || (!buttons && dy > -4)) void choose()
  }
  return (
    <div
      ref={self}
      className="card-hand-card"
      data-burning={burning || undefined}
      data-choosing={forms ? true : undefined}
      data-dragging={dy < 0 || undefined}
      style={{ ...style, '--dy': `${dy}px` } as CSSProperties}
      onPointerDown={down}
      onPointerMove={(e) => start.current !== null && setDy(Math.min(0, e.clientY - start.current))}
      onPointerUp={up}
      onContextMenu={onMenu ? (e) => onMenu(e, card) : undefined}
      onPointerCancel={() => {
        start.current = null
        setDy(0)
      }}
    >
      <div className="card-hand-lift">
        {forms && (
          <FormFan
            card={card}
            layout={layout}
            forms={forms}
            onPick={(form) => {
              setForms(null)
              onPlay(card, form.variation)
            }}
          />
        )}
        <div className="card-hand-main">
          <CardOf card={card} layout={layout} />
        </div>
        <FaceCount count={count > 1 ? count : undefined} />
        {buttons && (
          <button type="button" className="card-hand-go" data-use={card.use} onClick={() => void choose()}>
            {USE_VERB[card.use]}
          </button>
        )}
      </div>
    </div>
  )
}

export function CardHand({ entries, onPlay, formsFor, onMenu, aside, buttons = false, disabled = false, burns = true, className }: { entries: DeckEntry[]; onPlay: PlayChosen; formsFor?: (card: Card) => Promise<CardForm[]>; onMenu?: (e: MouseEvent, card: Card) => void; aside?: ReactNode; buttons?: boolean; disabled?: boolean; burns?: boolean; className?: string }) {
  const [burning, setBurning] = useState<string | null>(null)
  const held = useHeldCards(entries)
  if (!held.length && !aside) return null
  const step = Math.min(70, SPREAD / held.length)
  const play = (id: string, card: Card, form?: CardVariation | null) => {
    if (burning) return
    if (card.ask || !burns) return void onPlay(card, form)
    setBurning(id)
    window.setTimeout(() => void Promise.resolve(onPlay(card, form)).finally(() => setBurning(null)), BURN_MS)
  }
  return (
    <div className={cn('card-hand', className)} data-disabled={disabled || undefined}>
      <div className="card-hand-fan">
        {held.map((h, i) => {
          const at = i - (held.length - 1) / 2
          return <HandCard key={h.id} id={h.id} count={h.count} buttons={buttons} burning={burning === h.id} formsFor={formsFor} style={{ '--x': `${at * step}px`, '--r': `${at * 6}deg`, zIndex: i } as CSSProperties} onPlay={(card, form) => play(h.id, card, form)} onMenu={onMenu} />
        })}
      </div>
      {aside && <div className="card-hand-aside">{aside}</div>}
    </div>
  )
}
