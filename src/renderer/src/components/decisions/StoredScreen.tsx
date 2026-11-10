import { useState, type ComponentType, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { EventName } from '@shared/protocol'
import { toId, stripRef } from '@shared/ids'
import { Button, EmptyState, MakeOrSaved, SaveState, confirmDelete, useAutosavedState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useBusy } from '../../lib/useBusy'
import type { KindScreenProps } from '../../registries/kinds'

export const NEW_ENTRY = '__new'

interface Props<T extends { id: string; name: string }> extends KindScreenProps {
  what: string
  event: EventName
  get: (id: string) => Promise<T | null>
  save: (value: T, previousId: string | null) => Promise<T>
  blank: () => T
  badge?: (value: T) => string
  actions?: (value: T, flush: () => Promise<void>) => ReactNode
  Editor: ComponentType<{ value: T; onChange: (next: T) => void }>
}

function NewEntry<T extends { id: string; name: string }>({ kind, select, what, save, blank, Editor }: Props<T>) {
  const [value, setValue] = useState(blank)
  const [busy, run] = useBusy()
  const make = () =>
    void run(async () => {
      const saved = await save(value, null)
      select({ kind, id: saved.id })
    }, `Could not make the ${what}`)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">New {what}</span>
        <span className="flex-1" />
        <MakeOrSaved made={false} saver={{ status: 'idle', error: null }} what={what} disabled={!value.name.trim() || busy} onMake={make} />
      </div>
      <Editor value={value} onChange={setValue} />
    </div>
  )
}

function EditEntry<T extends { id: string; name: string }>({ kind, select, what, save, badge, actions, Editor, start }: Props<T> & { start: T }) {
  const state = useAutosavedState<T>(start, (value) => save(value, start.id), { when: (v) => Boolean(v.name.trim()) })
  const v = state.value
  const remove = () => confirmDelete(`Delete ${v.name}?`, 'It is removed for good.', () => engine('library.remove', { entry: `@${kind}:${v.id}` }), () => select({ kind, id: 'all' }))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[18px] font-semibold text-white">{v.name || what}</h2>
        {badge && <span className="border border-line/50 px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">{badge(v)}</span>}
        <span className="flex-1" />
        <SaveState status={state.status} error={state.error} />
        {actions?.(v, state.flush)}
        <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
          Delete
        </Button>
        <Button size="sm" variant="ghost" icon={<Plus />} title={`New ${what}`} onClick={() => select({ kind, id: NEW_ENTRY })} />
      </div>
      <Editor value={v} onChange={state.set} />
    </div>
  )
}

export function StoredScreen<T extends { id: string; name: string }>(props: Props<T>) {
  const { id, event, get, what } = props
  const got = useLive(() => (id && id !== NEW_ENTRY ? get(id) : Promise.resolve(null)), event, [id])
  if (id === NEW_ENTRY) return <NewEntry {...props} />
  if (!id) return null
  if (got === undefined) return <EmptyState title="Loading">One moment.</EmptyState>
  const matches = got && (got.id === id || toId(got.id) === toId(id) || got.id === stripRef(id))
  if (!got || !matches) return <EmptyState title="Not found">This {what} was not found or has been removed.</EmptyState>
  return <EditEntry key={got.id} {...props} start={got} />
}
