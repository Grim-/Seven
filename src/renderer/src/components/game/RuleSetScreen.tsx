import { useEffect, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { RULE_SET_KIND, defTypes, type RuleSet } from '@shared/game/defs'
import { Button, EmptyState, Field, Input, MakeOrSaved, SaveState, Select, Textarea, askText, confirmDelete, useAutosavedState } from '../ui'
import { engine, on } from '../../lib/ipc'
import { useBusy } from '../../lib/useBusy'
import { failed } from '../../lib/notify'
import type { EntrySurfaceProps, KindScreenProps } from '../../registries/kinds'
import { EntryCard, Facts, Loading } from '../entries/EntryCard'
import { useRuleSets } from './ruleSet'
import { NEW_DEF } from './GameDefScreen'

export function useRuleSetCounts(ruleSet: string): [string, string][] | null {
  const [rows, setRows] = useState<[string, string][] | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      void Promise.all(defTypes().map(async (t) => [t.plural, String((await engine('game.list', { ruleSet, type: t.type })).length)] as [string, string]))
        .then((r) => live && setRows(r))
        .catch(() => undefined)
    load()
    const off = on('game.changed', load)
    return () => {
      live = false
      off()
    }
  }, [ruleSet])
  return rows
}

function NewRuleSet({ select }: KindScreenProps) {
  const sets = useRuleSets() ?? []
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [copy, setCopy] = useState('')
  const [busy, run] = useBusy()
  const make = () =>
    void run(async () => {
      const made = await engine('game.saveRuleSet', { id: null, name, notes, copy: copy || null })
      select({ kind: RULE_SET_KIND, id: made.id })
    }, 'Could not make the rule set')
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-semibold text-white">New rule set</h2>
          <span className="flex-1" />
          <MakeOrSaved made={false} saver={{ status: 'idle', error: null }} what="rule set" disabled={!name.trim() || busy} onMake={make} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Space western" />
          </Field>
          <Field label="Start from" hint="Empty starts with nothing; a rule set copies all of its entries.">
            <Select value={copy} options={[{ value: '', label: 'Empty' }, ...sets.map((s) => ({ value: s.id, label: `A copy of ${s.name}` }))]} onChange={setCopy} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What kind of game these rules are for" />
        </Field>
      </div>
    </div>
  )
}

function EditRuleSet({ start, select }: { start: RuleSet; select: KindScreenProps['select'] }) {
  const state = useAutosavedState<RuleSet>(start, (s) => engine('game.saveRuleSet', { id: s.id, name: s.name, notes: s.notes, copy: null }), { when: (s) => Boolean(s.name.trim()) })
  const set = state.value
  const counts = useRuleSetCounts(set.id)
  const copy = () =>
    askText('Copy rule set', 'Name', `${set.name} copy`, (name) =>
      void engine('game.saveRuleSet', { id: null, name, notes: set.notes, copy: set.id })
        .then((made) => select({ kind: RULE_SET_KIND, id: made.id }))
        .catch(failed('Could not copy the rule set'))
    )
  const remove = () => confirmDelete(`Delete ${set.name}?`, 'Every definition and template in it goes too. Worlds that play by it must pick another first.', () => engine('game.removeRuleSet', { id: set.id }), () => select({ kind: RULE_SET_KIND, id: 'all' }))
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[18px] font-semibold text-white">{set.name || start.name}</h2>
          <span className="border border-line/50 px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">Rule set</span>
          <span className="flex-1" />
          <SaveState status={state.status} error={state.error} />
          <Button size="sm" variant="ghost" icon={<Copy />} onClick={copy}>
            Copy
          </Button>
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
            Delete
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <Field label="Name">
            <Input value={set.name} onChange={(e) => state.set({ ...set, name: e.target.value })} />
          </Field>
          <Field label="Id" hint="Worlds and links use this. It stays the same when you rename.">
            <Input value={set.id} readOnly className="font-mono text-[12.5px] text-dim" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={set.notes} onChange={(e) => state.set({ ...set, notes: e.target.value })} placeholder="What kind of game these rules are for" />
        </Field>
        <Field label="In this rule set" hint="Open each list from the Game group in the library; new entries ask which rule set they go in." group>
          {counts ? <Facts rows={counts} /> : <Loading />}
        </Field>
      </div>
    </div>
  )
}

export function RuleSetScreen(props: KindScreenProps) {
  const sets = useRuleSets()
  if (props.id === NEW_DEF) return <NewRuleSet {...props} />
  if (!props.id) return null
  if (!sets) return <EmptyState title="Loading">One moment.</EmptyState>
  const set = sets.find((s) => s.id === props.id)
  if (!set) return <EmptyState title="No such rule set">It may have been deleted.</EmptyState>
  return <EditRuleSet key={set.id} start={set} select={props.select} />
}

function RuleSetCard({ id, short }: { id: string; short: boolean }) {
  const sets = useRuleSets()
  const counts = useRuleSetCounts(id)
  const set = sets?.find((s) => s.id === id)
  if (!set || !counts) return <Loading />
  return (
    <EntryCard title={set.name} tag="Rule set" aside={<span className="font-mono text-[11px] text-faint">{set.id}</span>}>
      <Facts rows={short ? counts.slice(0, 4) : counts} />
      {set.notes && !short && <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed text-white/80">{set.notes}</p>}
    </EntryCard>
  )
}

export function RuleSetChat({ id }: EntrySurfaceProps) {
  return <RuleSetCard id={id} short={false} />
}

export function RuleSetWidget({ id }: EntrySurfaceProps) {
  return <RuleSetCard id={id} short />
}
