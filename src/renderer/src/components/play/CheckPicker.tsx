import { CHANCE, chanceOf, findTarget, targetOf, type Action } from '@shared/actions'
import { signed } from '@shared/dnd'
import { useActionSheet, useCheckTargets } from './useCheckTargets'

export function CheckPicker({ action, character, onPick }: { action: Action; character: string | null; onPick: (index: number) => void }) {
  const targets = useCheckTargets(useActionSheet(action, character))
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[15px] font-semibold leading-snug text-white">{action.attempt}</div>
      <span className="text-[12px] text-dim">Pick how to try it. Only that check is rolled.</span>
      {action.checks.map((c, i) => {
        const found = findTarget(targets, c.against)
        const bonus = found?.bonus ?? 0
        return (
          <button key={i} type="button" onClick={() => onPick(i)} className="flex flex-col gap-0.5 border border-accent/40 bg-accent/[0.04] px-3 py-2 text-left hover:bg-accent/[0.1]">
            <span className="flex items-baseline gap-2">
              <b className="text-[13px] text-white">{found?.label ?? (c.against && c.against !== CHANCE ? c.against : 'Chance')}</b>
              <span className="font-mono text-[11px] text-dim">{signed(bonus)}</span>
              <span className="ml-auto font-mono text-[11px] text-cyan">{Math.round(chanceOf(bonus, targetOf(c)) * 100)}%</span>
            </span>
            {(c.pass || c.fail) && <span className="text-[11.5px] text-faint">{[c.pass && `pass: ${c.pass}`, c.fail && `fail: ${c.fail}`].filter(Boolean).join(' · ')}</span>}
          </button>
        )
      })}
    </div>
  )
}
