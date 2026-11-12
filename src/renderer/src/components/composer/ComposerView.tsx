import { useState } from 'react'
import { showName } from '@shared/ids'
import { Segmented } from '../ui'
import { useViewPlace } from '../../lib/viewPlace'
import { useSessions } from '../../store/sessions'
import { cn } from '../../lib/cn'
import { ComposerSendPanel } from './ComposerSendPanel'
import { ChatPreview } from './ChatPreview'
import { Paper } from './Paper'
import { PadPicker } from './PadPicker'
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
  const [sidebarWidth, setSidebarWidth] = useViewPlace<number>('composer.sidebarWidth', 280)
  const [isResizing, setIsResizing] = useState(false)
  const fallback = useSessions((s) => s.defaultAgentId)
  const [picking, setPicking] = useState(false)
  const pad = usePad(draft.text, (text) => setDraft({ ...draft, text }))

  const load = (next: PadDraft) => {
    setDraft(next)
    pad.load(next.text)
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startW = sidebarWidth
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      const nextW = Math.max(240, Math.min(520, startW + delta))
      setSidebarWidth(nextW)
    }
    const onMouseUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-3">
            <Segmented value={mode} options={MODES} onChange={setMode} />
            <span className="font-mono text-[11px] text-dim">{draft.page ? `page · ${showName(draft.title)}` : 'draft · not saved'}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {mode === 'paper' && <Paper pad={pad} onMenu={() => setPicking(true)} />}
            {mode === 'text' && <pre className="pad-paper pad-raw">{pad.text || 'Nothing on the paper yet.'}</pre>}
            {mode === 'chat' && <ChatPreview text={pad.text} agentId={agent ?? fallback} />}
          </div>
        </div>

        {/* Resizable Sidebar Container */}
        <div style={{ width: `${sidebarWidth}px` }} className="relative flex min-h-0 shrink-0 flex-col">
          <div
            onMouseDown={startResize}
            onDoubleClick={() => setSidebarWidth(sidebarWidth >= 380 ? 280 : 420)}
            title="Drag to resize, double-click to toggle width"
            className={cn(
              'absolute -left-1.5 top-0 bottom-0 z-20 w-3 cursor-ew-resize transition-colors hover:bg-accent/40',
              isResizing && 'bg-accent'
            )}
          />
          <ComposerSendPanel draft={{ ...draft, text: pad.text }} agent={agent} onAgent={setAgent} onLoad={load} onSaved={setDraft} />
        </div>
      </div>
      <PadPicker id="composer.explorer" pad={pad} open={picking} onClose={() => setPicking(false)} />
    </div>
  )
}
