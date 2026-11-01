import { useEffect, useState } from 'react'
import { MessageSquare, Play, Plus } from 'lucide-react'
import { PERMISSION_MODES, type PermissionMode } from '@shared/types'
import { ROUTINE_REPEATS, type Routine, type RoutineDraft, type RoutineWhen } from '@shared/routines'
import { Button, EmptyState, Field, Input, Panel, Select, Toggle, MakeOrSaved, useAutosavedState } from '../ui'
import { engine, on } from '../../lib/ipc'
import { formatRelative } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useAgents } from '../../store/agents'
import { AgentSelect } from '../agents/AgentSelect'
import { openChat } from '../../lib/library'
import type { KindScreenProps } from '../../registries/kinds'
import type { DataSelection } from '../../store/data'
import { LinkTextarea } from './LinkTextarea'
import { cn } from '../../lib/cn'
import { entryMenuAt } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'
import { useBusy } from '../../lib/useBusy'
import { useKindInfos } from '../../lib/kinds'

export const NEW_ROUTINE = '_new'


export function useRoutines(): Routine[] | null {
  const [list, setList] = useState<Routine[] | null>(null)
  useEffect(() => {
    void engine('routines.list')
      .then(setList)
      .catch(() => setList([]))
    return on('routines.changed', setList)
  }, [])
  return list
}

