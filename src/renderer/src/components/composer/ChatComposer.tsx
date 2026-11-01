import { useState } from 'react'
import { BookOpen, FilePlus2, NotebookPen, Save, Send } from 'lucide-react'
import { showName } from '@shared/ids'
import { Button, Modal, askText, openMenu } from '../ui'
import { KindPickModal } from '../library/KindPickModal'
import { ComposerTool } from '../chat/ComposerTool'
import { useApp } from '../../store/app'
import { useBusy } from '../../lib/useBusy'
import { useDragHeight } from '../../lib/useDragHeight'
import { toast } from '../../store/toasts'
import type { Conversation } from '../../lib/conversation'
import { Paper } from './Paper'
import { PadExplorer } from './PadExplorer'
import { usePad } from './pad'
import { EMPTY_DRAFT, openPage, savePad, sendInto, type PadDraft } from './composerSend'

function PadModal({ start, conv, running, onClose }: { start: PadDraft; conv: Conversation; running: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(start)
  const pad = usePad(start.text)
  const [busy, run] = useBusy()
  const explorer = useDragHeight('composer.modalExplorer', 280)
  const current = { ...draft, text: pad.text }
  const save = (title: string | null) => void run(() => savePad(current, title).then((saved) => {
    setDraft(saved)
    toast.success('Saved', showName(saved.title))
  }), 'Could not save it')
  return (
    <Modal
      open
      wide
      title={draft.page ? showName(draft.title) : 'New paper'}
      onClose={onClose}
      bodyClassName="flex h-[82vh] min-h-0 flex-col p-3"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {draft.page && (
            <Button icon={<Save />} disabled={busy} onClick={() => save(null)}>
              Save the page
            </Button>
          )}
          <Button icon={<FilePlus2 />} disabled={busy || !pad.text.trim()} onClick={() => askText('Save as page', 'Title', draft.title, (title) => save(title.trim() || 'Untitled'))}>
            Save as page
          </Button>
          <Button variant="primary" icon={<Send />} disabled={running || busy || !pad.text.trim()} onClick={() => void run(() => sendInto(conv, pad.text).then(onClose), 'Could not send')}>
            Send into this chat
          </Button>
        </>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Paper pad={pad} />
      </div>
      <div {...explorer.handle} title="Drag to resize" className="drag-bar" />
      <div style={{ height: explorer.height }} className="flex min-h-0 shrink-0">
        <PadExplorer id="composer.modalExplorer" pad={pad} />
      </div>
    </Modal>
  )
}

export function ChatComposer({ conv, running }: { conv: Conversation; running: boolean }) {
  const [open, setOpen] = useState<PadDraft | null>(null)
  const [picking, setPicking] = useState(false)
  const [, run] = useBusy()
  return (
    <>
      <ComposerTool
        title="Composer"
        active={open !== null}
        onClick={(e) =>
          openMenu(e, 'Composer', [
            { label: 'Open a page here', icon: <BookOpen />, onSelect: () => setPicking(true) },
            { label: 'New paper here', icon: <FilePlus2 />, onSelect: () => setOpen(EMPTY_DRAFT) },
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
            void run(() => openPage(page).then(setOpen), 'Could not open it')
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {open && <PadModal start={open} conv={conv} running={running} onClose={() => setOpen(null)} />}
    </>
  )
}
