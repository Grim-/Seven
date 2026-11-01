import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { OutputTray } from '../side/SidePanel'
import { TodoBar } from './TodoBar'
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessageByIndexProvider,
  MessagePrimitive,
  ThreadPrimitive,
  type EmptyMessagePartProps,
  type ReasoningMessagePartProps,
  type TextMessagePartProps,
  useAui,
  useAuiState
} from '@assistant-ui/react'
import { ArrowDown, ChevronRight, Copy, CornerDownLeft, Dices, FileIcon, GitFork, Paperclip, Pencil, RotateCcw, Shuffle, Square, Volume2, X } from 'lucide-react'
import type { AgentProfile, AssetMeta, ChatMessage, PictureArea, RewindPreview } from '@shared/types'
import { AgentAvatar } from '../agents/look'
import { cn } from '../../lib/cn'
import { LinkTextarea } from '../data/LinkTextarea'
import { Markdown } from './Markdown'
import { speak, stopSpeaking, useSpeech } from '../../lib/speech'
import { RoleplayText } from './Roleplay'
import { useSevenRuntime } from './runtime'
import { ToolCard } from './ToolCard'
import { AgentRef, useRoleplay } from './agentContext'
import { DraftPart } from './DraftPart'
import { StatusLine } from './StatusLine'
import { StageOverlay } from '../../registries/presentations'
import { SummaryCard } from './ContextMeter'
import { ActiveCommand, CommandOutputCard, ComposerHints, useComposerHints } from './Commands'
import { ComposerReferences, UserTextPart } from './References'
import { AlertBox, Button, EmptyState, Modal, VirtualList, openMenu, DropOverlay } from '../ui'
import { engine, main } from '../../lib/ipc'
import { useData } from '../../store/data'
import { draftOf, useSessions } from '../../store/sessions'
import { useConversation, type Conversation } from '../../lib/conversation'
import { ChatHand } from '../cards/ChatHand'
import { toast } from '../../store/toasts'
import { ChatPictures, useChatPictures } from '../pictures/chatPictures'
import { Picture } from '../pictures/Picture'
import { useApp } from '../../store/app'
import { failed } from '../../lib/notify'
import { copyText } from '../../lib/notify'
import { useFileDrop } from '../../lib/useFileDrop'
import { queueComposer, takeQueuedComposer, useQueuedComposer } from '../../lib/composer'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { THREAD_LOOKS, ThreadLookContext, useThreadLook, type ThreadLookId } from './threadLook'
import { Trace } from './Trace'
import { LinkFaces } from '../entries/LinkFaces'
import { DrawPanel } from '../draw/DrawPanel'
import { PlayBuilder } from '../play/PlayBuilder'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { ComposerTool } from './ComposerTool'
import { ChatComposer } from '../composer/ChatComposer'
import { AreaAction } from '../pictures/areaAction'
import { errorText, formatClock } from '../../lib/format'

const BIG_AVATAR: Record<string, number> = { small: 0, medium: 48, large: 96 }

const AgentLabel = createContext('SEVEN')
const RewindRequest = createContext<((messageId: string) => void) | null>(null)
const EditRequest = createContext<((messageId: string) => void) | null>(null)
const ForkRequest = createContext<((messageId: string) => void) | null>(null)
let composerSetter: ((text: string) => void) | null = null
let pendingComposer: string | null = null

export function fillComposer(text: string): void {
  if (composerSetter) composerSetter(text)
  else pendingComposer = text
  requestAnimationFrame(() => {
    const box = document.querySelector<HTMLTextAreaElement>('textarea[data-seven-composer]')
    if (!box) return
    box.focus()
    box.setSelectionRange(box.value.length, box.value.length)
  })
}

