import { useState } from 'react'
import { BookOpen, Eraser, FilePlus2, MessageSquarePlus, Save, Send } from 'lucide-react'
import { showName } from '@shared/ids'
import { referencePattern } from '@shared/text'
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

  const tokenCount = Math.max(0, Math.round(draft.text.length / 4))
  const refCount = (draft.text.match(referencePattern()) ?? []).length

  const save = (title: string | null) =>
    void run(
      () =>
        savePad(draft, title).then((saved) => {
          onSaved(saved)
          toast.success('Saved', showName(saved.title))
        }),
      'Could not save it'
    )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 overflow-y-auto border border-line/40 bg-black/40 p-3 font-mono">
      {/* Telemetry Shelf */}
      <div className="flex flex-col gap-1 border-b border-line/40 pb-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent">PROMPT TELEMETRY</span>
        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
          <div className="border border-line/40 bg-black/50 px-2 py-1">
            <span className="block text-[9.5px] text-faint">ENTITIES</span>
            <span className="font-bold text-cyan">{refCount} attached</span>
          </div>
          <div className="border border-line/40 bg-black/50 px-2 py-1">
            <span className="block text-[9.5px] text-faint">EST. TOKENS</span>
            <span className="font-bold text-white">~{tokenCount}</span>
          </div>
        </div>
      </div>

      {/* Target Agent & Launch */}
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Target Agent</Eyebrow>
        <AgentSelect value={agent ?? fallback} onChange={onAgent} className="h-8 text-[12px]" />
        <Button
          variant="primary"
          icon={<MessageSquarePlus />}
          disabled={empty || busy}
          onClick={() => void run(() => sendToChat(null, agent ?? fallback, draft.text), 'Could not start the chat')}
          className="mt-1 font-bold uppercase tracking-wider"
        >
          Start the chat
        </Button>
      </div>

      {/* Existing Chat Injection */}
      <div className="flex flex-col gap-1.5 border-t border-line/30 pt-2.5">
        <Eyebrow>Or send into</Eyebrow>
        <Select
          value={target}
          options={recent.map((s) => ({ value: s.id, label: s.title || 'Untitled chat' }))}
          onChange={setInto}
          className="h-8 text-[12px]"
        />
        <Button
          icon={<Send />}
          disabled={empty || busy || !target}
          onClick={() => void run(() => sendToChat(target, null, draft.text), 'Could not send')}
        >
          Send to chat
        </Button>
      </div>

      {/* Page Document Persistence */}
      <div className="flex flex-col gap-1.5 border-t border-line/30 pt-2.5">
        <Eyebrow>Corkboard Page</Eyebrow>
        {draft.page && (
          <Button icon={<Save />} disabled={busy} onClick={() => save(null)}>
            Save {showName(draft.title)}
          </Button>
        )}
        <Button
          icon={<FilePlus2 />}
          disabled={empty || busy}
          onClick={() => askText('Save as page', 'Title', draft.title, (title) => save(title.trim() || 'Untitled'))}
        >
          Save as page
        </Button>
        <Button icon={<BookOpen />} onClick={() => setPicking(true)}>
          Open a page
        </Button>
        <Button
          variant="ghost"
          icon={<Eraser />}
          disabled={empty && !draft.page}
          onClick={() => onLoad({ text: '', page: null, title: '' })}
        >
          Clear the paper
        </Button>
      </div>

      <div className="mt-auto border-t border-line/30 pt-2 text-[10.5px] leading-relaxed text-faint">
        Cards on the paper inject structured Kind data into agent reasoning without prompt token waste.
      </div>

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
