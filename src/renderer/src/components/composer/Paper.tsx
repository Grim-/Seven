import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useReorder } from '../ui'
import { entryLink } from '../../store/data'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'
import { useFileDrop } from '../../lib/useFileDrop'
import { importPaths } from '../../lib/importFiles'
import { droppedEntries, isEntryDrag } from '../../lib/entryDrag'
import { PadBlockView } from './PadBlockView'
import { useRollableKinds } from './useRollableKinds'
import type { Pad } from './pad'

export function Paper({ pad, head, className }: { pad: Pad; head?: ReactNode; className?: string }) {
  const rollable = useRollableKinds()
  const [wide, setWide] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [over, setOver] = useState(false)
  const reorder = useReorder(pad.move)
  const files = useFileDrop((paths) => void importPaths(paths).then((added) => pad.add(added.map((a) => entryLink('file', a.id)))))
  const dropEntries = (ids: string[]) =>
    void Promise.all(ids.map((id) => engine('library.resolve', { entry: id })))
      .then((found) => pad.add(found.map((f) => entryLink(f.kind, f.id))))
      .catch(failed('Could not add that'))
  return (
    <div
      className={cn('pad-paper', (over || files.over) && 'pad-over', className)}
      onDragOver={(e) => {
        if (!isEntryDrag(e)) return files.props.onDragOver(e)
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
        files.props.onDragLeave(e)
      }}
      onDrop={(e) => {
        if (!isEntryDrag(e)) return files.props.onDrop(e)
        e.preventDefault()
        setOver(false)
        dropEntries(droppedEntries(e))
      }}
    >
      {head}
      <div className="flex flex-wrap items-start gap-3">
        {pad.blocks.map((b, i) => (
          <PadBlockView key={b.key} block={b} pad={pad} rollable={rollable} drag={reorder.props(i)} over={reorder.isOver(i)} wide={wide[b.key]} onWide={(w) => setWide({ ...wide, [b.key]: w })} open={open[b.key] === true} onOpen={(o) => setOpen({ ...open, [b.key]: o })} />
        ))}
      </div>
      <div className="pad-hint">
        <button type="button" onClick={() => pad.add([''])} className="pad-add">
          <Plus className="h-3 w-3" /> Text
        </button>
        <span>drop anything here · type @ in text to link · right-click a block for more</span>
      </div>
    </div>
  )
}
