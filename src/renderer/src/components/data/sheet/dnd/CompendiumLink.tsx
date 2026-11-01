import { BookOpen } from 'lucide-react'
import { compendiumInfo, type CompendiumKind } from '@shared/compendium'
import { openEntry } from '../../../../lib/library'

export function CompendiumLink({ kind, id }: { kind: CompendiumKind; id: string }) {
  return (
    <button onClick={() => openEntry(kind, id)} className="flex items-center gap-1.5 self-start text-[11.5px] text-faint hover:text-accent">
      <BookOpen className="h-3.5 w-3.5" /> Open in {compendiumInfo(kind)?.plural ?? 'Data'}
    </button>
  )
}
