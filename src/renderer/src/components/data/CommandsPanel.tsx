import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { CommandInfo, CustomCommand } from '@shared/types'
import { Button, EmptyState, Field, Input, Panel, MakeOrSaved, useAutosavedState, ListRow, RowAction, confirmDelete } from '../ui'
import { engine, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { useCommands } from '../../store/commands'
import { LinkTextarea } from './LinkTextarea'
import { rowMenu } from '../../views/data/entryMenu'
import { useBusy } from '../../lib/useBusy'
import { focusedConversation } from '../../lib/conversation'

interface Draft {
  id: string | null
  name: string
  summary: string
  prompt: string
}

const BLANK: Draft = { id: null, name: '', summary: '', prompt: '' }

function useCustom(): CustomCommand[] {
  const [list, setList] = useState<CustomCommand[]>([])
  useEffect(() => {
    void engine('commands.custom.list')
      .then(setList)
      .catch(() => undefined)
    return on('commands.changed', setList)
  }, [])
  return list
}

function Editor({ start, onSaved }: { start: Draft; onSaved: (id: string) => void }) {
  const valid = (d: Draft) => Boolean(d.name.trim() && d.prompt.trim())
  const editor = useAutosavedState<Draft>(
    start,
    async (d) => {
      await engine('commands.custom.save', d)
      void useCommands.getState().load(focusedConversation())
    },
    { when: (d) => Boolean(d.id) && valid(d) }
  )
  const [busy, run] = useBusy()
  const draft = editor.value
  const edit = (patch: Partial<Draft>) => editor.set((d) => ({ ...d, ...patch }))
  const make = () =>
    void run(async () => {
      const saved = await engine('commands.custom.save', draft)
      toast.success('Command made', `/${saved.name}`)
      void useCommands.getState().load(focusedConversation())
      onSaved(saved.id)
    }, 'Could not make the command')
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
      <Field label="Name" hint="What you type after the slash.">
        <Input value={draft.name} onChange={(e) => edit({ name: e.target.value })} placeholder="vary" className="font-mono" />
      </Field>
      <Field label="Summary" hint="One line, shown in the / list and /help.">
        <Input value={draft.summary} onChange={(e) => edit({ summary: e.target.value })} placeholder="Three takes on something, each different in tone and angle." />
      </Field>
      <Field label="Prompt" hint="What the agent gets. {args} is replaced with what you type after the command; without it, what you type goes on the end. @kind:Name links work here too.">
        <LinkTextarea mono rolls={false} rows={10} value={draft.prompt} onValue={(prompt) => edit({ prompt })} placeholder="Give me three versions of {args} that differ in tone, length and angle." />
      </Field>
      <div className="flex items-center gap-2">
        <MakeOrSaved made={Boolean(draft.id)} saver={editor} what="command" onMake={make} disabled={busy || !valid(draft)} size="md" />
      </div>
    </div>
  )
}

export function CommandsPanel({ initial }: { initial?: string | null }) {
  const custom = useCustom()
  const [builtin, setBuiltin] = useState<CommandInfo[]>([])
  useEffect(() => {
    void engine('commands.list', { sessionId: null, agentId: '' })
      .then(setBuiltin)
      .catch(() => undefined)
  }, [custom])
  const [pick, setPick] = useState<string | null>(initial && initial !== 'all' ? initial : null)
  const mine = pick === '_new' ? null : (custom.find((c) => c.id === pick || c.name === pick) ?? null)
  const shown = mine ?? (pick === '_new' ? null : builtin.find((c) => c.name === pick) ?? null)
  const editing = pick === '_new' ? BLANK : mine ? { id: mine.id, name: mine.name, summary: mine.summary, prompt: mine.prompt } : null
  const others = builtin.filter((b) => !custom.some((c) => c.name === b.name))
  const remove = (c: CustomCommand) =>
    confirmDelete(`Delete /${c.name}?`, 'It stops working everywhere straight away.', () => engine('commands.custom.delete', { id: c.id }), () => {
      void useCommands.getState().load(focusedConversation())
      setPick(null)
    })
  return (
    <Panel
      className="flex-1"
      title="Commands"
      bodyClassName="flex min-h-0 gap-3 p-3"
      actions={
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setPick('_new')}>
          New command
        </Button>
      }
    >
      <div className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-line/40 pr-2">
        <div className="px-2.5 pb-1 pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">Yours</div>
        {custom.length === 0 && <div className="px-2.5 py-1 text-[12px] text-faint">None yet.</div>}
        {custom.map((c) => (
          <ListRow
            key={c.id}
            active={mine?.id === c.id}
            onClick={() => setPick(c.id)}
            onMenu={rowMenu('command', c.name, `/${c.name}`, () => setPick(c.id))}
            title={`/${c.name}`}
            mono
            subtitle={c.summary || undefined}
            actions={<RowAction title="Delete" icon={<Trash2 />} danger onClick={() => remove(c)} />}
          />
        ))}
        <div className="mt-3 px-2.5 pb-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">Built in</div>
        {others.map((b) => (
          <ListRow key={b.name} active={!mine && shown?.name === b.name} onClick={() => setPick(b.name)} title={`/${b.name}`} mono subtitle={b.summary} />
        ))}
      </div>
      {editing ? (
        <Editor key={editing.id ?? '_new'} start={editing} onSaved={setPick} />
      ) : shown && 'usage' in shown ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="font-mono text-[14px] text-white">/{shown.name}</div>
          <div className="text-[12.5px] text-dim">Built in, so it can't be changed.</div>
          <div className="whitespace-pre-wrap text-[13px] text-white/85">{shown.usage}</div>
        </div>
      ) : (
        <EmptyState title="Commands">Pick one on the left, or make your own with New command.</EmptyState>
      )}
    </Panel>
  )
}
