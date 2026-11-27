import { X } from 'lucide-react'
import { ActionBar } from '../ui'
import { Markdown } from '../chat/Markdown'
import { closePlay, type PlayWhere } from '../play/playStore'
import { playOutItem } from '../play/playOut'

export function CardPlayed({ text, where }: { text: string; where: PlayWhere }) {
  return (
    <div className="flex flex-col gap-3">
      <Markdown text={text} className="border border-secondary-ink/30 bg-secondary-ink/[0.05] px-2.5 py-2 text-[13px] leading-relaxed text-ink/90" />
      <ActionBar items={[playOutItem(text, where), { label: 'Close', icon: <X />, onSelect: closePlay }]} />
    </div>
  )
}
