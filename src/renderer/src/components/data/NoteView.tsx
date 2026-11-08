import { IN_APP } from '../../lib/mode'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { CheckCheck, Pencil } from 'lucide-react'
import type { Page } from '@shared/types'
import { AddressTools, Button, EmptyState, DoneEditing, useAutosavedState } from '../ui'
import { Markdown, countDone, removeDone, type LineEdit } from '../chat/Markdown'
import { rollAll } from './useRolls'
import { MarkdownEditor } from './MarkdownEditor'
import { DocContents } from './DocContents'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { findPage, useData, usePage } from '../../store/data'
import { failed } from '../../lib/notify'
import { useBusy } from '../../lib/useBusy'
import { showInData } from '../../lib/library'
import { cn } from '../../lib/cn'
import { showName } from '@shared/ids'

export const PageNav = createContext<((ref: string) => void) | null>(null)


export function openPageInData(ref: string): void {
  const page = findPage(useData.getState().pages, ref)
  if (!page) {
    toast.error('No such page', ref)
    return
  }
  showInData({ kind: 'page', id: page.id })
}

export function usePageNav(): ((ref: string) => void) | undefined {
  const nav = useContext(PageNav)
  return nav ?? (IN_APP ? openPageInData : undefined)
}

export function NoteBody({
  page,
  maxHeight = 'max-h-[420px]',
  startEditing = false,
  readOnly = false,
  heading = true,
  contents = false,
  bar = false,
  className
}: {
  page: Page
  maxHeight?: string
  startEditing?: boolean
  readOnly?: boolean
  heading?: boolean
  contents?: boolean
  bar?: boolean
  className?: string
}) {
  const nav = usePageNav()
  const [editing, setEditing] = useState(startEditing)
  const write = (body: string) => engine('data.pages.write', { id: page.id, title: null, body })
  const editor = useAutosavedState(page.body, write)
  const text = editor.value
  const [busy, run] = useBusy()

  const editLines: LineEdit = (change) => {
    const next = change(page.body.split('\n')).join('\n')
    if (next === page.body) return
    void engine('data.pages.write', { id: page.id, title: null, body: next }).catch(failed('Could not save'))
  }

  const done = countDone(page.body)

  useEffect(() => {
    if (!editing) editor.reset(page.body)
  }, [page.body, editing])

  const save = () =>
    run(async () => {
      const body = await rollAll(text)
      if (body !== text) await write(body)
      setEditing(false)
    }, 'Could not save')

  const doc = useRef<HTMLDivElement>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const actions = (
    <div className={readOnly ? 'hidden' : 'ml-auto flex items-center gap-1.5'}>
      {editing ? (
        <DoneEditing saver={editor} onDone={() => void save()} disabled={busy} />
      ) : (
        <>
          {done > 0 && (
            <Button size="sm" variant="ghost" icon={<CheckCheck />} onClick={() => editLines(removeDone)} title="Remove every ticked item">
              Remove done ({done})
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        </>
      )}
    </div>
  )

  return (
    <div className={cn('relative flex min-h-0 flex-col gap-2', className)}>
      {bar ? (
        <AddressTools order={1}>{actions}</AddressTools>
      ) : (
        <div className={heading || editing ? 'flex items-center gap-2' : readOnly ? 'hidden' : 'absolute right-1 top-1 z-10 flex'}>
          {heading && <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-white">{page.title}</span>}
          {actions}
        </div>
      )}
      {editing ? (
        <MarkdownEditor
          value={text}
          onValue={editor.set}
          onSave={() => void saveRef.current()}
          title={bar ? undefined : showName(page.title)}
          bar={bar}
          autoFocus
          placeholder='Write here, or type / for blocks. @kind:Name links anything, e.g. @page:"Page title"; @kind:Name#random rolls a value from it when you press Done.'
          className="min-h-64 flex-1"
        />
      ) : (
        <div className={`${maxHeight} flex gap-6 overflow-auto`}>
          <div ref={doc} className="min-w-0 flex-1">
            {page.body.trim() ? <Markdown text={page.body} onPage={nav} onLines={readOnly ? undefined : editLines} className="prose-doc" /> : <span className="text-dim">No text yet.</span>}
          </div>
          {contents && <DocContents text={page.body} doc={doc} />}
        </div>
      )}
    </div>
  )
}

export function LiveNote({ noteId }: { noteId: string }) {
  const page = usePage(noteId)
  if (page === undefined) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  if (!page) return <EmptyState title="Deleted">This page no longer exists.</EmptyState>
  return <NoteBody page={page} />
}
