import type { ReactNode } from 'react'
import type { CompendiumKind } from '@shared/compendium'
import { engine } from '../../../../lib/ipc'
import { useLive } from '../../../../lib/useLive'
import { EntryView } from '../../../dnd/EntryView'
import type { CompendiumList } from '../../../dnd/useCompendiumList'
import { CompendiumLink } from './CompendiumLink'

export function CompendiumDetail({ kind, id }: { kind: CompendiumKind; id: string }) {
  const got = useLive(() => engine('dnd.get', { kind, id }), 'dnd.changed')
  if (!got) return <div className="text-[12px] text-faint">Loading…</div>
  return (
    <div className="flex flex-col gap-2 border-l-2 border-accent/40 bg-black/30 px-3 py-2 text-[13px]">
      <EntryView kind={kind} entry={got.entry} />
      <CompendiumLink kind={kind} id={id} />
    </div>
  )
}

export function detailFor(kind: CompendiumKind, list: CompendiumList): (row: { name: string }) => ReactNode | null {
  return (row) => {
    const ref = list.find(row.name)
    return ref ? <CompendiumDetail kind={kind} id={ref.id} /> : null
  }
}
