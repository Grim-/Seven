import { useCallback, useEffect, useState } from 'react'
import { Copy, MessageSquare, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import type { JournalEntry, Memory, MindHit, MindIndexing, MindOverview, Thought } from '@shared/types'
import { Button, EmptyState, Input, Panel, Select, ShellTabs, Toggle, openMenu, DoneEditing, useAutosavedState, confirmDelete } from '../ui'
import { Markdown } from '../chat/Markdown'
import { AgentAvatar } from '../agents/look'
import { engine, on } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { useAgents } from '../../store/agents'
import { isLockedError } from '../../store/vault'
import { toast } from '../../store/toasts'
import { openChat } from '../../lib/library'
import { LockedState } from '../vault/Vault'
import { cn } from '../../lib/cn'
import { failed, copyText } from '../../lib/notify'
import { MarkdownEditor } from '../data/MarkdownEditor'

type Tab = 'memories' | 'thoughts' | 'journal' | 'search'

function when(at: number): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function useMindData<T>(agentId: string, load: () => Promise<T>, deps: unknown[] = []): { data: T | null; locked: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [locked, setLocked] = useState(false)
  const run = useCallback(() => {
    load()
      .then((d) => {
        setData(d)
        setLocked(false)
      })
      .catch((err) => {
        if (isLockedError(err)) setLocked(true)
        else toast.error('Could not read this mind', errorText(err))
      })
  }, deps)
  useEffect(() => {
    run()
    return on('mind.changed', (p) => p.agentId === agentId && run())
  }, [run, agentId])
  return { data, locked }
}


function MemoryRow({ agentId, memory }: { agentId: string; memory: Memory }) {
  const write = (patch: { text?: string; pinned?: boolean }) => engine('mind.remember', { agentId, id: memory.id, text: patch.text ?? memory.text, pinned: patch.pinned ?? memory.pinned })
  const save = (patch: { pinned: boolean }) => write(patch).catch(failed('Could not save'))
  const editor = useAutosavedState<string | null>(null, (t) => write({ text: t! }), { when: (t) => Boolean(t?.trim()) })
  const text = editor.value
  const setTextState = editor.reset
  const forget = () => confirmDelete('Forget this memory?', memory.text, () => engine('mind.forget', { agentId, id: memory.id }), undefined, 'Forget')
  const menu = (e: React.MouseEvent) =>
    openMenu(e, 'Memory', [
      { label: 'Edit', icon: <Pencil />, onSelect: () => setTextState(memory.text) },
      { label: memory.pinned ? 'Unpin' : 'Pin: in every chat', icon: memory.pinned ? <PinOff /> : <Pin />, onSelect: () => void save({ pinned: !memory.pinned }) },
      { label: 'Copy', icon: <Copy />, onSelect: () => void copyText(memory.text, 'Copied', 'The memory') },
      ...(memory.sessionId ? [{ label: 'Open the chat', icon: <MessageSquare />, onSelect: () => openChat(memory.sessionId!) }] : []),
      { label: '', separator: true },
      { label: 'Forget', icon: <Trash2 />, danger: true, onSelect: forget }
    ])
  return (
    <div onContextMenu={text === null ? menu : undefined} className={cn('group flex gap-2 border-b border-line/30 py-2', memory.pinned && 'border-l-2 border-l-accent pl-2')}>
      <div className="min-w-0 flex-1">
        {text === null ? (
          <div role="button" tabIndex={0} onClick={() => setTextState(memory.text)} onKeyDown={(e) => e.key === 'Enter' && setTextState(memory.text)} className="w-full cursor-text text-left text-[13px] text-white/90 hover:text-white">
            <Markdown text={memory.text} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <MarkdownEditor compact rolls autoFocus value={text} onValue={editor.set} />
            <div className="flex items-center gap-1.5">
              <DoneEditing saver={editor} onDone={() => editor.reset(null)} />
            </div>
          </div>
        )}
        <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-teal/70">
          {memory.pinned ? 'pinned · ' : ''}
          {memory.by === 'user' ? 'by you' : memory.by === 'auto' ? 'picked out automatically' : 'by the agent'} · {when(memory.updatedAt)}
          {memory.sessionId && (
            <button className="ml-2 text-accent hover:text-white" onClick={() => openChat(memory.sessionId!)}>
              open chat
            </button>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-1 opacity-60 group-hover:opacity-100">
        <Button size="sm" variant="ghost" title={memory.pinned ? 'Unpin' : 'Pin: in every chat'} icon={memory.pinned ? <PinOff /> : <Pin />} onClick={() => void save({ pinned: !memory.pinned })} />
        <Button
          size="sm"
          variant="ghost"
          title="Forget"
          icon={<Trash2 />}
          onClick={forget}
        />
      </div>
    </div>
  )
}

function Memories({ agentId }: { agentId: string }) {
  const { data } = useMindData(agentId, () => engine('mind.memories', { agentId }), [agentId])
  const [text, setText] = useState('')
  const [pinned, setPinned] = useState(false)
  const add = () =>
    void engine('mind.remember', { agentId, id: null, text, pinned })
      .then(() => setText(''))
      .catch(failed('Could not save'))
  if (!data) return null
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-start gap-2">
        <MarkdownEditor compact rolls value={text} onValue={setText} placeholder="Something for this agent to remember" className="min-w-0 flex-1" />
        <div className="flex flex-col gap-1.5">
          <Toggle checked={pinned} onChange={setPinned} label="Pin" />
          <Button size="sm" variant="primary" icon={<Plus />} disabled={!text.trim()} onClick={add}>
            Add
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {data.length ? data.map((m) => <MemoryRow key={`${m.id}${m.updatedAt}`} agentId={agentId} memory={m} />) : <EmptyState title="No memories yet">Pinned memories are in every chat; the rest the agent recalls when it needs them.</EmptyState>}
      </div>
    </div>
  )
}

function ThoughtItem({ agentId, thought }: { agentId: string; thought: Thought }) {
  const [open, setOpen] = useState(false)
  const remove = () => void engine('mind.forgetThought', { agentId, id: thought.id }).catch(failed('Could not delete'))
  const menu = (e: React.MouseEvent) =>
    openMenu(e, thought.kind === 'reason' ? 'Reasoning' : 'Thought', [
      { label: open ? 'Hide the working' : 'Show the working', onSelect: () => setOpen(!open) },
      { label: 'Copy the conclusion', icon: <Copy />, onSelect: () => void copyText(thought.conclusion, 'Copied', 'The conclusion') },
      { label: '', separator: true },
      { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: remove }
    ])
  return (
    <div onContextMenu={menu} className="border-b border-line/30 py-2">
      <div className="group flex items-baseline gap-2">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
          <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-teal/70">{when(thought.at)}</span>
          <span className="shrink-0 border border-line px-1 font-mono text-[10px] uppercase text-accent">{thought.kind === 'reason' ? (thought.style ?? 'reason') : 'thought'}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-white/90">{thought.conclusion}</span>
        </button>
        <button title="Delete" className="shrink-0 self-center text-faint opacity-60 hover:text-alert group-hover:opacity-100" onClick={remove}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-col gap-2 pl-2">
          {thought.question && <div className="whitespace-pre-wrap text-[13px] text-accent-soft">{thought.question}</div>}
          {thought.reasoning && <pre className="whitespace-pre-wrap font-mono text-[12px] text-white/80">{thought.reasoning}</pre>}
          <div className="text-[13px]">
            <Markdown text={`**Conclusion:** ${thought.conclusion}`} />
          </div>
          <div className="flex gap-3 font-mono text-[10.5px] uppercase tracking-[0.12em]">
            {thought.sessionId && (
              <button className="text-accent hover:text-white" onClick={() => openChat(thought.sessionId!)}>
                Open chat
              </button>
            )}
            <button className="text-dim hover:text-alert" onClick={remove}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Thoughts({ agentId }: { agentId: string }) {
  const [month, setMonth] = useState<string | null>(null)
  const { data } = useMindData(agentId, () => engine('mind.thoughts', { agentId, month }), [agentId, month])
  if (!data) return null
  if (!data.thoughts.length) return <EmptyState title="No thoughts yet">What the agent thinks and reasons shows here. It keeps the conclusions; only you read the rest.</EmptyState>
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={data.month ?? ''} options={data.months.map((m) => ({ value: m, label: m }))} onChange={(v) => setMonth(v)} className="h-8 w-40 text-[12px]" />
        <span className="font-mono text-[11px] text-faint">{data.thoughts.length} thoughts</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {data.thoughts.map((t) => (
          <ThoughtItem key={t.id} agentId={agentId} thought={t} />
        ))}
      </div>
    </div>
  )
}

function JournalItem({ agentId, entry }: { agentId: string; entry: JournalEntry }) {
  const [open, setOpen] = useState(false)
  const remove = () => void engine('mind.forgetJournal', { agentId, id: entry.id }).catch(failed('Could not delete'))
  const menu = (e: React.MouseEvent) =>
    openMenu(e, 'Journal', [
      { label: open ? 'Hide the details' : 'Show the details', onSelect: () => setOpen(!open) },
      ...(entry.sessionId ? [{ label: 'Open the chat', icon: <MessageSquare />, onSelect: () => openChat(entry.sessionId!) }] : []),
      { label: '', separator: true },
      { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: remove }
    ])
  return (
    <div onContextMenu={menu} className="border-b border-line/30 py-2">
      <div className="group flex items-baseline gap-2">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
          <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-teal/70">{when(entry.at)}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-white/90">{entry.user || '(no message)'}</span>
          <span className="shrink-0 truncate text-[11px] text-faint">{entry.sessionTitle}</span>
        </button>
        <button title="Delete" className="shrink-0 self-center text-faint opacity-60 hover:text-alert group-hover:opacity-100" onClick={remove}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-col gap-2 pl-2">
          <div className="text-[13px] text-accent-soft">You: {entry.user}</div>
          {entry.thoughts && (
            <details className="text-[12px] text-dim">
              <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.12em]">Thinking</summary>
              <pre className="whitespace-pre-wrap font-mono text-[11.5px]">{entry.thoughts}</pre>
            </details>
          )}
          {entry.tools.map((t, i) => (
            <details key={i} className="text-[12px] text-dim">
              <summary className="cursor-pointer font-mono text-[11px] text-teal">{t.name}</summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{t.result}</pre>
            </details>
          ))}
          <div className="text-[13px]">
            <Markdown text={entry.reply || '(no reply)'} />
          </div>
          <div>
            <button className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent hover:text-white" onClick={() => openChat(entry.sessionId)}>
              Open chat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Journal({ agentId }: { agentId: string }) {
  const [month, setMonth] = useState<string | null>(null)
  const { data } = useMindData(agentId, () => engine('mind.journal', { agentId, month }), [agentId, month])
  if (!data) return null
  if (!data.entries.length) return <EmptyState title="No journal yet">Every turn this agent takes is saved here automatically.</EmptyState>
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={data.month ?? ''} options={data.months.map((m) => ({ value: m, label: m }))} onChange={(v) => setMonth(v)} className="h-8 w-40 text-[12px]" />
        <span className="font-mono text-[11px] text-faint">{data.entries.length} turns</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {data.entries.map((e) => (
          <JournalItem key={e.id} agentId={agentId} entry={e} />
        ))}
      </div>
    </div>
  )
}

function SearchTab({ agentId }: { agentId: string }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<MindHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!query.trim()) return
    setBusy(true)
    try {
      setHits(await engine('mind.search', { agentId, query, limit: 30 }))
    } catch (err) {
      toast.error('Search failed', errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex gap-2">
        <Input autoFocus placeholder="Search memories and journal, the way recall does" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void run()} className="flex-1" />
        <Button variant="primary" icon={<Search />} disabled={busy || !query.trim()} onClick={() => void run()}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {hits?.length === 0 && <div className="p-3 text-[13px] text-dim">Nothing found.</div>}
        {hits?.map((h) => (
          <div key={h.id} className="border-b border-line/30 py-2">
            <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em]">
              <span className="border border-line px-1 text-accent">{h.source}</span>
              <span className="text-teal/70">{when(h.at)}</span>
              {h.similarity !== null && <span className="text-faint">match {(h.similarity * 100).toFixed(0)}%</span>}
            </div>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-[12.5px] text-white/90">{h.text}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MindView({ agentId }: { agentId: string }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === agentId))
  const [tab, setTab] = useState<Tab>('memories')
  const [indexing, setIndexing] = useState<MindIndexing | null>(null)
  const { data: overview, locked } = useMindData<MindOverview>(agentId, () => engine('mind.overview', { agentId }), [agentId])
  useEffect(() => on('mind.indexing', (p) => p.agentId === agentId && setIndexing(p.done >= p.total ? null : p)), [agentId])
  if (locked)
    return (
      <Panel className="flex-1">
        <LockedState what="This agent's mind" />
      </Panel>
    )
  return (
    <Panel
      className="flex-1"
      title={
        <span className="flex items-center gap-2.5">
          <AgentAvatar agent={agent} size={26} />
          {agent?.name ?? 'Agent'} · mind
        </span>
      }
      bodyClassName="flex min-h-0 flex-col gap-3 p-3"
    >
      {overview && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-dim">
          <span>
            {overview.memories} memories, {overview.pinned} pinned
          </span>
          <span>{overview.thoughts} thoughts</span>
          <span>{overview.journal} turns</span>
          <span>
            {overview.chunks} pieces indexed{overview.chunks ? `, ${overview.indexed} by meaning` : ''}
          </span>
          {indexing && (
            <span className="text-accent">
              indexing {indexing.done}/{indexing.total}
            </span>
          )}
        </div>
      )}
      <ShellTabs
        value={tab}
        options={[
          { value: 'memories', label: 'Memories' },
          { value: 'thoughts', label: 'Thoughts' },
          { value: 'journal', label: 'Journal' },
          { value: 'search', label: 'Search' }
        ]}
        onChange={setTab}
      />
      {tab === 'memories' && <Memories key={agentId} agentId={agentId} />}
      {tab === 'thoughts' && <Thoughts key={agentId} agentId={agentId} />}
      {tab === 'journal' && <Journal key={agentId} agentId={agentId} />}
      {tab === 'search' && <SearchTab key={agentId} agentId={agentId} />}
    </Panel>
  )
}
