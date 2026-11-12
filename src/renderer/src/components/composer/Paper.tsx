import { useState, type ReactNode } from 'react'
import { Dices, FolderPlus, Plus } from 'lucide-react'
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
import { shapeOf, type Pad } from './pad'

export function Paper({ pad, head, className, onMenu }: { pad: Pad; head?: ReactNode; className?: string; onMenu?: () => void }) {
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

  const rollableBlocks = pad.blocks.filter((b) => {
    const s = shapeOf(b.text)
    return s.as === 'link' && rollable.has(s.kind)
  })

  const rollAll = () => {
    void engine('library.rollText', { text: pad.text })
      .then((r) => pad.load(r.text))
      .catch(failed('Could not roll items'))
  }

  return (
    <div
      className={cn('pad-paper', (over || files.over) && 'pad-over', className)}
      onContextMenu={(e) => {
        if (!onMenu) return
        e.preventDefault()
        onMenu()
      }}
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

      {/* Top Corkboard Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-3 mb-2 font-mono">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => pad.add([''])}
            className="flex items-center gap-1.5 border border-line/60 bg-black/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white hover:border-accent hover:bg-accent/15 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 text-accent" />
            + Text Note
          </button>
          {onMenu && (
            <button
              type="button"
              onClick={onMenu}
              className="flex items-center gap-1.5 border border-line/60 bg-black/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white hover:border-accent hover:bg-accent/15 transition-colors cursor-pointer"
            >
              <FolderPlus className="h-3.5 w-3.5 text-cyan" />
              + Add Entity
            </button>
          )}
          {rollableBlocks.length > 0 && (
            <button
              type="button"
              onClick={rollAll}
              className="flex items-center gap-1.5 border border-accent/60 bg-accent/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent hover:bg-accent/25 transition-colors cursor-pointer"
            >
              <Dices className="h-3.5 w-3.5" />
              Roll All ({rollableBlocks.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-dim">
          <span className="font-semibold text-white/80">{pad.blocks.length} {pad.blocks.length === 1 ? 'block' : 'blocks'}</span>
          <span>·</span>
          <span>~{Math.max(1, Math.round(pad.text.length / 4))} tokens</span>
          {pad.blocks.length > 0 && (
            <>
              <span>·</span>
              <button
                type="button"
                onClick={() => pad.load('')}
                className="text-faint hover:text-alert transition-colors cursor-pointer"
              >
                Clear Paper
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {pad.blocks.map((b, i) => (
          <PadBlockView key={b.key} block={b} pad={pad} rollable={rollable} drag={reorder.props(i)} over={reorder.isOver(i)} wide={wide[b.key]} onWide={(w) => setWide({ ...wide, [b.key]: w })} open={open[b.key] === true} onOpen={(o) => setOpen({ ...open, [b.key]: o })} />
        ))}
      </div>
      <div className="pad-hint">
        <button type="button" onClick={() => pad.add([''])} className="pad-add cursor-pointer">
          <Plus className="h-3 w-3" /> Text
        </button>
        {onMenu && (
          <button type="button" onClick={onMenu} className="pad-add cursor-pointer">
            <FolderPlus className="h-3 w-3" /> Entity
          </button>
        )}
        <span>drop anything onto corkboard · type @ in text to link · right-click a card for more options</span>
      </div>
    </div>
  )
}
