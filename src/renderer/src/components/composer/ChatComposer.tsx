import { useState } from 'react'
import { create } from 'zustand'
import { BookOpen, FilePlus2, NotebookPen, Save, Send, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { Button, askText, openMenu } from '../ui'
import { KindPickModal } from '../library/KindPickModal'
import { ComposerTool } from '../chat/ComposerTool'
import { useApp } from '../../store/app'
import { useBusy } from '../../lib/useBusy'
import { useDragHeight } from '../../lib/useDragHeight'
import { toast } from '../../store/toasts'
import type { Conversation } from '../../lib/conversation'
import { Paper } from './Paper'
import { PadPicker } from './PadPicker'
import { usePad } from './pad'
import { EMPTY_DRAFT, openPage, savePad, sendInto, type PadDraft } from './composerSend'

const useChatPads = create<{ open: Record<string, PadDraft> }>(() => ({ open: {} }))

function setChatPad(key: string, draft: PadDraft | null): void {
  useChatPads.setState((s) => {
    const open = { ...s.open }
    if (draft) open[key] = draft
    else delete open[key]
    return { open }
  })
}

function ChatPadPanel({ start, conv, running }: { start: PadDraft; conv: Conversation; running: boolean }) {
  const [draft, setDraft] = useState(start)
  const pad = usePad(start.text)
  const [busy, run] = useBusy()
  const [picking, setPicking] = useState(false)
  const size = useDragHeight('composer.chatPad', 360)
  const close = () => setChatPad(conv.key, null)
  const current = { ...draft, text: pad.text }
  const save = (title: string | null) =>
    void run(
      () =>
        savePad(current, title).then((saved) => {
          setDraft(saved)
          toast.success('Saved', showName(saved.title))
        }),
      'Could not save it'
    )
  return (
    <div className="flex shrink-0 flex-col border-t border-line/60 tone-panel-50">
      <div {...size.handle} title="Drag to resize" className="drag-bar" />
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <span className="font-label text-[10.5px] font-semibold caps-14 text-accent">{draft.page ? showName(draft.title) : 'New paper'}</span>
        <span className="flex-1" />
        {draft.page && (
          <Button size="sm" variant="ghost" icon={<Save />} disabled={busy} onClick={() => save(null)}>
            Save the page
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<FilePlus2 />} disabled={busy || !pad.text.trim()} onClick={() => askText('Save as page', 'Title', draft.title, (title) => save(title.trim() || 'Untitled'))}>
          Save as page
        </Button>
        <Button size="sm" variant="primary" icon={<Send />} disabled={running || busy || !pad.text.trim()} onClick={() => void run(() => sendInto(conv, pad.text).then(close), 'Could not send')}>
          Send into this chat
        </Button>
        <Button size="sm" variant="ghost" icon={<X />} title="Close" onClick={close} />
      </div>
      <div style={{ height: size.height }} className="min-h-0 overflow-y-auto px-3 pb-2">
        <Paper pad={pad} onMenu={() => setPicking(true)} />
      </div>
      <PadPicker id="composer.chatExplorer" pad={pad} open={picking} onClose={() => setPicking(false)} />
    </div>
  )
}

export function ChatPad({ conv, running }: { conv: Conversation; running: boolean }) {
  const start = useChatPads((s) => s.open[conv.key])
  if (!start) return null
  return <ChatPadPanel key={`${conv.key}:${start.page ?? 'new'}`} start={start} conv={conv} running={running} />
}

export function ChatComposer({ conv }: { conv: Conversation; running: boolean }) {
  const open = useChatPads((s) => Boolean(s.open[conv.key]))
  const [picking, setPicking] = useState(false)
  const [, run] = useBusy()
  return (
    <>
      <ComposerTool
        title="Composer"
        active={open}
        onClick={(e) =>
          openMenu(e, 'Composer', [
            { label: 'Open a page here', icon: <BookOpen />, onSelect: () => setPicking(true) },
            { label: 'New paper here', icon: <FilePlus2 />, onSelect: () => setChatPad(conv.key, EMPTY_DRAFT) },
            ...(open ? [{ label: 'Close the paper', icon: <X />, onSelect: () => setChatPad(conv.key, null) }] : []),
            { label: 'Open the Composer', icon: <NotebookPen />, onSelect: () => useApp.getState().setView('composer') }
          ])
        }
      >
        <NotebookPen />
      </ComposerTool>
      {picking && (
        <KindPickModal
          kind="page"
          title="Open a page here"
          onPick={(_kind, page) => {
            setPicking(false)
            void run(() => openPage(page).then((d) => setChatPad(conv.key, d)), 'Could not open it')
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}
