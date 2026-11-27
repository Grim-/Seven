import type { MouseEvent } from 'react'
import { toId, showName } from '@shared/ids'
import { FaceCount, FaceGrid } from '../ui'
import { usePage } from '../../store/data'
import type { KindScreenProps } from '../../registries/kinds'
import { AddonPage } from '../data/AddonPage'
import { LiveCard } from './LiveCard'
import { CountsEditor } from './CountsEditor'
import { DeckEditor } from './DeckEditor'
import { CARD_TYPE, readCounts, useTypePages } from './model'

export function SetScreen({ id }: KindScreenProps) {
  return <AddonPage id={id} what="card set" read={readCounts} render={(page) => <CountsEditor {...page} what="set" />} />
}

export function DeckScreen({ id }: KindScreenProps) {
  return <DeckEditor id={id} />
}

export function CountCards({ id, onCardMenu }: { id: string; onCardMenu?: (e: MouseEvent, card: string, cardId: string | null) => void }) {
  const page = usePage(id)
  const cards = useTypePages(CARD_TYPE)
  if (!page) return null
  const list = readCounts(page.data, page.title)
  return (
    <FaceGrid>
      {list.cards.map((e) => {
        const meta = cards.find((c) => toId(c.title) === toId(e.card))
        return (
          <div key={e.card} className="relative" title={showName(e.card)} onContextMenu={onCardMenu ? (ev) => onCardMenu(ev, e.card, meta?.id ?? null) : undefined}>
            {meta ? <LiveCard id={meta.id} /> : <div className="font-ui text-[11px] text-dim">{showName(e.card)} (missing)</div>}
            <FaceCount count={e.count} />
          </div>
        )
      })}
    </FaceGrid>
  )
}
