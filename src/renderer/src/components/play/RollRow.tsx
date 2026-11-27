import type { CheckRoll } from '@shared/actions'
import { cn } from '../../lib/cn'

export function RollRow({ roll }: { roll: CheckRoll }) {
  return (
    <div className={cn('grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_auto_auto] items-center gap-2.5 border px-2 py-1.5', roll.passed ? 'border-ok/45 bg-ok/[0.05]' : 'border-alert/35 bg-alert/[0.04]')}>
      <span className="truncate font-ui text-[11.5px] text-ink/90">{roll.label}</span>
      <span className="font-ui text-[12px] text-dim">
        <b className="text-accent">{roll.roll}</b> {roll.bonus < 0 ? '−' : '+'} <b className="text-ink">{Math.abs(roll.bonus)}</b> = <b className="text-ink">{roll.total}</b> vs {roll.target}
      </span>
      <span className="font-ui text-[10.5px] text-faint">{Math.round(roll.chance * 100)}%</span>
      <span className={cn('w-10 text-right font-label text-[10px] font-bold caps-16 ', roll.passed ? 'text-ok' : 'text-alert')}>{roll.passed ? 'Pass' : 'Fail'}</span>
    </div>
  )
}
