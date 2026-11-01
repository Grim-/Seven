import { useState } from 'react'
import { ChevronRight, Download, Plus, Trash2, Upload } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import { Button } from '../../components/ui'
import { KindIcon } from '../../lib/library'
import type { DataSelection } from '../../store/data'
import { kindUi } from '../../registries/kinds'
import { clearKind, exportMenuAt, kindMenuAt } from './entryMenu'

export function KindHeader({ section, selected, select, lead }: { section: LibrarySection; selected: DataSelection; select: (s: DataSelection | null) => void; lead?: React.ReactNode }) {
  const ui = kindUi(section.kind)
  const inEntry = selected.id !== 'all' && !ui.whole
  const add = ui.add?.(section.kind, select)
  const [importing, setImporting] = useState(false)
  const Importer = ui.importer
  const under = ui.railUnder ? kindUi(ui.railUnder.kind).rail?.label : undefined
  const Trail = ui.trail
  const home = () => (ui.back ? ui.back(selected) : select({ kind: section.kind, id: 'all' }))
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line/50 pb-2">
      {lead}
      <KindIcon name={section.icon} className="h-5 w-5 shrink-0 text-accent" />
      <button onClick={home} onContextMenu={(e) => kindMenuAt(e, section, select)} className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-white hover:text-accent">
        {under ?? section.plural}
      </button>
      {inEntry ? <ChevronRight className="h-4 w-4 text-faint" /> : <span className="font-mono text-[11px] text-faint">{section.count}</span>}
      {!inEntry && <span className="min-w-0 flex-1 truncate text-[12px] text-dim">{section.description}</span>}
      {inEntry && <span className="flex min-w-0 flex-1">{Trail && <Trail id={selected.id} />}</span>}
      {!inEntry && add && !ui.whole && (
        <Button size="sm" variant="primary" icon={<Plus />} onClick={add}>
          {ui.addLabel ?? `New ${section.label.toLowerCase()}`}
        </Button>
      )}
      {!inEntry && Importer && <Button size="sm" variant="ghost" icon={<Upload />} title={ui.importLabel ?? 'Add from JSON'} onClick={() => setImporting(true)} />}
      {importing && Importer && <Importer onClose={() => setImporting(false)} />}
      {!inEntry && section.exportable && section.count > 0 && <Button size="sm" variant="ghost" icon={<Download />} title="Export" onClick={(e) => exportMenuAt(e, section)} />}
      {!inEntry && section.removable && section.count > 0 && <Button size="sm" variant="ghost" icon={<Trash2 />} title={`Delete all ${section.plural.toLowerCase()}`} onClick={() => clearKind(section)} />}
    </div>
  )
}
