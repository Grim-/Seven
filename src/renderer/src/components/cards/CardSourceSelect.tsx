import { showName } from '@shared/ids'
import { cleanCardSource, type CardSource } from '@shared/cardDecks'
import { Select } from '../ui'
import { DECK_TYPE, SET_TYPE, useTypePages } from './model'

const valueOf = (s: CardSource | null) => (!s ? '' : s.from === 'character' ? 'character' : `${s.from}:${s.id}`)

function parse(value: string): CardSource | null {
  const [from, id] = value.split(/:(.*)/s)
  return cleanCardSource({ from, id })
}

export function CardSourceSelect({ value, onChange, className }: { value: CardSource | null; onChange: (source: CardSource | null) => void; className?: string }) {
  const decks = useTypePages(DECK_TYPE)
  const sets = useTypePages(SET_TYPE)
  const options = [
    { value: '', label: 'No cards' },
    { value: 'character', label: "Your character's deck" },
    ...decks.map((d) => ({ value: `deck:${d.id}`, label: `Deck: ${showName(d.title)}` })),
    ...sets.map((s) => ({ value: `set:${s.id}`, label: `New deck from set: ${showName(s.title)}` }))
  ]
  return <Select value={valueOf(value)} options={options} onChange={(v) => onChange(parse(v))} className={className} />
}
