import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { defId, defRef, defType, splitDefRef, type DefType, type GameDef } from '@shared/game/defs'
import { resolveParams } from '@shared/game/core/params'
import { Button, EmptyState, Field, MakeOrSaved, SaveState, Select, confirmDelete, useAutosavedState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useBusy } from '../../lib/useBusy'
import type { KindScreenProps } from '../../registries/kinds'
import { GameDefEditor } from './GameDefEditor'
import { RuleSetProvider, useResolvedRuleSet, useRuleSets } from './ruleSet'

export const NEW_DEF = '__new'

function Header({ type, title, ruleSet, children }: { type: DefType; title: string; ruleSet: string; children: ReactNode }) {
  const sets = useRuleSets() ?? []
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-[18px] font-semibold text-white">{title}</h2>
      <span className="border border-line/50 px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">{type.label}</span>
      <span className="border border-purple/50 px-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-purple">{sets.find((s) => s.id === ruleSet)?.name ?? ruleSet}</span>
      <span className="flex-1" />
      {children}
    </div>
  )
}

function NewDef({ type, start, select }: { type: DefType; start: string; select: KindScreenProps['select'] }) {
  const sets = useRuleSets() ?? []
  const [ruleSet, setRuleSet] = useState(start)
  const [def, setDef] = useState<GameDef>(() => ({ id: '', name: '', notes: '', values: resolveParams(type.params, {}) }))
  const [busy, run] = useBusy()
  const shown = { ...def, id: defId(def.name) }
  const label = type.label.toLowerCase()
  const make = () =>
    void run(async () => {
      const saved = await engine('game.save', { ruleSet, type: type.type, def: shown, previousId: null })
      select({ kind: type.type, id: defRef(ruleSet, saved.id) })
    }, `Could not make the ${label}`)
  return (
    <RuleSetProvider ruleSet={ruleSet}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
          <Header type={type} title={`New ${label}`} ruleSet={ruleSet}>
            <MakeOrSaved made={false} saver={{ status: 'idle', error: null }} what={label} disabled={!shown.id || busy} onMake={make} />
          </Header>
          <Field label="Rule set" hint={`The rule set this ${label} belongs to. Its other fields pick from this rule set.`} className="max-w-xs">
            <Select value={ruleSet} options={sets.map((s) => ({ value: s.id, label: s.name }))} onChange={setRuleSet} />
          </Field>
          <GameDefEditor type={type} def={shown} made={false} onChange={setDef} />
        </div>
      </div>
    </RuleSetProvider>
  )
}

function EditDef({ type, ruleSet, start, select }: { type: DefType; ruleSet: string; start: GameDef; select: KindScreenProps['select'] }) {
  const state = useAutosavedState<GameDef>(start, (def) => engine('game.save', { ruleSet, type: type.type, def, previousId: def.id }), { when: (d) => Boolean(d.name.trim()) })
  const def = state.value
  const remove = () => confirmDelete(`Delete ${def.name}?`, `Anything in this rule set that uses the id ${def.id} stops finding it.`, () => engine('game.remove', { ruleSet, type: type.type, id: def.id }), () => select({ kind: type.type, id: 'all' }))
  return (
    <RuleSetProvider ruleSet={ruleSet}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
          <Header type={type} title={def.name || start.name} ruleSet={ruleSet}>
            <SaveState status={state.status} error={state.error} />
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => select({ kind: type.type, id: defRef(ruleSet, NEW_DEF) })} title={`New ${type.label.toLowerCase()}`} />
          </Header>
          <GameDefEditor type={type} def={def} made onChange={state.set} />
        </div>
      </div>
    </RuleSetProvider>
  )
}

function LoadedDef({ type, ruleSet, id, select }: { type: DefType; ruleSet: string; id: string; select: KindScreenProps['select'] }) {
  const got = useLive(() => engine('game.get', { ruleSet, type: type.type, id }), 'game.changed')
  if (!got || got.id !== id) return <EmptyState title="Loading">One moment.</EmptyState>
  return <EditDef key={got.id} type={type} ruleSet={ruleSet} start={got} select={select} />
}

export function GameDefScreen({ kind, id, select }: KindScreenProps) {
  const type = defType(kind)
  const parts = splitDefRef(id ?? '')
  const ruleSet = useResolvedRuleSet(parts.ruleSet)
  if (!type || !id) return null
  if (!ruleSet) return <EmptyState title="Loading">One moment.</EmptyState>
  if (parts.id === NEW_DEF) return <NewDef key={ruleSet} type={type} start={ruleSet} select={select} />
  return <LoadedDef key={`${ruleSet}/${parts.id}`} type={type} ruleSet={ruleSet} id={parts.id} select={select} />
}
