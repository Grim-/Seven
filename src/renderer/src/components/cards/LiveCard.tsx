import type { CardLayout } from '@shared/cards'
import type { FaceEdit } from '../ui'
import { usePage } from '../../store/data'
import { CardFace } from './CardFace'
import { CardSections } from './CardSections'
import { cardLabel, legacyLayout, playText, readCard, useLayoutNamed, type Card } from './model'

export function CardOf({ card, layout, edit, form, className }: { card: Card; layout: CardLayout | null; edit?: FaceEdit; form?: string | null; className?: string }) {
  const prompt = playText(card)
  const sections = <CardSections card={card} only={form} />
  if (layout) return <CardFace name={card.name} label={cardLabel(card)} layout={layout} values={card.values} color={card.color} prompt={prompt} sections={sections} edit={edit} className={className} />
  const legacy = legacyLayout(card.raw)
  return <CardFace name={card.name} label={cardLabel(card)} layout={legacy.layout} values={legacy.values} art={typeof card.raw.art === 'string' && card.raw.art ? card.raw.art : null} prompt={prompt} sections={sections} edit={edit} className={className} />
}

export function LiveCard({ id, className }: { id: string; className?: string }) {
  const page = usePage(id)
  const card = page ? readCard(page.data, page.title) : null
  const layout = useLayoutNamed(card?.layout ?? null)
  if (!card) return <div className="font-mono text-[11px] text-dim">{page === null ? 'This card no longer exists.' : 'Loading…'}</div>
  return <CardOf card={card} layout={layout} className={className} />
}
