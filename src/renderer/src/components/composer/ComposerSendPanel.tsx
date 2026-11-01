import { useState } from 'react'
import { BookOpen, Eraser, FilePlus2, MessageSquarePlus, Save, Send } from 'lucide-react'
import { showName } from '@shared/ids'
import { Button, Eyebrow, Select, askText } from '../ui'
import { AgentSelect } from '../agents/AgentSelect'
import { KindPickModal } from '../library/KindPickModal'
import { useSessions } from '../../store/sessions'
import { useBusy } from '../../lib/useBusy'
import { toast } from '../../store/toasts'
import { openPage, savePad, sendToChat, type PadDraft } from './composerSend'

interface Props {
  draft: PadDraft
  agent: string | null
  onAgent: (id: string) => void
  onLoad: (draft: PadDraft) => void
  onSaved: (draft: PadDraft) => void
}

export function ComposerSendPanel({ draft, agent, onAgent, onLoad, onSaved }: Props) {
  const sessions = useSessions((s) => s.list)
  const fallback = useSessions((s) => s.defaultAgentId)
  const [into, setInto] = useState('')
  const [picking, setPicking] = useState(false)
  const [busy, run] = useBusy()
  const recent = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
  const target = into || recent[0]?.id || ''
  const empty = !draft.text.trim()
  const save = (title: string | null) => void run(() => savePad(draft, title).then((saved) => {
    onSaved(saved)
    toast.success('Saved', showName(saved.title))
  }), 'Could not save it')
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto border border-line/40 bg-black/40 p-3">
      <Eyebrow>Start a chat</Eyebrow>
      <AgentSelect value={agent ?? fallback} onChange={onAgent} className="h-8 text-[12px]" />
      <Button variant="primary" icon={<MessageSquarePlus />} disabled={empty || busy} onClick={() => void run(() => sendToChat(null, agent ?? fallback, draft.text), 'Could not start the chat')}>
        Start the chat
      </Button>
      <Eyebrow>Or send into</Eyebrow>
      <Select value={target} options={recent.map((s) => ({ value: s.id, label: s.title || 'Untitled chat' }))} onChange={setInto} className="h-8 text-[12px]" />
      <Button icon={<Send />} disabled={empty || busy || !target} onClick={() => void run(() => sendToChat(target, null, draft.text), 'Could not send')}>
        Send to chat
      </Button>
      <Eyebrow>Page</Eyebrow>
      {draft.page && (
        <Button icon={<Save />} disabled={busy} onClick={() => save(null)}>
          Save {showName(draft.title)}
        </Button>
      )}
      <Button icon={<FilePlus2 />} disabled={empty || busy} onClick={() => askText('Save as page', 'Title', draft.title, (title) => save(title.trim() || 'Untitled'))}>
        Save as page
      </Button>
      <Button icon={<BookOpen />} onClick={() => setPicking(true)}>
        Open a page
      </Button>
      <Button variant="ghost" icon={<Eraser />} disabled={empty && !draft.page} onClick={() => onLoad({ text: '', page: null, title: '' })}>
        Clear the paper
      </Button>
      <span className="text-[11.5px] leading-relaxed text-faint">Repos set to roll when sent roll on Send. A card on the paper is its prompt and isn't used up.</span>
      {picking && (
        <KindPickModal
          kind="page"
          title="Open a page"
          onPick={(_kind, page) => {
            setPicking(false)
            void run(() => openPage(page).then(onLoad), 'Could not open it')
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
