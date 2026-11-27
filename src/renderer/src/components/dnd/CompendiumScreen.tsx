import { useState } from 'react'
import { Copy, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import {
  compendiumInfo,
  entryId,
  type CompendiumEntry,
  type CompendiumKind
} from '@shared/compendium'
import { Button, EmptyState, MakeOrSaved, SaveState, confirmDelete, useAutosavedState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useBusy } from '../../lib/useBusy'
import type { KindScreenProps } from '../../registries/kinds'
import { CompendiumEditor } from './CompendiumEditor'
import { EntryView } from './EntryView'

export const NEW_ENTRY = '__new'

function blank(): CompendiumEntry {
  return { id: '', name: '', source: 'Yours', facts: {}, text: '' }
}

function NewEntry({ kind, select }: { kind: CompendiumKind; select: KindScreenProps['select'] }) {
  const [entry, setEntry] = useState(blank)
  const [busy, run] = useBusy()
  const label = compendiumInfo(kind)?.label.toLowerCase() ?? kind
  const make = () =>
    void run(async () => {
      const saved = await engine('dnd.save', {
        kind,
        entry: { ...entry, id: entryId(entry.name) },
        previousId: null
      })
      select({ kind, id: saved.id })
    }, `Could not make the ${label}`)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <span className="font-label text-[11px] caps-16 text-dim">
          New {label}
        </span>
        <span className="flex-1" />
        <MakeOrSaved
          made={false}
          saver={{ status: 'idle', error: null }}
          what={label}
          disabled={!entry.name.trim() || busy}
          onMake={make}
        />
      </div>
      <CompendiumEditor kind={kind} entry={entry} onChange={setEntry} />
    </div>
  )
}

function EditEntry({
  kind,
  start,
  onDone
}: {
  kind: CompendiumKind
  start: CompendiumEntry
  onDone: () => void
}) {
  const state = useAutosavedState<CompendiumEntry>(
    start,
    (entry) => engine('dnd.save', { kind, entry, previousId: null }),
    { when: (e) => Boolean(e.name.trim()) }
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center gap-3">
        <span className="font-label text-[11px] caps-16 text-dim">
          Editing your {compendiumInfo(kind)?.label.toLowerCase()}
        </span>
        <span className="flex-1" />
        <SaveState status={state.status} error={state.error} />
        <Button size="sm" variant="primary" onClick={() => void state.flush().then(onDone)}>
          Done
        </Button>
      </div>
      <CompendiumEditor kind={kind} entry={state.value} onChange={state.set} />
    </div>
  )
}

export function CompendiumScreen({ kind: raw, id, select }: KindScreenProps) {
  const kind = raw as CompendiumKind
  const [editing, setEditing] = useState(false)
  const got = useLive(
    () => (id && id !== NEW_ENTRY ? engine('dnd.get', { kind, id }) : Promise.resolve(null)),
    'dnd.changed'
  )
  if (id === NEW_ENTRY) return <NewEntry kind={kind} select={select} />
  if (!id) return null
  if (!got || got.entry.id !== id) return <EmptyState title="Loading">One moment.</EmptyState>
  const { entry, srd, own } = got
  if (editing)
    return (
      <EditEntry
        key={entry.id}
        kind={kind}
        start={own ? entry : { ...entry, source: 'Yours' }}
        onDone={() => setEditing(false)}
      />
    )
  const remove = () =>
    confirmDelete(
      srd ? `Go back to the SRD ${entry.name}?` : `Delete ${entry.name}?`,
      srd ? 'Your copy is removed and the SRD version is used again.' : 'It is removed for good.',
      () => engine('dnd.remove', { kind, id: entry.id }),
      srd ? undefined : () => select({ kind, id: 'all' }),
      srd ? 'Go back' : 'Delete'
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[18px] font-semibold text-ink">{entry.name}</h2>
          <span className="border border-line/50 px-1.5 font-label text-[10px] caps-12 text-dim">
            {own ? (srd ? 'Your copy of SRD' : 'Yours') : entry.source}
          </span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            icon={own ? <Pencil /> : <Copy />}
            onClick={() => setEditing(true)}
          >
            {own ? 'Edit' : 'Make my copy'}
          </Button>
          {own && (
            <Button
              size="sm"
              variant="ghost"
              icon={srd ? <RotateCcw /> : <Trash2 />}
              onClick={remove}
            >
              {srd ? 'Use SRD version' : 'Delete'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus />}
            onClick={() => select({ kind, id: NEW_ENTRY })}
            title={`New ${compendiumInfo(kind)?.label.toLowerCase()}`}
          />
        </div>
        <EntryView kind={kind} entry={entry} />
      </div>
    </div>
  )
}
