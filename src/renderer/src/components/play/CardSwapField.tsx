import { useState } from 'react'
import { parseSwap, swapText, type CardSwap } from '@shared/cardDecks'
import { Input } from '../ui'
import { cn } from '../../lib/cn'

export function CardSwapField({ value, onChange, className }: { value: CardSwap; onChange: (swap: CardSwap) => void; className?: string }) {
  const [text, setText] = useState(swapText(value))
  return (
    <Input
      value={text}
      placeholder="Cards: gain Potion; lose Homestone"
      title="Cards the deck gains or loses when this comes up"
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseSwap(e.target.value))
      }}
      className={cn('h-7 font-mono text-[11.5px]', className)}
    />
  )
}
