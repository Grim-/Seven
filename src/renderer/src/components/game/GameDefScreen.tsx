import { useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { defId, defType, splitDefRef, type DefType, type GameDef } from '@shared/game/defs'
import { resolveParams } from '@shared/game/core/params'
import { Button, EmptyState, MakeOrSaved, SaveState, confirmDelete, useAutosavedState } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useBusy } from '../../lib/useBusy'
import type { KindScreenProps } from '../../registries/kinds'
import { GameDefEditor } from './GameDefEditor'

export const NEW_DEF = '__new'

function Header({ type, title, children }: { type: DefType; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
      <span className="border border-line/50 px-1.5 font-label text-[10px] caps-12 text-dim">{type.label}</span>
      <span className="flex-1" />
      {children}
    </div>
  )
}

function NewDef({ type, select }: { type: DefType; select: KindScreenProps['select'] }) {
  const [def, setDef] = useState<GameDef>(() => ({ id: '', name: '', notes: '', values: resolveParams(type.params, {}) }))
  const [busy, run] = useBusy()
  const shown = { ...def, id: defId(def.name) }
  const label = type.label.toLowerCase()
  const make = () =>
    void run(async () => {
      const saved = await engine('game.save', { type: type.type, def: shown, previousId: null })
      select({ kind: type.kind ?? type.type, id: saved.id })
    }, `Could not make the ${label}`)
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <Header type={type} title={`New ${label}`}>
          <MakeOrSaved made={false} saver={{ status: 'idle', error: null }} what={label} disabled={!shown.id || busy} onMake={make} />
        </Header>
        <GameDefEditor type={type} def={shown} made={false} onChange={setDef} />
      </div>
    </div>
  )
}

function EditDef({ type, start, select }: { type: DefType; start: GameDef; select: KindScreenProps['select'] }) {
  const state = useAutosavedState<GameDef>(start, (def) => engine('game.save', { type: type.type, def, previousId: def.id }), { when: (d) => Boolean(d.name.trim()) })
  const def = state.value
  const remove = () => confirmDelete(`Delete ${def.name}?`, `Anything that uses the id ${def.id} stops finding it.`, () => engine('game.remove', { type: type.type, id: def.id }), () => select({ kind: type.kind ?? type.type, id: 'all' }))
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <Header type={type} title={def.name || start.name}>
          <SaveState status={state.status} error={state.error} />
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => select({ kind: type.kind ?? type.type, id: NEW_DEF })} title={`New ${type.label.toLowerCase()}`} />
        </Header>
        <GameDefEditor type={type} def={def} made onChange={state.set} />
      </div>
    </div>
  )
}

function LoadedDef({ type, id, select }: { type: DefType; id: string; select: KindScreenProps['select'] }) {
  const got = useLive(() => engine('game.get', { type: type.type, id }), 'game.changed')
  if (!got || got.id !== id) return <EmptyState title="Loading">One moment.</EmptyState>
  return <EditDef key={got.id} type={type} start={got} select={select} />
}

export function GameDefScreen({ kind, id, select }: KindScreenProps) {
  const type = defType(kind)
  const parts = splitDefRef(id ?? '')
  if (!type || !id) return null
  if (parts.id === NEW_DEF) return <NewDef type={type} select={select} />
  return <LoadedDef key={parts.id} type={type} id={parts.id} select={select} />
}
