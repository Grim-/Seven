import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui'

export function DecisionCardFrame({
  tag,
  note,
  question,
  status,
  onClose,
  children
}: {
  tag: string
  note?: string
  question: string
  status?: ReactNode
  onClose?: () => void
  children: ReactNode
}) {
  return (
    <div className="my-2 flex flex-col border border-accent/60 tone-panel-60">
      <div className="flex items-center gap-2 border-b border-line/60 px-3 py-2">
        <span className="bg-accent px-1.5 py-0.5 font-label text-[10px] font-bold caps-16 text-on-accent">{tag}</span>
        {note && <span className="font-label text-[10.5px] caps-14 text-dim">{note}</span>}
        <span className="flex-1" />
        {status && <span className="font-ui text-[10.5px]">{status}</span>}
        {onClose && <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} title="Close (come back later)" onClick={onClose} />}
      </div>
      <div className="px-3 pt-2.5 text-[15px] font-semibold leading-snug text-ink">{question}</div>
      <div className="flex flex-col gap-2 p-3">{children}</div>
    </div>
  )
}
