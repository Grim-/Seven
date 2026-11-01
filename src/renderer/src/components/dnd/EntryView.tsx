import type { CompendiumEntry, CompendiumKind } from '@shared/compendium'
import { EntryText } from './EntryText'
import { FactTable } from './FactTable'

export function EntryView({ kind, entry }: { kind: CompendiumKind; entry: CompendiumEntry }) {
  return (
    <div className="flex flex-col gap-4">
      <FactTable kind={kind} entry={entry} />
      {entry.text ? <EntryText text={entry.text} owner={entry.name} /> : <div className="text-[13px] text-faint">No description.</div>}
    </div>
  )
}
