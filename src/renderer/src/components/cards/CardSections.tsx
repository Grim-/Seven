import { moduleOn } from '../../lib/moduleOn'
import { CardSection } from './CardSection'
import { cardVariations } from './variations'
import type { Card } from './model'

export function CardSections({ card, only }: { card: Card; only?: string | null }) {
  const list = cardVariations.on(moduleOn).filter((v) => v.Face && v.has(card.raw) && (only === undefined || v.id === only))
  if (!list.length) return null
  return (
    <>
      {list.map((v) =>
        v.Face ? (
          <CardSection key={v.id} label={v.label} open={only !== undefined}>
            <v.Face card={card} />
          </CardSection>
        ) : null
      )}
    </>
  )
}
