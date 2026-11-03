import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ActionBar } from '../ui'
import { closePlay, playText, type PlayWhere } from '../play/playStore'
import { playOutItem } from '../play/playOut'

export function PlayedCard<A>({ view, text, where }: { view: (done: A | null, onAnswer: (value: A) => Promise<void>) => ReactNode; text: (value: A) => Promise<string>; where: PlayWhere }) {
  const [done, setDone] = useState<A | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const onAnswer = async (value: A) => {
    const t = await text(value)
    setDone(value)
    if (!where.onText) return setSaid(t)
    where.onText(playText(where, t))
    closePlay()
  }
  return (
    <div className="flex flex-col gap-2">
      {view(done, onAnswer)}
      {said && <ActionBar items={[playOutItem(said, where), { label: 'Close', icon: <X />, onSelect: closePlay }]} />}
    </div>
  )
}
