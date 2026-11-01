import { useEffect, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { EmptyState, TagInput, openMenu } from '../../components/ui'
import { Markdown } from '../../components/chat/Markdown'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { onLibraryChange } from '../../lib/library'
import type { DataSelection } from '../../store/data'
import { entryActions } from './entryMenu'
import { useKindEntries } from './useKindEntries'
import { failed } from '../../lib/notify'

export function EntryView({ section, id, selected, select }: { section: LibrarySection; id: string; selected: DataSelection | null; select: (s: DataSelection | null) => void }) {
  const list = useKindEntries(section.kind)
  const hit = list?.find((h) => h.id === id)
  const [text, setText] = useState<string | null>(null)
  const entry = `${section.kind}/${id}`
  useEffect(() => {
    let live = true
    const load = () =>
      void engine('library.read', { entry })
        .then((t) => live && setText(t))
        .catch((err) => live && setText(errorText(err)))
    load()
    const off = onLibraryChange(load)
    return () => {
      live = false
      off()
    }
  }, [entry])
  if (list && !hit) return <EmptyState title="Gone">This {section.label.toLowerCase()} no longer exists.</EmptyState>
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 border border-line/60 bg-black/70 p-4">
      <div className="flex items-center gap-3">
        <h2 onContextMenu={(e) => hit && openMenu(e, showName(hit.title), entryActions(section, hit, { open: () => undefined, select, selected }).slice(1))} className="min-w-0 flex-1 truncate text-[20px] font-semibold text-white">{showName(hit?.title ?? id)}</h2>
        {hit && (
          <button title="More" onClick={(e) => openMenu(e, showName(hit.title), entryActions(section, hit, { open: () => undefined, select, selected }).slice(1))} className="flex h-8 w-8 items-center justify-center text-dim hover:text-white">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>
      {hit && <TagInput value={hit.tags ?? []} onChange={(tags) => void engine('tags.set', { entry, tags }).catch(failed('Could not tag'))} placeholder="Tags" />}
      <div className="min-h-0 flex-1 overflow-y-auto border border-line/40 bg-black/40 p-4 text-[13.5px]">{text === null ? <span className="font-mono text-[11px] text-dim">Loading…</span> : <Markdown text={text} />}</div>
      <div className="text-[11.5px] text-faint">This is exactly what an agent sees when it reads it.</div>
    </div>
  )
}
