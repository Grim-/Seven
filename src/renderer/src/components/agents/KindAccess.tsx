import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { DEFAULT_LIBRARY_ACCESS, type AgentProfile, type KindInfo } from '@shared/types'
import { EmptyState } from '../ui'
import { AgentAvatar } from './look'
import { KindIcon } from '../../lib/library'
import { noteKindFamilies } from '../../registries/kinds'
import { engine, on } from '../../lib/ipc'
import { useAgents } from '../../store/agents'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'

function useKindInfo(): KindInfo[] | null {
  const [list, setList] = useState<KindInfo[] | null>(null)
  useEffect(() => {
    const load = () =>
      void engine('library.kindInfo')
        .then((l) => {
          noteKindFamilies(l)
          setList(l)
        })
        .catch(() => setList([]))
    load()
    const offs = [on('tools.changed', load), on('agents.changed', load)]
    return () => offs.forEach((off) => off())
  }, [])
  return list
}

function setVisible(agent: AgentProfile, kinds: string[], visible: boolean): void {
  const access = { ...DEFAULT_LIBRARY_ACCESS, ...agent.library }
  const hidden = visible ? access.hidden.filter((k) => !kinds.includes(k)) : [...new Set([...access.hidden, ...kinds])]
  void useAgents
    .getState()
    .save({ ...agent, library: { ...access, hidden } })
    .catch(failed('Could not change access'))
}

function Cell({ on, onClick, title }: { on: boolean; onClick: () => void; title: string }) {
  return (
    <button title={title} onClick={onClick} className={cn('mx-auto flex h-6 w-6 items-center justify-center border', on ? 'border-accent/70 bg-accent/15 text-accent' : 'border-line/50 text-transparent hover:border-accent/50')}>
      <Check className="h-3.5 w-3.5" />
    </button>
  )
}

export function KindAccess() {
  const kinds = useKindInfo()
  const agents = useAgents((s) => s.list)
  if (!kinds) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  const shared = kinds.filter((k) => k.agents)
  const own = kinds.filter((k) => !k.agents)
  const sees = (a: AgentProfile, kind: string) => !(a.library?.hidden ?? []).includes(kind)
  if (!agents.length) return <EmptyState title="No agents yet" />
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto border border-line/60 bg-black/70 p-4">
      <div className="text-[12.5px] text-dim">Which kinds of entry each agent can find, read and link. Click a cell to change one, a kind's name for every agent, or an agent for every kind.</div>
      <table className="border-collapse">
        <thead>
          <tr>
            <th />
            {agents.map((a) => {
              const all = shared.every((k) => sees(a, k.kind))
              return (
                <th key={a.id} className="px-2 pb-2 align-bottom">
                  <button title={all ? `Hide every kind from ${a.name}` : `Let ${a.name} see every kind`} onClick={() => setVisible(a, shared.map((k) => k.kind), !all)} className="flex flex-col items-center gap-1 text-[11.5px] text-white/85 hover:text-accent">
                    <AgentAvatar agent={a} size={26} />
                    <span className="max-w-24 truncate">{a.name}</span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {shared.map((k) => {
            const all = agents.every((a) => sees(a, k.kind))
            return (
              <tr key={k.kind} className="border-t border-line/20">
                <td className="py-1.5 pr-4">
                  <button title={all ? `Hide ${k.plural.toLowerCase()} from every agent` : `Let every agent see ${k.plural.toLowerCase()}`} onClick={() => agents.forEach((a) => setVisible(a, [k.kind], !all))} className="flex items-center gap-2 text-left text-[13px] text-white/90 hover:text-accent">
                    <KindIcon name={k.icon} className="h-3.5 w-3.5 shrink-0 text-teal/80" />
                    {k.plural}
                    {k.source && <span className="border border-line/60 px-1 font-mono text-[9px] uppercase text-faint">add-on</span>}
                  </button>
                </td>
                {agents.map((a) => (
                  <td key={a.id} className="px-2 py-1.5">
                    <Cell on={sees(a, k.kind)} title={`${a.name} ${sees(a, k.kind) ? 'sees' : "doesn't see"} ${k.plural.toLowerCase()}`} onClick={() => setVisible(a, [k.kind], !sees(a, k.kind))} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {own.length > 0 && <div className="text-[12px] text-faint">Only you see {own.map((k) => k.plural.toLowerCase()).join(', ')}; you can still hand an agent one with @.</div>}
    </div>
  )
}