function localInput(at: number): string {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nextHour(): number {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d.getTime()
}

function blank(agentId: string): RoutineDraft {
  return { id: null, name: '', agentId, instruction: '', when: { type: 'schedule', at: nextHour(), repeat: 'daily' }, output: { chat: 'new', page: null, notify: true }, permissionMode: null, enabled: true }
}

function draftOf(r: Routine): RoutineDraft {
  return { id: r.id, name: r.name, agentId: r.agentId, instruction: r.instruction, when: r.when, output: r.output, permissionMode: r.permissionMode, enabled: r.enabled }
}

export function routineStatus(r: Routine): string {
  if (r.running) return 'running now'
  const parts = [r.enabled ? (r.next ? `next ${new Date(r.next).toLocaleString()}` : r.when.type === 'event' ? 'watching' : 'nothing due') : 'off']
  if (r.lastRun) parts.push(`last ran ${formatRelative(r.lastRun)}${r.lastError ? ' (failed)' : ''}`)
  return parts.join(' · ')
}

function Editor({ start, select }: { start: RoutineDraft; select: (s: DataSelection | null) => void }) {
  const routines = useRoutines()
  const live = start.id ? routines?.find((r) => r.id === start.id) : undefined
  const kinds = useKindInfos()
  const [busy, run] = useBusy()
  const payload = ({ draft: d, link }: { draft: RoutineDraft; link: string }) => {
    const when = d.when.type === 'event' && !link.trim() ? { ...d.when, entry: null } : d.when
    return { ...d, when, entryLink: d.when.type === 'event' ? link : null }
  }
  const editor = useAutosavedState({ draft: start, link: start.when.type === 'event' && start.when.entry ? `@${start.when.kind}:${start.when.entry}` : '' }, (v) => engine('routines.save', payload(v)), { when: () => Boolean(start.id) })
  const { draft, link: entryLink } = editor.value
  const set = (patch: Partial<RoutineDraft>) => editor.set((v) => ({ ...v, draft: { ...v.draft, ...patch } }))
  const setLink = (link: string) => editor.set((v) => ({ ...v, link }))
  const setWhen = (when: RoutineWhen) => set({ when })
  const w = draft.when

  const create = () =>
    void run(async () => {
      const saved = await engine('routines.save', payload(editor.value))
      toast.success('Routine made', saved.name)
      select({ kind: 'routine', id: saved.id })
    }, 'Could not make the routine')
  const runNow = () =>
    void engine('routines.run', { id: start.id! })
      .then(() => toast.info('Routine started', 'It runs in its own chat.'))
      .catch(failed('Could not run it'))
  const enable = (on: boolean) => {
    if (!start.id) return set({ enabled: on })
    void engine('routines.enable', { id: start.id, on })
      .then(() => editor.reset({ ...editor.value, draft: { ...editor.value.draft, enabled: on } }))
      .catch(failed('Could not change it'))
  }

  return (
    <Panel
      className="flex-1"
      title="Routine"
      meta={live ? routineStatus(live) : 'not saved yet'}
      bodyClassName="flex min-h-0 flex-col gap-4 overflow-y-auto p-4"
      actions={
        <>
          {live?.lastChat && (
            <Button size="sm" variant="ghost" icon={<MessageSquare />} onClick={() => openChat(live.lastChat!)}>
              Last chat
            </Button>
          )}
          <MakeOrSaved made={Boolean(start.id)} saver={editor} what="routine" onMake={create} disabled={busy} />
          {start.id && (
            <Button size="sm" variant="ghost" icon={<Play />} disabled={live?.running} title="Run it now" onClick={() => void editor.flush().then(runNow)}>
              Run now
            </Button>
          )}
        </>
      }
    >
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            if (start.id) void editor.flush()
            else create()
          }
        }}
      >
        <div className="flex items-center gap-3">
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Morning briefing" className="flex-1 text-[16px] font-semibold" aria-label="Name" />
          <Toggle checked={draft.enabled} onChange={enable} label={draft.enabled ? 'On' : 'Off'} />
        </div>
        {live?.lastError && <div className="border border-alert/50 border-l-2 border-l-alert bg-alert/5 px-3 py-2 text-[12.5px] text-alert">Last run failed: {live.lastError}</div>}

        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <Field label="Who" hint="The agent that runs it, with its own tools and memory.">
            <AgentSelect value={draft.agentId} onChange={(agentId) => set({ agentId })} />
          </Field>
          <Field label="Permission mode" hint="For its chat. Approvals it needs wait there, with a notification.">
            <Select value={draft.permissionMode ?? ''} options={[{ value: '', label: "The agent's own" }, ...PERMISSION_MODES.map((m) => ({ value: m.id, label: m.label }))]} onChange={(v) => set({ permissionMode: (v || null) as PermissionMode | null })} />
          </Field>
        </div>

        <Field label="What it does" hint="Written like a message to the agent. @links attach entries, the same as in chat.">
          <div className="flex min-h-36">
            <LinkTextarea rows={6} value={draft.instruction} onValue={(instruction) => set({ instruction })} placeholder="Read @day:yesterday and give me a short summary of what I worked on." />
          </div>
        </Field>

        <div className="flex flex-col gap-3 border-t border-line/40 pt-3">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent-soft">When</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <Field label="Runs">
              <Select
                value={w.type}
                options={[
                  { value: 'schedule', label: 'On a schedule' },
                  { value: 'event', label: 'When something happens' }
                ]}
                onChange={(v) => setWhen(v === 'schedule' ? { type: 'schedule', at: nextHour(), repeat: 'daily' } : { type: 'event', kind: 'page', entry: null, action: 'any', byUser: true })}
              />
            </Field>
            {w.type === 'schedule' ? (
              <>
                <Field label="Starting">
                  <Input type="datetime-local" value={localInput(w.at)} onChange={(e) => e.target.value && setWhen({ ...w, at: new Date(e.target.value).getTime() })} />
                </Field>
                <Field label="Repeats">
                  <Select value={w.repeat} options={ROUTINE_REPEATS.map((r) => ({ value: r.id, label: r.label }))} onChange={(v) => setWhen({ ...w, repeat: v as typeof w.repeat })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Kind">
                  <Select value={w.kind} options={kinds.map((k) => ({ value: k.kind, label: k.label }))} onChange={(kind) => setWhen({ ...w, kind, entry: null })} />
                </Field>
                <Field label="Only this one" hint="Optional. A link like @page:Journal; empty means any.">
                  <Input
                    value={entryLink}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder={`@${w.kind}:Name`}
                  />
                </Field>
                <Field label="Is">
                  <Select
                    value={w.action}
                    options={[
                      { value: 'any', label: 'Made or changed' },
                      { value: 'made', label: 'Made' },
                      { value: 'changed', label: 'Changed' }
                    ]}
                    onChange={(v) => setWhen({ ...w, action: v as typeof w.action })}
                  />
                </Field>
                <Field label="By" hint="Waits 2 minutes for changes to settle, and 5 minutes between runs.">
                  <Toggle checked={w.byUser} onChange={(byUser) => setWhen({ ...w, byUser })} label={w.byUser ? 'Only you' : 'You or any agent'} />
                </Field>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-line/40 pt-3">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent-soft">Where the result goes</div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            <Field label="Chat">
              <Select
                value={draft.output.chat}
                options={[
                  { value: 'new', label: 'A new chat each run' },
                  { value: 'same', label: 'One ongoing chat' }
                ]}
                onChange={(v) => set({ output: { ...draft.output, chat: v as 'new' | 'same' } })}
              />
            </Field>
            <Field label="Also add to a page" hint="Optional. Each reply goes under the date and time.">
              <Input value={draft.output.page ?? ''} onChange={(e) => set({ output: { ...draft.output, page: e.target.value || null } })} placeholder="Page name" />
            </Field>
            <Field label="Notification">
              <Toggle checked={draft.output.notify} onChange={(notify) => set({ output: { ...draft.output, notify } })} label={draft.output.notify ? 'When it finishes' : 'None'} />
            </Field>
          </div>
        </div>
      </div>
    </Panel>
  )
}

export function RoutineScreen({ id, select }: KindScreenProps) {
  const routines = useRoutines()
  const agents = useAgents((s) => s.list)
  if (id === NEW_ROUTINE) return <Editor key="new" start={blank(agents[0]?.id ?? '')} select={select} />
  if (id) {
    if (routines === null) return <div className="font-mono text-[11px] text-dim">Loading…</div>
    const r = routines.find((x) => x.id === id)
    if (r) return <Editor key={r.id} start={draftOf(r)} select={select} />
  }
  return (
    <Panel
      className="flex-1"
      title="Routines"
      bodyClassName="flex flex-col gap-1 p-3"
      actions={
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => select({ kind: 'routine', id: NEW_ROUTINE })}>
          New routine
        </Button>
      }
    >
      {!routines?.length ? (
        <EmptyState title="No routines yet">A routine is work an agent does on its own: on a schedule, or when something happens.</EmptyState>
      ) : (
        routines.map((r) => (
          <button key={r.id} onClick={() => select({ kind: 'routine', id: r.id })} onContextMenu={(e) => entryMenuAt(e, 'routine', r.id, r.name)} className="flex flex-col border-l-2 border-l-transparent px-2.5 py-1.5 text-left hover:bg-white/[0.03]">
            <span className={cn('text-[13px]', r.enabled ? 'text-white/90' : 'text-dim')}>{r.name}</span>
            <span className={cn('text-[11px]', r.lastError ? 'text-alert/80' : 'text-dim')}>{routineStatus(r)}</span>
          </button>
        ))
      )}
    </Panel>
  )
}
