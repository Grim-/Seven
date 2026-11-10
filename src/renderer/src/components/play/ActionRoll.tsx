import { useEffect, useState } from 'react'
import { Dices, X } from 'lucide-react'
import { NEEDS_LABEL, actionResultText, type ActionResult } from '@shared/actions'
import { ActionBar, type MenuItem } from '../ui'
import { SheetPortrait } from '../data/SheetPortrait'
import { cn } from '../../lib/cn'
import { showName } from '@shared/ids'
import { ActionOutcome } from './ActionResultCard'
import { Die } from './Die'
import { RollVerdict } from './roll/RollVerdict'
import { closePlay, type PlayWhere } from './playStore'
import { playOutItem } from './playOut'
import { dispatchOutcome } from '../../game/triggerActions/runner'
import { createGameExecutionContext } from '../../game/triggerActions/buildContext'

const STEP_MS = 700

export function ActionRoll({ result, where, onAgain }: { result: ActionResult; where: PlayWhere; onAgain: () => void }) {
  const [landed, setLanded] = useState(0)
  const [executed, setExecuted] = useState(false)

  useEffect(() => {
    setLanded(0)
    setExecuted(false)
    const timers = result.rolls.map((_, i) => window.setTimeout(() => setLanded(i + 1), STEP_MS * (i + 1)))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [result])

  const done = landed >= result.rolls.length

  useEffect(() => {
    if (done && !executed && result.triggerAction && where.world) {
      setExecuted(true)
      const ctx = createGameExecutionContext({
        world: where.world,
        map: where.map ?? '',
        sheet: result.character?.sheet ?? where.sheet ?? ''
      })
      void dispatchOutcome({ triggerActionId: result.triggerAction }, ctx)
    }
  }, [done, executed, result.triggerAction, where.world, where.map, where.sheet, result.character])
  const actions: MenuItem[] = [...(where.onText ? [] : [playOutItem(actionResultText(result), where)]), ...(where.lead ? [] : [{ label: 'Roll again', icon: <Dices />, onSelect: onAgain }]), { label: 'Close', icon: <X />, onSelect: closePlay }]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <SheetPortrait image={result.character?.image ?? null} className="h-16 w-16" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-semibold leading-snug text-white">{result.attempt}</span>
          <span className="font-mono text-[11px] text-dim">
            {result.character ? showName(result.character.name) : 'No character'} · {NEEDS_LABEL[result.needs]}
          </span>
        </div>
      </div>
      {result.rolls.map((r, i) => {
        const shown = i < landed
        return (
          <div key={i} className={cn('grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border px-2.5 py-2', !shown ? 'border-line/40' : r.passed ? 'border-ok/50 bg-ok/[0.06]' : 'border-alert/40 bg-alert/[0.05]')}>
            <Die value={r.roll} rolling={!shown} />
            <span className="font-mono text-[12px] text-dim">
              <b className="text-white">{r.label}</b> {r.bonus < 0 ? '−' : '+'}
              {Math.abs(r.bonus)} · {shown ? <>{r.roll} {r.bonus < 0 ? '−' : '+'} {Math.abs(r.bonus)} = <b className="text-white">{r.total}</b> against {r.target}</> : <>needs {r.target}</>}
            </span>
            <span className={cn('w-10 text-right font-mono text-[10px] font-bold uppercase tracking-[0.16em]', r.passed ? 'text-ok' : 'text-alert')}>{shown ? (r.passed ? 'Pass' : 'Fail') : ''}</span>
          </div>
        )
      })}
      {done && (
        <>
          <RollVerdict passed={result.passed} />
          <ActionOutcome result={result} />
          <ActionBar items={actions} className="grid-cols-3" />
        </>
      )}
    </div>
  )
}
