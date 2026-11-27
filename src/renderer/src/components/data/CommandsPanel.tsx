import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type { CommandArg, CommandInfo, CustomCommand } from '@shared/types'
import {
  argLabel,
  commandVariables,
  parsePromptSegments,
  promptPlaceholders,
  sanitizeArgName
} from '@shared/commandArgs'
import { Button, EmptyState, Field, Input, Panel, MakeOrSaved, useAutosavedState, ListRow, RowAction, confirmDelete } from '../ui'
import { engine, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { useCommands } from '../../store/commands'
import { LinkTextarea } from './LinkTextarea'
import { CommandLine } from '../chat/CommandLine'
import { rowMenu } from '../../views/data/entryMenu'
import { useBusy } from '../../lib/useBusy'
import { focusedConversation } from '../../lib/conversation'
import { noteFailure } from '../../store/problems'

interface Draft {
  id: string | null
  name: string
  summary: string
  prompt: string
  args: CommandArg[]
}

const BLANK: Draft = { id: null, name: '', summary: '', prompt: '', args: [] }

function useCustom(): CustomCommand[] {
  const [list, setList] = useState<CustomCommand[]>([])
  useEffect(() => {
    void engine('commands.custom.list')
      .then(setList)
      .catch(noteFailure('commands', 'Could not list your commands'))
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
  const resolvedVars = commandVariables(draft.prompt, draft.args)
  const varByName = new Map(resolvedVars.map((v) => [v.name.toLowerCase(), v]))
  const definedLower = new Set(draft.args.map((a) => sanitizeArgName(a.name)))
  const undetected = promptPlaceholders(draft.prompt).filter((n) => !definedLower.has(n.toLowerCase()))
  const segments = parsePromptSegments(draft.prompt)

  const addArg = (name = '') => {
    const clean = sanitizeArgName(name)
    const fallback = clean || `arg_${draft.args.length + 1}`
    if (draft.args.some((a) => sanitizeArgName(a.name) === fallback)) return
    edit({ args: [...draft.args, { name: fallback }] })
  }

  const updateArg = (idx: number, patch: Partial<CommandArg>) =>
    edit({
      args: draft.args.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    })

  const moveArg = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= draft.args.length) return
    const next = [...draft.args]
    const [item] = next.splice(idx, 1)
    next.splice(target, 0, item)
    edit({ args: next })
  }

  const removeArg = (idx: number) => edit({ args: draft.args.filter((_, i) => i !== idx) })

  const insertPlaceholder = (name: string) => {
    const clean = sanitizeArgName(name)
    if (!clean) return
    const token = `{${clean}}`
    const cur = draft.prompt
    const sep = !cur || /[\s("']$/.test(cur) ? '' : ' '
    edit({ prompt: `${cur}${sep}${token}` })
  }

  const make = () =>
    void run(async () => {
      const saved = await engine('commands.custom.save', draft)
      toast.success('Command made', `/${saved.name}`)
      void useCommands.getState().load(focusedConversation())
      onSaved(saved.id)
    }, 'Could not make the command')

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <Field label="Name" hint="What you type after the slash.">
        <Input value={draft.name} onChange={(e) => edit({ name: e.target.value })} placeholder="describe" className="font-ui" />
      </Field>
      <Field label="Summary" hint="One line, shown in the / list and /help.">
        <Input value={draft.summary} onChange={(e) => edit({ summary: e.target.value })} placeholder="Three takes on something, each different in tone and angle." />
      </Field>
      <Field
        label="Variables"
        hint="Optional placeholders you can drop into the prompt as {name}, then fill with Tab or by clicking pills in chat."
      >
        <div className="flex flex-col gap-2 border border-line/60 tone-panel-30 p-2.5">
          {draft.args.length === 0 ? (
            <div className="flex items-center justify-between gap-2 text-[12px] text-dim">
              <span>No variables defined yet (use {'{var_name}'} in Prompt or click Add variable).</span>
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => addArg()}>
                Add variable
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {draft.args.map((arg, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-1.5 border border-line/50 tone-sidebar-80 px-2 py-1.5">
                  <span className="font-ui text-[10px] text-faint">#{idx + 1}</span>
                  <Input
                    value={arg.name}
                    onChange={(e) => updateArg(idx, { name: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                    onBlur={() => updateArg(idx, { name: sanitizeArgName(arg.name) || `arg_${idx + 1}` })}
                    placeholder="variable_name"
                    className="h-7 w-40 font-ui text-[12px]"
                  />
                  <Input
                    value={arg.hint ?? ''}
                    onChange={(e) => updateArg(idx, { hint: e.target.value })}
                    placeholder="Placeholder hint…"
                    className="h-7 min-w-[9rem] flex-1 text-[12px]"
                  />
                  <Input
                    value={arg.default ?? ''}
                    onChange={(e) => updateArg(idx, { default: e.target.value })}
                    placeholder="Default (optional)"
                    className="h-7 w-36 text-[12px]"
                  />
                  <button
                    type="button"
                    title="Insert into prompt"
                    onClick={() => insertPlaceholder(arg.name)}
                    className="inline-flex h-7 items-center border border-tint-orange/45 bg-tint-orange/10 px-2 font-ui text-[11px] font-semibold text-ink hover:border-tint-orange hover:bg-tint-orange/20"
                  >
                    + {'{'}
                    {sanitizeArgName(arg.name) || '...'}
                    {'}'}
                  </button>
                  <button
                    type="button"
                    title="Move up"
                    disabled={idx === 0}
                    onClick={() => moveArg(idx, -1)}
                    className="grid h-7 w-6 place-items-center text-dim hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    disabled={idx === draft.args.length - 1}
                    onClick={() => moveArg(idx, 1)}
                    className="grid h-7 w-6 place-items-center text-dim hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Remove variable"
                    onClick={() => removeArg(idx)}
                    className="grid h-7 w-6 place-items-center text-dim hover:text-alert"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex justify-end pt-0.5">
                <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => addArg()}>
                  Add variable
                </Button>
              </div>
            </div>
          )}
          {undetected.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-1.5 text-[11px] text-dim">
              <span>Used in prompt:</span>
              {undetected.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addArg(name)}
                  className="inline-flex items-center gap-1 border border-dashed border-tint-orange/55 px-1.5 py-0.5 font-ui text-[11px] text-ink/90 hover:border-tint-orange hover:bg-tint-orange/15"
                >
                  + {'{' + name + '}'}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>
      <Field
        label="Prompt"
        hint="What the agent gets. Place {variable_name} or {args} anywhere inside; without placeholders, typed text is added on the end. @kind:Name links work here too."
      >
        <LinkTextarea
          mono
          rolls={false}
          rows={8}
          value={draft.prompt}
          onValue={(prompt) => edit({ prompt })}
          placeholder="Write a dedicated paragraph describing {description_target} in detail, written in {description_writing_style}."
        />
      </Field>
      {draft.prompt.trim() && (
        <Field label="Pieces preview" hint="How this command's variable pills appear above the chat box.">
          <CommandLine compact>
            {segments.map((seg, i) => {
              if (seg.type === 'text') return <span key={i} className="whitespace-pre-wrap">{seg.value}</span>
              const def = varByName.get(seg.name.toLowerCase()) ?? { name: seg.name }
              return (
                <span
                  key={i}
                  title={def.hint || def.name}
                  className="mx-0.5 inline-flex h-[24px] items-center border border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_10%,transparent)] px-2 font-ui text-[12.5px] font-semibold text-ink"
                >
                  {def.default ? `${argLabel(def)} (${def.default})` : argLabel(def)}
                </span>
              )
            })}
          </CommandLine>
        </Field>
      )}
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
      .catch(noteFailure('commands', 'Could not list the commands'))
  }, [custom])
  const [pick, setPick] = useState<string | null>(initial && initial !== 'all' ? initial : null)
  const mine = pick === '_new' ? null : (custom.find((c) => c.id === pick || c.name === pick) ?? null)
  const shown = mine ?? (pick === '_new' ? null : builtin.find((c) => c.name === pick) ?? null)
  const editing =
    pick === '_new'
      ? BLANK
      : mine
        ? { id: mine.id, name: mine.name, summary: mine.summary, prompt: mine.prompt, args: mine.args ?? [] }
        : null
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
        <div className="px-2.5 pb-1 pt-0.5 font-label text-[10.5px] caps-14 text-accent-soft">Yours</div>
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
        <div className="mt-3 px-2.5 pb-1 font-label text-[10.5px] caps-14 text-accent-soft">Built in</div>
        {others.map((b) => (
          <ListRow key={b.name} active={!mine && shown?.name === b.name} onClick={() => setPick(b.name)} title={`/${b.name}`} mono subtitle={b.summary} />
        ))}
      </div>
      {editing ? (
        <Editor key={editing.id ?? '_new'} start={editing} onSaved={setPick} />
      ) : shown && 'usage' in shown ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="font-ui text-[14px] text-ink">/{shown.name}</div>
          <div className="text-[12.5px] text-dim">Built in, so it can't be changed.</div>
          <div className="whitespace-pre-wrap text-[13px] text-ink/85">{shown.usage}</div>
        </div>
      ) : (
        <EmptyState title="Commands">Pick one on the left, or make your own with New command.</EmptyState>
      )}
    </Panel>
  )
}
