import { useState } from 'react'
import { Send, X } from 'lucide-react'
import type { GatherAnswer, GatherItem, GatherProps, UiRequestState } from '@shared/types'
import { Button, Input } from '../ui'
import { KindIcon } from '../../lib/library'
import { sourceInput } from '../../registries/sources'
import { cn } from '../../lib/cn'

export function GatherCard({ ui, answer }: { ui: UiRequestState; answer: (value: unknown, fallback: string) => Promise<void> }) {
  const props = ui.props as GatherProps
  const open = ui.status === 'pending' || ui.status === 'expired'
  const given = ui.status === 'answered' ? (ui.answer as GatherAnswer) : null
  const [tab, setTab] = useState(props.sources[0]?.kind ?? '')
  const [items, setItems] = useState<GatherItem[]>([])
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const iconOf = (source: string) => props.sources.find((s) => s.kind === source)?.icon ?? 'box'
  const Input_ = sourceInput(tab)

  const send = async (value: GatherAnswer, fallback: string) => {
    setSending(true)
    await answer(value, fallback)
    setSending(false)
  }

  if (!open) {
    const summary = ui.status === 'cancelled' ? 'Cancelled' : given?.declined != null ? `Declined${given.declined ? `: ${given.declined}` : ''}` : `Gave ${given?.items.length ?? 0}: ${given?.items.map((i) => i.title).join(', ') ?? ''}`
    return (
      <div className="flex flex-col gap-1.5">
        <div className="text-[13.5px] text-white">{props.purpose}</div>
        <div className="font-mono text-[11px] text-dim">{summary}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent-soft">Needs data</div>
        <div className="text-[14px] leading-snug text-white">{props.purpose}</div>
        {props.wants && <div className="mt-0.5 text-[12.5px] text-dim">{props.wants}</div>}
      </div>
      {items.length > 0 && (
        <div className="flex flex-col gap-1 border border-line/40 p-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-1.5 py-0.5 text-[12.5px] text-white/85">
              <KindIcon name={iconOf(item.source)} className="h-3.5 w-3.5 shrink-0 text-teal/70" />
              <span className="truncate">{item.title}</span>
              <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="ml-auto text-faint hover:text-alert">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {props.sources.map((s) => (
          <button key={s.kind} onClick={() => setTab(s.kind)} className={cn('flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.12em]', tab === s.kind ? 'border-accent bg-accent/10 text-white' : 'border-line/40 text-dim hover:text-white')}>
            <KindIcon name={s.icon} className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>
      {Input_ ? <Input_ onAdd={(item) => setItems((list) => [...list, item])} /> : <div className="text-[12px] text-faint">This source can't be filled in here.</div>}
      {declining ? (
        <div className="flex gap-1.5">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why not (optional)" />
          <Button size="sm" variant="secondary" disabled={sending} onClick={() => void send({ items: [], declined: reason.trim() }, `${props.purpose}\nI'm not giving that data${reason.trim() ? `: ${reason.trim()}` : '.'}`)}>
            Decline
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
            Back
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button variant="primary" icon={<Send />} disabled={!items.length || sending} onClick={() => void send({ items, declined: null }, `${props.purpose}\nHere it is:\n\n${items.map((i) => (typeof i.data.text === 'string' ? i.data.text : i.title)).join('\n\n')}`)}>
            Send {items.length || ''}
          </Button>
          <Button variant="ghost" onClick={() => setDeclining(true)}>
            Decline
          </Button>
        </div>
      )}
    </div>
  )
}
