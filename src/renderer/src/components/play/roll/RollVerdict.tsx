import { cn } from '../../../lib/cn'

export function RollVerdict({ passed, pass = 'Success', fail = 'Failure' }: { passed: boolean; pass?: string; fail?: string }) {
  return <div className={cn('play-verdict text-center font-mono text-[18px] font-bold uppercase tracking-[0.3em]', passed ? 'text-ok' : 'text-alert')}>{passed ? pass : fail}</div>
}
