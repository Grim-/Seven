import { useState } from 'react'
import { AlertOctagon, AlertTriangle, Copy, MessageSquare, Trash2, X } from 'lucide-react'
import type { Problem } from '@shared/problems'
import { ActionBar, openMenu, type MenuItem } from '../ui'
import { LogBox } from '../ui/LogBox'
import { formatRelative } from '../../lib/format'
import { copyText } from '../../lib/notify'
import { openChat } from '../../lib/library'
import { cn } from '../../lib/cn'
import { clearProblems, dismissProblem } from '../../store/problems'

function problemText(p: Problem): string {
  return [`[${p.severity}] ${p.area}${p.request ? ` (${p.request})` : ''}`, p.message, p.count > 1 ? `Seen ${p.count} times, last ${new Date(p.lastAt).toLocaleString()}` : new Date(p.lastAt).toLocaleString(), p.detail ?? ''].filter(Boolean).join('\n')
}

export function problemActions(p: Problem, go: (fn: () => void) => void): MenuItem[] {
  const sessionId = p.sessionId
  return [
    ...(sessionId ? [{ label: 'Open chat', icon: <MessageSquare />, onSelect: () => go(() => openChat(sessionId)) }] : []),
    { label: 'Copy details', icon: <Copy />, onSelect: () => void copyText(problemText(p), 'Copied the problem', p.message) },
    { label: 'Dismiss', icon: <X />, onSelect: () => dismissProblem(p.id) }
  ]
}

export const clearProblemsItem: MenuItem = { label: 'Clear all problems', icon: <Trash2 />, danger: true, onSelect: clearProblems }

function ProblemRow({ problem, open, onToggle, go }: { problem: Problem; open: boolean; onToggle: () => void; go: (fn: () => void) => void }) {
  const error = problem.severity === 'error'
  const actions = problemActions(problem, go)
  return (
    <div className={cn('border-l-2', error ? 'border-l-alert' : 'border-l-accent', open && 'bg-white/[0.03]')}>
      <button onClick={onToggle} onContextMenu={(e) => openMenu(e, problem.area, [...actions, { label: '', separator: true }, clearProblemsItem])} className="flex w-full items-start gap-2.5 px-3 py-1.5 text-left hover:bg-alert/[0.06] touch:py-2.5">
        <span className={cn('mt-0.5 flex h-3.5 w-3.5 shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5', error ? 'text-alert' : 'text-accent')}>{error ? <AlertOctagon /> : <AlertTriangle />}</span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[12.5px] text-white phone:text-[14px]', !open && 'truncate')}>{problem.message}</span>
          <span className="block truncate font-mono text-[10.5px] text-dim phone:text-[12px]">
            {problem.area}
            {problem.request && <span className="text-faint"> · {problem.request}</span>}
            {problem.count > 1 && <span className="text-accent"> · x{problem.count}</span>} · {formatRelative(problem.lastAt)}
          </span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-2.5 pl-9">
          {problem.detail && <LogBox lines={problem.detail.split('\n')} />}
          <ActionBar row items={actions} />
        </div>
      )}
    </div>
  )
}

export function ProblemList({ problems, go }: { problems: Problem[]; go: (fn: () => void) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!problems.length) return <div className="px-3 pb-1 text-[12px] text-faint">Nothing has gone wrong.</div>
  return (
    <>
      {problems.map((p) => (
        <ProblemRow key={p.id} problem={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} go={go} />
      ))}
    </>
  )
}
