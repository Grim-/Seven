import { useState, type DragEvent } from 'react'
import { Drama, Plus, Shuffle, X } from 'lucide-react'
import { Button, Eyebrow, FaceGrid, Modal, StepSection } from '../ui'
import { AgentTiles } from '../agents/AgentTiles'
import { AgentAvatar } from '../agents/look'
import { DrawPanel, type Drawn } from '../draw/DrawPanel'
import { DrawnFace } from '../draw/DrawnFace'
import { EntryPicker } from '../library/EntryPicker'
import { LinkTextarea } from '../data/LinkTextarea'
import { sceneMessage, useRecentScenes, type SavedScene } from './sceneStore'
import { useSessions } from '../../store/sessions'
import { useAgents } from '../../store/agents'
import { entryLink } from '../../store/data'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatRelative } from '../../lib/format'
import { droppedEntries, isEntryDrag } from '../../lib/entryDrag'
import { cn } from '../../lib/cn'
import type { Conversation } from '../../lib/conversation'

function PartFace({ part, onRemove }: { part: Drawn; onRemove: () => void }) {
  return (
    <div className="shell-enter group relative min-w-0">
      <DrawnFace value={part.value} from={part.from} />
      <button type="button" title="Take out" onClick={onRemove} className="notch-sm absolute right-1.5 top-1.5 z-10 border border-line bg-black/85 p-1 text-dim opacity-0 transition-opacity hover:border-alert hover:text-alert group-hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function RecentScene({ scene, onUse, onForget }: { scene: SavedScene; onUse: () => void; onForget: () => void }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === scene.agentId))
  return (
    <div className="group flex items-center gap-2.5 border-b border-l-2 border-b-line/30 border-l-transparent px-2 py-2 transition-colors hover:border-l-accent hover:bg-accent/5">
      {agent && <AgentAvatar agent={agent} size={28} />}
      <button type="button" onClick={onUse} title="Use this again" className="min-w-0 flex-1 text-left">
        <div className="truncate text-[12.5px] text-white">{scene.line.trim() || scene.parts.map((p) => p.from || p.value).join(', ') || 'Empty scene'}</div>
        <div className="font-mono text-[10px] text-faint">{[agent?.name, `${scene.parts.length} part${scene.parts.length === 1 ? '' : 's'}`, formatRelative(scene.at)].filter(Boolean).join(' · ')}</div>
      </button>
      <button type="button" title="Forget this scene" onClick={onForget} className="p-0.5 text-faint opacity-0 hover:text-alert group-hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function SceneBuilder({ conv, agentId, running, onClose }: { conv: Conversation; agentId: string | null; running: boolean; onClose: () => void }) {
  const [parts, setParts] = useState<Drawn[]>([])
  const [line, setLine] = useState('')
  const [adding, setAdding] = useState<'entry' | 'draw' | null>(null)
  const [over, setOver] = useState(false)
  const [recent, remember, forget] = useRecentScenes()
  const agents = useAgents((s) => s.list)
  const isNew = !conv.sessionId
  const message = sceneMessage({ parts, line })
  const add = (more: Drawn[]) => setParts((list) => [...list, ...more])
  const toggle = (what: 'entry' | 'draw') => setAdding(adding === what ? null : what)

  const drop = (e: DragEvent) => {
    setOver(false)
    if (!isEntryDrag(e)) return
    e.preventDefault()
    void Promise.all(droppedEntries(e).map((id) => engine('library.resolve', { entry: id })))
      .then((found) => add(found.map((f) => ({ value: entryLink(f.kind, f.id), from: '' }))))
      .catch(failed('Could not add that'))
  }

  const begin = () => {
    remember({ agentId: isNew ? agentId : null, parts, line, at: Date.now() })
    void useSessions.getState().send(conv, message).catch(failed('Could not send'))
    onClose()
  }

  const load = (scene: SavedScene) => {
    setParts(scene.parts)
    setLine(scene.line)
    if (isNew && scene.agentId && agents.some((a) => a.id === scene.agentId)) useSessions.getState().setDraftAgent(conv.key, scene.agentId)
  }

  let step = 0
  return (
    <Modal
      open
      wide
      title={isNew ? 'Set the scene' : 'Change the scene'}
      onClose={onClose}
      bodyClassName="min-h-0 flex-1 overflow-y-auto"
      footer={
        <>
          <span className="mr-auto self-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
            {running ? 'Wait for the reply to finish' : message ? `Sends ${[line.trim() ? 'your line' : '', parts.length ? `${parts.length} part${parts.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')}` : 'Add something to send'}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Drama />} disabled={running || !message} onClick={begin}>
            {isNew ? 'Begin' : 'Send scene'}
          </Button>
        </>
      }
    >
      <div className="grid min-h-[60vh] lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6 p-5">
          {isNew && (
            <StepSection step={++step} label="Agent">
              <AgentTiles value={agentId} onChange={(id) => useSessions.getState().setDraftAgent(conv.key, id)} />
            </StepSection>
          )}
          <StepSection
            step={++step}
            label="Start from"
            actions={
              <>
                <Button size="sm" variant="badge" icon={<Plus />} active={adding === 'entry'} onClick={() => toggle('entry')}>
                  Add entry
                </Button>
                <Button size="sm" variant="badge" icon={<Shuffle />} active={adding === 'draw'} onClick={() => toggle('draw')}>
                  Draw
                </Button>
              </>
            }
          >
            {adding === 'entry' && (
              <EntryPicker
                inline
                kind={null}
                title="Add to the scene"
                onPick={(hit) => {
                  add([{ value: entryLink(hit.kind, hit.id), from: '' }])
                  setAdding(null)
                }}
                onClose={() => setAdding(null)}
              />
            )}
            {adding === 'draw' && (
              <DrawPanel
                onClose={() => setAdding(null)}
                onUse={(picked) => {
                  add(picked)
                  setAdding(null)
                }}
              />
            )}
            <div
              onDragOver={(e) => {
                if (!isEntryDrag(e)) return
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={drop}
              className={cn('notch min-h-[170px] border border-dashed p-3 transition-colors', over ? 'border-accent bg-accent/[0.07]' : 'border-line/60 bg-black/30')}
            >
              {parts.length ? (
                <FaceGrid scale={0.8}>
                  {parts.map((p, i) => (
                    <PartFace key={`${i}-${p.value}`} part={p} onRemove={() => setParts(parts.filter((_, j) => j !== i))} />
                  ))}
                </FaceGrid>
              ) : (
                <div className="flex h-full min-h-[146px] flex-col items-center justify-center gap-2 text-center">
                  <Drama className="h-8 w-8 text-accent/40" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">Nothing set yet</span>
                  <span className="max-w-sm text-[12.5px] text-faint">Add a scene card, a scenario page or characters, draw from a repo or deck, or drop pages and files here.</span>
                </div>
              )}
            </div>
          </StepSection>
          <StepSection step={++step} label={isNew ? 'Opening line' : 'What happens'} note="optional">
            <LinkTextarea rows={4} value={line} onValue={setLine} placeholder={isNew ? 'How it begins…' : 'The scene changes…'} className="notch-sm min-h-24 resize-y border border-line bg-black/60 px-3 py-2.5 text-[14px] leading-relaxed text-white inset-field glow-focus placeholder:text-dim/60" />
          </StepSection>
        </div>
        <aside className="flex min-w-0 flex-col gap-2 border-line/50 bg-black/30 p-5 lg:border-l">
          <Eyebrow>Recent scenes</Eyebrow>
          {!recent.length && <span className="text-[12.5px] text-faint">Scenes you send show here so you can use them again.</span>}
          <div className="flex flex-col">
            {recent.map((s) => (
              <RecentScene key={s.at} scene={s} onUse={() => load(s)} onForget={() => forget(s)} />
            ))}
          </div>
        </aside>
      </div>
    </Modal>
  )
}
