import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { hitDetail, type LibraryHit } from '@shared/types'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { Button, EmptyState, Panel, ListRow } from '../ui'
import { Markdown } from '../chat/Markdown'
import { rowMenu } from '../../views/data/entryMenu'
import { noteFailure } from '../../store/problems'

export function KindBrowser({ kind, title, empty, initial = null }: { kind: string; title: string; empty: string; initial?: string | null }) {
  const [list, setList] = useState<LibraryHit[] | null>(null)
  const [selected, setSelected] = useState<string | null>(initial)
  const [text, setText] = useState('')
  const load = () =>
    void engine('library.find', { query: '', kind })
      .then(setList)
      .catch(noteFailure('library', 'Could not list them', () => setList([])))
  useEffect(load, [kind])
  useEffect(() => {
    if (!selected) return setText('')
    void engine('library.read', { entry: `${kind}/${selected}` })
      .then(setText)
      .catch((err) => setText(errorText(err)))
  }, [kind, selected, list])
  return (
    <Panel
      className="min-w-0 flex-1"
      title={title}
      meta={list ? `${list.length}` : undefined}
      actions={<Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={load} />}
      bodyClassName="flex min-h-0 gap-3 p-3"
    >
      <div className="flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto">
        {list && !list.length && <div className="text-[12px] text-faint">{empty}</div>}
        {list?.map((h) => (
          <ListRow key={h.id} active={selected === h.id} onClick={() => setSelected(h.id)} onMenu={rowMenu(kind, h.id, h.title, () => setSelected(h.id))} title={h.title} subtitle={hitDetail(h)} wrap />
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto">
        {selected ? (
          <div className="border border-line/40 bg-black/40 p-4">
            <Markdown text={text} />
          </div>
        ) : (
          <EmptyState title="Nothing selected">Pick one on the left.</EmptyState>
        )}
      </div>
    </Panel>
  )
}