function forkAt(conv: Conversation, messageId: string): void {
  const sessionId = conv.sessionId
  if (!sessionId) return
  void engine('sessions.fork', { id: sessionId, messageId })
    .then(async ({ session, text }) => {
      useSessions.setState((s) => ({ list: [session, ...s.list.filter((x) => x.id !== session.id)] }))
      conv.go(session.id)
      if (text) queueComposer(conv.key, text, true)
      toast.success('Forked', session.title)
    })
    .catch(failed('Could not fork'))
}

function AssistantTextPart({ text, status }: TextMessagePartProps) {
  const agent = useContext(AgentRef)
  return (
    <>
      {agent?.roleplay ? <RoleplayText text={text} agent={agent} /> : <Markdown text={text} />}
      {status.type === 'running' && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-blink bg-accent" />}
    </>
  )
}

function ThoughtPart({ text, status }: ReasoningMessagePartProps) {
  const streaming = status.type === 'running'
  const roleplay = useRoleplay()
  const look = useThreadLook()
  const folded = roleplay || look.foldTools
  const [open, setOpen] = useState(!folded)
  useEffect(() => {
    setOpen(!folded)
  }, [folded])
  if (look.foldTools)
    return (
      <>
        <Trace tone="mind" label={streaming ? 'thinking' : 'thought'} aside={`${text.length.toLocaleString()} chars`} open={open} onToggle={() => setOpen(!open)} />
        {open && <div className="mb-2 max-h-72 overflow-y-auto whitespace-pre-wrap border-l border-l-purple/50 pl-3 font-mono text-[12px] leading-relaxed text-dim">{text}</div>}
      </>
    )
  return (
    <div className="mb-3 border border-line/50 border-l-2 border-l-purple/70 bg-purple/5">
      <button
        className="flex w-full items-center gap-2 px-2.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-purple hover:text-white"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        {streaming ? 'Thinking' : 'Thought'}
        <span className="text-faint">// {text.length.toLocaleString()} chars</span>
        {streaming && <span className="ml-1 h-1.5 w-1.5 animate-pulse bg-purple" />}
      </button>
      {open && <div className="max-h-72 overflow-y-auto whitespace-pre-wrap px-3 pb-2.5 font-mono text-[12px] leading-relaxed text-dim">{text}</div>}
    </div>
  )
}

function EmptyPart(_props: EmptyMessagePartProps) {
  return null
}

function messageText(sessionId: string | null, messageId: string): string {
  const s = useSessions.getState()
  const m = sessionId ? s.messages[sessionId]?.find((x) => x.id === messageId) : undefined
  return (m?.parts ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('').trim()
}


function SummaryMarker({ messageId }: { messageId: string }) {
  const { sessionId } = useConversation()
  const summary = useSessions((s) => (sessionId ? (s.summaries[sessionId] ?? []).findLast((x) => x.upTo === messageId) : undefined))
  const [open, setOpen] = useState(false)
  if (!summary) return null
  return (
    <div className="mb-5 border border-line/50 border-l-2 border-l-purple/70 bg-purple/5">
      <button
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-purple hover:text-white"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        Summarised for the model
        <span className="normal-case tracking-normal text-faint">
          // the {summary.turns} turn{summary.turns > 1 ? 's' : ''} above reach the model only as this summary
        </span>
      </button>
      {open && <div className="max-h-80 overflow-y-auto whitespace-pre-wrap px-3 pb-2.5 font-mono text-[12px] leading-relaxed text-dim">{summary.text}</div>}
    </div>
  )
}

function FileChip({ name, kind, onRemove, onOpen }: { name: string; kind: string; onRemove?: () => void; onOpen?: () => void }) {
  return (
    <span className="flex max-w-60 items-center gap-1.5 border border-line/60 bg-black/50 px-2 py-0.5 font-mono text-[11px] text-white/85">
      <FileIcon className="h-3 w-3 shrink-0 text-accent" />
      <button onClick={onOpen} disabled={!onOpen} className="min-w-0 truncate text-left hover:text-accent disabled:hover:text-white/85" title={name}>
        {name}
      </button>
      <span className="shrink-0 text-faint">{kind}</span>
      {onRemove && (
        <button onClick={onRemove} className="shrink-0 text-faint hover:text-alert" title="Remove">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

function MessageFiles({ messageId }: { messageId: string }) {
  const { sessionId } = useConversation()
  const ids = useSessions((s) => (sessionId ? s.messages[sessionId]?.find((m) => m.id === messageId)?.attachments : undefined))
  const assets = useData((s) => s.assets)
  const chat = useChatPictures()
  if (!ids?.length) return null
  const images = ids.map((id) => assets.find((a) => a.id === id)).filter((a): a is AssetMeta => a?.kind === 'image')
  return (
    <>
    {images.length > 0 && (
      <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
        {images.map((a) => (
          <Picture key={a.id} asset={a} maxHeight={chat?.height} />
        ))}
      </div>
    )}
    {images.length < ids.length && (
    <div className="mb-1.5 flex flex-wrap justify-end gap-1.5">
      {ids.filter((id) => !images.some((a) => a.id === id)).map((id) => {
        const meta = assets.find((a) => a.id === id)
        return (
          <FileChip
            key={id}
            name={meta?.name ?? id}
            kind={meta?.kind ?? 'missing'}
            onOpen={meta ? () => void main('asset.open', { id, reveal: false }).catch(failed('Could not open')) : undefined}
          />
        )
      })}
    </div>
    )}
    </>
  )
}

function DraftFiles() {
  const { key } = useConversation()
  const files = useSessions((s) => draftOf(s, key).files)
  const detach = (id: string) => useSessions.getState().detach(key, id)
  if (!files.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-line/60 bg-black/40 px-3 pt-2">
      {files.map((f) => (
        <FileChip key={f.id} name={f.name} kind={f.kind} onRemove={() => detach(f.id)} />
      ))}
    </div>
  )
}

function attachPaths(key: string, paths: string[]): void {
  useSessions
    .getState()
    .attach(key, paths)
    .catch(failed('Could not attach'))
}

const ThreadSince = createContext<{ at: number; seen: Set<string> }>({ at: 0, seen: new Set() })

function useEntrance(messageId: string | undefined): { opacity: number; y: number } | false {
  const since = useContext(ThreadSince)
  const [fresh] = useState(() => {
    const isNew = performance.now() - since.at > 600 && !(messageId && since.seen.has(messageId))
    if (messageId) since.seen.add(messageId)
    return isNew
  })
  return fresh ? { opacity: 0, y: 10 } : false
}

const ENTER = { type: 'spring', stiffness: 420, damping: 34 } as const

function MessageTime() {
  const look = useThreadLook()
  const at = useAuiState((s) => s.message.createdAt)
  if (!look.times || !at) return null
  return <span className="font-normal text-faint">{formatClock(at)}</span>
}

function MessageRow() {
  const role = useAuiState((s) => s.message.role)
  const id = useAuiState((s) => s.message.id)
  const statusType = useAuiState((s) => s.message.status?.type)
  const reason = useAuiState((s) => (s.message.status && 'reason' in s.message.status ? s.message.status.reason : undefined))
  const error = useAuiState((s) => (s.message.metadata?.custom?.error as string | null | undefined) ?? null)
  const notice = useAuiState((s) => (s.message.metadata?.custom?.notice as string | null | undefined) ?? null)
  if (role === 'user') return <UserMessage messageId={id} />
  return <AssistantMessage messageId={id} statusType={statusType} reason={reason} error={error} notice={notice} />
}

function VirtualMessages({ viewport }: { viewport: React.RefObject<HTMLDivElement | null> }) {
  const count = useAuiState((s) => s.thread.messages.length)
  const look = useThreadLook()
  return (
    <VirtualList count={count} scroller={viewport} estimate={180} overscan={6} rowClassName={(i) => (i < count - 1 ? look.gap : undefined)}>
      {(i) => (
        <MessageByIndexProvider index={i}>
          <MessageRow />
        </MessageByIndexProvider>
      )}
    </VirtualList>
  )
}

function UserMessage({ messageId }: { messageId: string }) {
  const conv = useConversation()
  const look = useThreadLook()
  const rewind = useContext(RewindRequest)
  const fork = useContext(ForkRequest)
  const canRewind = rewind && !messageId.startsWith('__')
  const entrance = useEntrance(messageId)
  const text = useAuiState((s) => s.message.content.map((p) => (p.type === 'text' ? p.text : '')).join(''))
  return (
    <>
    <SummaryMarker messageId={messageId} />
    <MessagePrimitive.Root
      onContextMenu={(e) => {
        const text = messageText(conv.sessionId, messageId)
        openMenu(e, 'Your message', [
          { label: 'Copy text', icon: <Copy />, disabled: !text, onSelect: () => void copyText(text, 'Copied', 'Your message') },
          { label: 'Send again', icon: <CornerDownLeft />, disabled: !text || !canRewind, onSelect: () => void useSessions.getState().send(conv, text).catch(failed('Could not send')) },
          { label: 'Fork from here', icon: <GitFork />, disabled: !fork || messageId.startsWith('__'), onSelect: () => fork?.(messageId) },
          { label: '', separator: true },
          { label: 'Rewind to here', icon: <RotateCcw />, danger: true, disabled: !canRewind, onSelect: () => rewind?.(messageId) }
        ])
      }}
    >
      <motion.div className="group flex justify-end" initial={entrance} animate={{ opacity: 1, y: 0 }} transition={ENTER}>
      <div className={look.user.width}>
        <div className={cn('mb-1 flex items-center justify-end gap-2', look.user.label)}>
          {canRewind && (
            <button
              title="Rewind the chat (and file changes) to before this message"
              onClick={() => rewind(messageId)}
              className="flex items-center gap-1 text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
            >
              <RotateCcw className="h-3 w-3" /> Rewind
            </button>
          )}
          <MessageTime />
          You
        </div>
        <MessageFiles messageId={messageId} />
        <div className={look.user.box}>
          <MessagePrimitive.Parts components={{ Text: UserTextPart }} />
        </div>
        <LinkFaces text={text} />
      </div>
      </motion.div>
    </MessagePrimitive.Root>
    </>
  )
}

function AssistantMessage({
  messageId,
  statusType,
  reason,
  error,
  notice
}: {
  messageId?: string
  statusType?: string
  reason?: string
  error?: string | null
  notice?: string | null
}) {
  const label = useContext(AgentLabel)
  const agent = useContext(AgentRef)
  const edit = useContext(EditRequest)
  const fork = useContext(ForkRequest)
  const avatarSize = useApp((s) => s.settings?.avatarSize ?? 'small')
  const look = useThreadLook()
  const big = look.agent.bigAvatars ? (BIG_AVATAR[avatarSize] ?? 0) : 0
  const conv = useConversation()
  const liveSession = useSessions((s) => {
    if (!conv.sessionId || !messageId) return null
    const last = (s.messages[conv.sessionId] ?? []).filter((m) => m.role === 'assistant').at(-1)
    return last?.id === messageId ? conv.sessionId : null
  })
  const entrance = useEntrance(messageId)
  return (
    <MessagePrimitive.Root
      onContextMenu={(e) => {
        if (!messageId) return
        const text = messageText(conv.sessionId, messageId)
        openMenu(e, `${label.toLowerCase()} reply`, [
          { label: 'Copy reply', icon: <Copy />, disabled: !text, onSelect: () => void copyText(text, 'Copied', 'The reply, as markdown') },
          { label: 'Copy as plain text', icon: <Copy />, disabled: !text, onSelect: () => void copyText(text.replace(/[*_`#>]/g, ''), 'Copied', 'The reply, as plain text') },
          { label: 'Edit reply…', icon: <Pencil />, disabled: !edit || statusType === 'running', onSelect: () => edit?.(messageId) },
          { label: 'Fork from here', icon: <GitFork />, disabled: !fork || statusType === 'running' || messageId.startsWith('__'), onSelect: () => fork?.(messageId) },
          useSpeech.getState().speaking === messageId
            ? { label: 'Stop reading', icon: <Square />, onSelect: stopSpeaking }
            : { label: 'Read aloud', icon: <Volume2 />, disabled: !text, onSelect: () => void speak(text, agent?.voice ?? null, messageId) }
        ])
      }}
    >
      <motion.div className="flex" initial={entrance} animate={{ opacity: 1, y: 0 }} transition={ENTER}>
      {agent && big > 0 && (
        <div className="mr-3 shrink-0 pt-0.5">
          <AgentAvatar agent={agent} size={big} sessionId={liveSession} />
        </div>
      )}
      <div className={cn('w-full min-w-0', look.agent.width)}>
        <div className={cn('mb-1 flex items-center gap-1.5', look.agent.label)}>
          {agent && big === 0 && look.agent.avatar > 0 && <AgentAvatar agent={agent} size={look.agent.avatar} sessionId={liveSession} />}
          {label}
          <MessageTime />
        </div>
        <div className={look.agent.body}>
          <MessagePrimitive.Parts components={{ Text: AssistantTextPart, Reasoning: ThoughtPart, Empty: EmptyPart, tools: { Fallback: ToolCard } }} />
          {messageId && <DraftPart messageId={messageId} />}
          {messageId && statusType === 'running' && <StatusLine messageId={messageId} />}
          {statusType === 'incomplete' && reason === 'cancelled' && (
            <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-faint">[Stopped]</div>
          )}
          {statusType === 'incomplete' && reason === 'error' && (
            <AlertBox className="mt-2">{error ?? 'Generation failed'}</AlertBox>
          )}
          {notice && <div className="mt-2 border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[12px] text-accent">{notice}</div>}
        </div>
      </div>
      </motion.div>
    </MessagePrimitive.Root>
  )
}

function Composer({ running, placeholder }: { running: boolean; placeholder: string }) {
  const [tool, setTool] = useState<'draw' | 'play' | null>(null)
  const aui = useAui()
  const current = useAuiState((s) => s.composer.text)
  const conv = useConversation()
  const look = useThreadLook().composer
  const owns = useThreadLook().ownsComposer
  const stopping = useSessions((s) => (conv.sessionId ? s.stopping[conv.sessionId] === true : false))
  const all = useComposerHints()
  const typed = useAuiState((s) => (s.composer.isEditing ? s.composer.text : ''))
  const keys = all.map((h) => h.key).join('|')
  const [hidden, setHidden] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)
  useEffect(() => {
    setSelected(0)
    if (hidden !== null && hidden !== keys) setHidden(null)
  }, [keys])
  const hints = hidden === keys ? [] : all
  const pick = Math.min(selected, Math.max(0, hints.length - 1))
  const agent = useContext(AgentRef)
  const { sessionId: activeId } = conv
  const player = useWorldPlayer(agent?.world?.worldId ?? null)
  const append = (text: string) => aui.composer.setText(current.trim() ? `${current.trimEnd()} ${text}` : text)
  return (
    <ComposerPrimitive.Root className={cn('relative flex items-end gap-2', look.root)}>
      {hints.length ? <ComposerHints hints={hints} selected={pick} onSelect={setSelected} /> : <ActiveCommand />}
      {tool === 'draw' && (
        <DrawPanel
          className="absolute inset-x-2 bottom-full z-30 mb-2"
          onClose={() => setTool(null)}
          onUse={(picked) => {
            append(picked.map((p) => p.value).join('\n'))
            setTool(null)
          }}
        />
      )}
      {tool === 'play' && (
        <div className="notch-sm absolute inset-x-2 bottom-full z-30 mb-2 max-h-[70vh] overflow-y-auto border border-accent/60 bg-black/95 p-3">
          <PlayBuilder kind="action" character={player} where={{ link: null, agents: [], onText: append }} />
        </div>
      )}
      {look.avatar > 0 && agent && <AgentAvatar agent={agent} size={look.avatar} sessionId={activeId} className="mr-1" />}
      <ComposerTool title="Attach files" onClick={() => void main('dialog.openFiles').then((paths) => attachPaths(conv.key, paths))}>
        <Paperclip />
      </ComposerTool>
      <ComposerTool title="Draw from a repo or deck" active={tool === 'draw'} onClick={() => setTool(tool === 'draw' ? null : 'draw')}>
        <Shuffle />
      </ComposerTool>
      <ChatComposer conv={conv} running={running} />
      <ComposerTool title="An action or a decision" active={tool === 'play'} onClick={() => setTool(tool === 'play' ? null : 'play')}>
        <Dices />
      </ComposerTool>
      <ComposerPrimitive.Input
        data-seven-composer={owns ? '' : undefined}
        autoFocus
        rows={1}
        maxRows={10}
        submitMode="enter"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (!hints.length) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setSelected((pick + (e.key === 'ArrowDown' ? 1 : hints.length - 1)) % hints.length)
          } else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && hints[pick].key !== typed.trim())) {
            e.preventDefault()
            hints[pick].apply()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setHidden(keys)
          }
        }}
        className={cn('min-h-10 flex-1 resize-none', look.field)}
      />
      {running && stopping ? (
        <div title="Stopping" className={cn('flex h-10 items-center justify-center gap-2 border border-alert/30 font-mono text-[11px] font-semibold uppercase tracking-wider text-alert/70', look.round ? 'w-10' : 'px-3.5')}>
          <Square className="h-3.5 w-3.5 animate-pulse" /> {!look.round && 'Stopping…'}
        </div>
      ) : running ? (
        <ComposerPrimitive.Cancel title="Stop" className={cn('notch-sm flex h-10 items-center justify-center gap-2 border border-alert/60 bg-alert/5 font-mono text-[11px] font-semibold uppercase tracking-wider text-alert hover:bg-alert/15', look.round ? 'w-10' : 'px-3.5')}>
          <Square className="h-3.5 w-3.5" /> {!look.round && 'Stop'}
        </ComposerPrimitive.Cancel>
      ) : (
        <ComposerPrimitive.Send title="Send" className={cn('notch-sm flex h-10 items-center justify-center gap-2 border border-accent bg-gradient-to-b from-accent/20 to-accent/5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent shadow-[0_0_14px_color-mix(in_srgb,var(--color-accent)_20%,transparent)] hover:text-white disabled:opacity-40', look.round ? 'w-10' : 'px-4')}>
          {!look.round && 'Send'} <CornerDownLeft className="h-3.5 w-3.5" />
        </ComposerPrimitive.Send>
      )}
    </ComposerPrimitive.Root>
  )
}

interface ThreadProps {
  agent?: AgentProfile | null
  agentName: string
  running: boolean
  emptyTitle: string
  emptyBody: string
  placeholder: string
  look?: ThreadLookId
}

function EditReplyModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const { sessionId } = useConversation()
  const message = useSessions((s) => (sessionId ? s.messages[sessionId]?.find((m) => m.id === messageId) : undefined))
  const [texts, setTexts] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {}
    message?.parts.forEach((p, i) => {
      if (p.type === 'text') out[i] = p.text
      else if (p.type === 'tool' && p.status === 'done') out[i] = p.result ?? ''
    })
    return out
  })
  const [busy, setBusy] = useState(false)
  if (!message || !sessionId) return null
  const save = async () => {
    setBusy(true)
    try {
      const edits = Object.entries(texts).map(([index, text]) => ({ index: Number(index), text }))
      const next: ChatMessage = await engine('sessions.editReply', { id: sessionId, messageId, edits })
      useSessions.setState((s) => ({ messages: { ...s.messages, [sessionId]: (s.messages[sessionId] ?? []).map((m) => (m.id === next.id ? next : m)) } }))
      toast.success('Reply changed', 'The agent sees your version from your next message.')
      onClose()
    } catch (err) {
      toast.error('Could not change the reply', errorText(err))
    }
    setBusy(false)
  }
  return (
    <Modal
      open
      title="Edit reply"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
        <p className="text-[12.5px] text-dim">Change what the agent wrote or what its tools returned. Empty text is removed. The agent sees your version from your next message.</p>
        {message.parts.map((p, i) =>
          i in texts ? (
            <div key={i} className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">{p.type === 'tool' ? `${p.name} result` : 'Text'}</span>
              {p.type === 'tool' ? <LinkTextarea mono rows={Math.min(12, Math.max(3, (texts[i] ?? '').split('\n').length + 1))} value={texts[i]} onValue={(text) => setTexts({ ...texts, [i]: text })} /> : <MarkdownEditor compact rolls value={texts[i]} onValue={(text) => setTexts({ ...texts, [i]: text })} />}
            </div>
          ) : p.type === 'tool' ? (
            <div key={i} className="font-mono text-[11px] text-faint">{p.name} ({p.status}, can't be edited)</div>
          ) : null
        )}
      </div>
    </Modal>
  )
}

function RewindModal({ messageId, onClose, onDone }: { messageId: string; onClose: () => void; onDone: (text: string) => void }) {
  const { sessionId } = useConversation()
  const [preview, setPreview] = useState<RewindPreview | null>(null)
  const [busy, setBusy] = useState(false)

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!sessionId) return
    let live = true
    engine('sessions.rewindPreview', { id: sessionId, messageId })
      .then((p) => live && setPreview(p))
      .catch((err) => {
        if (!live) return
        toast.error('Cannot rewind', errorText(err))
        closeRef.current()
      })
    return () => {
      live = false
    }
  }, [sessionId, messageId])

  const confirm = async () => {
    if (!sessionId) return
    setBusy(true)
    try {
      const result = await engine('sessions.rewind', { id: sessionId, messageId })
      await useSessions.getState().load(sessionId)
      toast.success('Rewound', result.restored.length ? `${result.restored.length} file(s) restored` : 'No files needed restoring')
      onDone(result.text)
    } catch (err) {
      toast.error('Rewind failed', errorText(err))
    }
    setBusy(false)
    onClose()
  }

  return (
    <Modal
      open
      title="Rewind chat"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={!preview || busy} onClick={() => void confirm()}>
            Rewind
          </Button>
        </>
      }
    >
      {!preview ? (
        <span className="text-dim">Checking what would change…</span>
      ) : (
        <div className="flex flex-col gap-3">
          <p>
            Removes this message and the {preview.messagesRemoved - 1} after it, and puts your message back in the box so you can edit it.
          </p>
          {preview.files.length > 0 ? (
            <div>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent-soft">Files restored to how they were</div>
              <ul className="max-h-40 overflow-auto font-mono text-[12px] text-white/90">
                {preview.files.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-dim">No files were changed by tools after this point.</p>
          )}
          {preview.commands > 0 && (
            <p className="border border-alert/50 border-l-2 border-l-alert bg-alert/5 px-3 py-2 text-[12.5px] text-alert">
              {preview.commands} command{preview.commands > 1 ? 's' : ''} ran after this point. Whatever they changed (files they wrote, packages they installed,
              anything outside the workspace) is not undone.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

export function Thread({ agent = null, agentName, running, emptyTitle, emptyBody, placeholder, look: lookId = 'panel' }: ThreadProps) {
  const look = THREAD_LOOKS[lookId]
  const runtime = useSevenRuntime()
  const [rewindTarget, setRewindTarget] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const conv = useConversation()
  const fileDrop = useFileDrop((paths) => attachPaths(conv.key, paths))
  const activeId = conv.sessionId
  const since = useMemo(() => ({ at: performance.now(), seen: new Set<string>() }), [activeId])
  const pictureHeight = useApp((s) => s.settings?.chatPictureHeight ?? 480)
  const pictures = useMemo(() => ({ height: pictureHeight }), [pictureHeight])
  const viewport = useRef<HTMLDivElement>(null)
  const queued = useQueuedComposer(conv.key)
  const lookAt = useMemo(() => (area: PictureArea) => queueComposer(conv.key, `I look at the ${area.name}`), [conv.key])
  useEffect(() => {
    if (!queued) return
    takeQueuedComposer(conv.key)
    const composer = runtime.thread.composer
    const current = composer.getState().text
    composer.setText(queued.replace || !current.trim() ? queued.text : `${current.trimEnd()} ${queued.text}`)
  }, [queued, runtime])
  useEffect(() => {
    if (!look.ownsComposer) return
    const set = (text: string) => runtime.thread.composer.setText(text)
    composerSetter = set
    if (pendingComposer !== null) {
      set(pendingComposer)
      pendingComposer = null
    }
    return () => {
      if (composerSetter === set) composerSetter = null
    }
  }, [runtime, look.ownsComposer])
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatPictures.Provider value={pictures}>
      <ThreadSince.Provider value={since}>
      <RewindRequest.Provider value={running ? null : setRewindTarget}>
      <EditRequest.Provider value={running ? null : setEditTarget}>
      <ForkRequest.Provider value={running ? null : (messageId: string) => forkAt(conv, messageId)}>
      {editTarget && <EditReplyModal messageId={editTarget} onClose={() => setEditTarget(null)} />}
      {rewindTarget && (
        <RewindModal messageId={rewindTarget} onClose={() => setRewindTarget(null)} onDone={(text) => runtime.thread.composer.setText(text)} />
      )}
      <ThreadLookContext.Provider value={look}>
      <AreaAction.Provider value={lookAt}>
      <AgentRef.Provider value={agent}>
      <AgentLabel.Provider value={agentName.toUpperCase()}>
        <ThreadPrimitive.Root
          className="relative flex min-h-0 flex-1 flex-col"
          {...fileDrop.props}
        >
          <StageOverlay />
          <DropOverlay show={fileDrop.over} label="Drop files to attach" />
          <ThreadPrimitive.Viewport ref={viewport} className={cn('relative min-h-0 flex-1 overflow-y-auto', look.viewport)}>
            <ThreadPrimitive.Empty>
              <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>
            </ThreadPrimitive.Empty>
            <div className={look.column}>
              <VirtualMessages viewport={viewport} />
            </div>
            <ThreadPrimitive.ScrollToBottom className="sticky bottom-2 left-full flex h-8 w-8 items-center justify-center border border-line bg-black/80 text-accent hover:border-accent disabled:invisible">
              <ArrowDown className="h-4 w-4" />
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.Viewport>
          <SummaryCard />
          <CommandOutputCard />
          <TodoBar compact={look.compactBars} />
          {look.divider && <div className="border-t border-line/60" />}
          <DraftFiles />
          <ComposerReferences />
          {look.outputs && <OutputTray />}
          <ChatHand conv={conv} agent={agent} running={running} />
          <Composer running={running} placeholder={placeholder} />
        </ThreadPrimitive.Root>
      </AgentLabel.Provider>
      </AgentRef.Provider>
      </AreaAction.Provider>
      </ThreadLookContext.Provider>
      </ForkRequest.Provider>
      </EditRequest.Provider>
      </RewindRequest.Provider>
      </ThreadSince.Provider>
      </ChatPictures.Provider>
    </AssistantRuntimeProvider>
  )
}
