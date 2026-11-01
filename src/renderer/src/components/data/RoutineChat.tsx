import { ROUTINE_REPEATS, type Routine } from '@shared/routines'
import { EmptyState, SegmentBar } from '../ui'
import { useAgents } from '../../store/agents'
import { AgentAvatar } from '../agents/look'
import { useNow } from '../../lib/useNow'
import { formatRelative } from '../../lib/format'
import { EntryCard, Facts, Loading, BigStat } from '../entries/EntryCard'
import { routineStatus, useRoutines } from './RoutineScreen'
import type { EntrySurfaceProps } from '../../registries/kinds'

function whenText(r: Routine): string {
  const w = r.when
  return 'repeat' in w ? (ROUTINE_REPEATS.find((x) => x.id === w.repeat)?.label ?? '') : `when ${w.kind} ${w.action === 'any' ? 'changes' : w.action}`
}

function useRoutine(id: string) {
  const list = useRoutines()
  return { list, routine: list?.find((r) => r.id === id) }
}

function left(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export function RoutineChat({ id }: EntrySurfaceProps) {
  const { list, routine } = useRoutine(id)
  const agent = useAgents((s) => s.list.find((a) => a.id === routine?.agentId))
  if (!list) return <Loading />
  if (!routine) return <EmptyState title="Removed">This routine no longer exists.</EmptyState>
  return (
    <EntryCard title={routine.name} tag="routine" aside={<span className={routine.enabled ? 'font-mono text-[11px] text-ok' : 'font-mono text-[11px] text-faint'}>{routine.enabled ? 'ON' : 'OFF'}</span>}>
      <div className="flex items-center gap-2.5">
        <AgentAvatar agent={agent} size={30} />
        <span className="text-[12.5px] text-dim">{routine.instruction}</span>
      </div>
      <Facts
        rows={[
          ['When', whenText(routine)],
          ['Status', <span className={routine.lastError ? 'text-alert' : undefined}>{routineStatus(routine)}</span>],
          ['Output', routine.output.page ? `page ${routine.output.page}` : routine.output.chat === 'new' ? 'a new chat' : 'the same chat']
        ]}
      />
    </EntryCard>
  )
}

export function RoutineWidget({ id }: EntrySurfaceProps) {
  const { routine } = useRoutine(id)
  const now = useNow(60_000)
  if (!routine) return <Loading />
  const next = routine.next
  return (
    <div className="flex flex-col gap-2">
      <BigStat value={routine.running ? 'running' : next ? left(next - now) : '—'} label="next run" />
      <span className="text-[12px] text-dim">{routine.lastRun ? `last ${formatRelative(routine.lastRun)}${routine.lastError ? ', failed' : ''}` : 'not run yet'}</span>
      {next && routine.lastRun && <SegmentBar value={(now - routine.lastRun) / Math.max(1, next - routine.lastRun)} thin />}
    </div>
  )
}
