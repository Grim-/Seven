import { registerWidgetUi, type WidgetBodyProps } from '../../registries/widgets'
import type { PartViewData } from '@shared/types'
import { EmptyState } from '../ui'
import { presentOf } from '../../registries/kinds'
import { TextPart } from './TextPart'

function PartWidgetBody({ widget }: WidgetBodyProps) {
  const s = widget.source
  return (
    <div className="h-full overflow-y-auto">
      <PartView data={{ kind: String(s.entry), id: String(s.id), part: String(s.part), text: null }} />
    </div>
  )
}

registerWidgetUi('part', { Body: PartWidgetBody, entry: (s) => `${String(s.entry)}/${String(s.id)}` })

export function PartView({ data }: { data: unknown }) {
  const d = data as PartViewData
  if (d.text !== null && d.text !== undefined) return <TextPart entry={`${d.kind}/${d.id}`} />
  const { Chat } = presentOf(d.kind)
  if (Chat) return <Chat kind={d.kind} id={d.id} part={d.part} />
  return <EmptyState title="Can't show this">A {d.kind} has no view here.</EmptyState>
}
