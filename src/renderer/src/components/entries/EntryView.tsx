import { Expand, ExternalLink } from 'lucide-react'
import type { EntryViewData } from '@shared/types'
import { EmptyState, SquareButton } from '../ui'
import { presentOf } from '../../registries/kinds'
import { registerPresentation, useStage, type PresentationProps } from '../../registries/presentations'
import { showInData } from '../../lib/library'
import { IN_APP } from '../../lib/mode'

function CantShow({ kind }: { kind: string }) {
  return <EmptyState title="Can't show this">A {kind} has no view here.</EmptyState>
}

export function EntryView({ data }: { data: unknown }) {
  const d = data as EntryViewData
  const { Chat, Stage } = presentOf(d.kind)
  if (!Chat) return <CantShow kind={d.kind} />
  return (
    <div className="group/entry flex flex-col gap-1">
      <Chat kind={d.kind} id={d.id} part={d.part} />
      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover/entry:opacity-100">
        {Stage && (
          <SquareButton title="Show on stage" onClick={() => useStage.getState().play({ type: 'entry', fields: { ...d }, where: 'stage', key: null })}>
            <Expand />
          </SquareButton>
        )}
        {IN_APP && (
          <SquareButton title="Open in Data" onClick={() => showInData({ kind: d.kind, id: d.id })}>
            <ExternalLink />
          </SquareButton>
        )}
      </div>
    </div>
  )
}

function EntryStage({ fields }: PresentationProps) {
  const d = fields as unknown as EntryViewData
  const { Stage } = presentOf(d.kind)
  return Stage ? <Stage kind={d.kind} id={d.id} part={d.part} /> : <CantShow kind={d.kind} />
}

registerPresentation('entry', EntryStage)
