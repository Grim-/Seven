import { showName } from '@shared/ids'
import { Segmented } from '../ui'
import { useViewPlace } from '../../lib/viewPlace'
import { useDragHeight } from '../../lib/useDragHeight'
import { useSessions } from '../../store/sessions'
import { ComposerSendPanel } from './ComposerSendPanel'
import { ChatPreview } from './ChatPreview'
import { Paper } from './Paper'
import { PadExplorer } from './PadExplorer'
import { usePad } from './pad'
import { EMPTY_DRAFT, type PadDraft } from './composerSend'

type Mode = 'paper' | 'text' | 'chat'

const MODES: { value: Mode; label: string }[] = [
  { value: 'paper', label: 'Paper' },
  { value: 'text', label: 'What the agent gets' },
  { value: 'chat', label: 'Chat preview' }
]

export function ComposerView() {
  const [draft, setDraft] = useViewPlace<PadDraft>('composer.draft', EMPTY_DRAFT)
  const [mode, setMode] = useViewPlace<Mode>('composer.mode', 'paper')
  const [agent, setAgent] = useViewPlace<string | null>('composer.agent', null)
  const fallback = useSessions((s) => s.defaultAgentId)
  const explorer = useDragHeight('composer.explorer', 340)
  const pad = usePad(draft.text, (text) => setDraft({ ...draft, text }))
  const load = (next: PadDraft) => {
    setDraft(next)
    pad.load(next.text)
  }
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_260px] gap-3">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Segmented value={mode} options={MODES} onChange={setMode} />
            <span className="font-mono text-[11px] text-dim">{draft.page ? `page · ${showName(draft.title)}` : 'draft · not saved'}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === 'paper' && <Paper pad={pad} />}
            {mode === 'text' && <pre className="pad-paper pad-raw">{pad.text || 'Nothing on the paper yet.'}</pre>}
            {mode === 'chat' && <ChatPreview text={pad.text} agentId={agent ?? fallback} />}
          </div>
        </div>
        <ComposerSendPanel draft={{ ...draft, text: pad.text }} agent={agent} onAgent={setAgent} onLoad={load} onSaved={setDraft} />
      </div>
      <div {...explorer.handle} title="Drag to resize" className="drag-bar" />
      <div style={{ height: explorer.height }} className="flex min-h-0 shrink-0">
        <PadExplorer id="composer.explorer" pad={pad} />
      </div>
    </div>
  )
}
