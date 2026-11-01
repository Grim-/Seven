import type { CardLayout } from '@shared/cards'
import { usePage } from '../../store/data'
import { CardFace } from './CardFace'
import { cardLabel, legacyLayout, readCard, useLayoutNamed, type Card } from './model'

export function CardOf({ card, layout, className }: { card: Card; layout: CardLayout | null; className?: string }) {
  if (layout) return <CardFace name={card.name} label={cardLabel(card)} layout={layout} values={card.values} color={card.color} className={className} />
  const legacy = legacyLayout(card.raw)
  return <CardFace name={card.name} label={cardLabel(card)} layout={legacy.layout} values={legacy.values} art={typeof card.raw.art === 'string' && card.raw.art ? card.raw.art : null} className={className} />
}

export function LiveCard({ id, className }: { id: string; className?: string }) {
  const page = usePage(id)
  const card = page ? readCard(page.data, page.title) : null
  const layout = useLayoutNamed(card?.layout ?? null)
  if (!card) return <div className="font-mono text-[11px] text-dim">{page === null ? 'This card no longer exists.' : 'Loading…'}</div>
  return <CardOf card={card} layout={layout} className={className} />
}
