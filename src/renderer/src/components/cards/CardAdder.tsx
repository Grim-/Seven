import { useState, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { showName } from '@shared/ids'
import { countOf, type DeckEntry } from '@shared/cardDecks'
import { Eyebrow, Input } from '../ui'
import { CARD_TYPE, useTypePages } from './model'

export function CardAdder({ have, onAdd, onMenu }: { have: DeckEntry[]; onAdd: (card: string) => void; onMenu: (e: MouseEvent, card: string) => void }) {
  const cards = useTypePages(CARD_TYPE)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? cards.filter((c) => showName(c.title).toLowerCase().includes(q)) : cards
  return (
    <div className="flex min-h-0 w-64 shrink-0 flex-col gap-2 border-l border-line/40 pl-4 phone:max-h-64 phone:w-full phone:border-l-0 phone:border-t phone:pl-0 phone:pt-3">
      <Eyebrow>Add cards</Eyebrow>
      <Input value={query} placeholder="Find a card" onChange={(e) => setQuery(e.target.value)} className="h-8 text-[12.5px]" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length ? (
          shown.map((c) => {
            const n = countOf(have, c.title)
            return (
              <button key={c.id} type="button" className="shell-row flex w-full items-center gap-2 px-1.5 py-1.5 text-left text-[12.5px]" onClick={() => onAdd(c.title)} onContextMenu={(e) => onMenu(e, c.title)}>
                <Plus className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate">{showName(c.title)}</span>
                {n > 0 && <span className="font-mono text-[11px] font-bold text-accent">×{n}</span>}
              </button>
            )
          })
        ) : (
          <div className="px-1.5 text-[12.5px] text-dim">{cards.length ? 'No card matches.' : 'No cards yet. Make some with New page → Card.'}</div>
        )}
      </div>
    </div>
  )
}
