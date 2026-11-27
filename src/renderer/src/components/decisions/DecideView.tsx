import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PickAnswer, PickDecisionProps } from '@shared/pickDecision'
import { NO_ROLL, checkOf, optionRollLabel, rollCheck, type OptionRoll } from '@shared/storyRolls'
import { ActionBar, Button, Input } from '../ui'
import { useCheckTargets } from '../play/useCheckTargets'
import { RollRow } from '../play/RollRow'
import { WhoRolls } from '../play/roll/WhoRolls'
import { useRollers } from '../play/roll/useRollers'
import { ROLL_TOOLTIP_NO_CHAR, rollItems } from '../play/roll/rollItems'
import { DecisionCardFrame } from './DecisionCardFrame'
import { OptionRow } from './OptionRow'
import { OptionRollFields } from './OptionRollFields'

const OWN = -1

export function DecideView({
  p,
  done,
  open,
  status,
  onAnswer,
  onClose
}: {
  p: PickDecisionProps
  done: PickAnswer | null
  open: boolean
  status?: ReactNode
  onAnswer: (value: PickAnswer) => Promise<void>
  onClose?: () => void
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const [own, setOwn] = useState('')
  const [sheet, setSheet] = useState<string | null>(p.roller === 'player' ? null : p.character)
  const [roll, setRoll] = useState<OptionRoll>(NO_ROLL)
  const [sending, setSending] = useState(false)

  const targets = useCheckTargets(sheet)
  const against = roll.type === 'check' ? roll.against : null
  const { rollers, eligible } = useRollers(against, { preferred: p.character })

  // Auto-select preferred character if available and eligible when not set
  useEffect(() => {
    if (roll.type === 'check' && !sheet) {
      if (p.character && eligible.some((r) => r.sheet === p.character)) {
        setSheet(p.character)
      } else if (p.roller !== 'player' && eligible[0]) {
        setSheet(eligible[0].sheet)
      }
    }
  }, [roll.type, sheet, p.character, p.roller, eligible])

  const pick = (index: number) => {
    setPicked(index)
    const nextRoll = index === OWN ? NO_ROLL : p.options[index].roll
    setRoll(nextRoll)
  }

  const checkDetail = roll.type === 'check' ? checkOf(roll, targets) : null
  const ready = roll.type !== 'check' || (sheet !== null && checkDetail !== null)
  const overridden = Boolean(roll.type === 'check' && p.character && sheet && sheet !== p.character)

  const send = async (force: boolean | null) => {
    if (picked === null || sending) return
    setSending(true)
    const option = picked === OWN ? own.trim() : p.options[picked].text
    const value: PickAnswer = {
      option,
      own: picked === OWN,
      character: roll.type === 'check' ? sheet : null,
      overridden,
      roll,
      check: rollCheck(roll, targets, force)
    }
    await onAnswer(value)
    setSending(false)
  }

  const chance = (r: OptionRoll) => {
    const c = checkOf(r, targets)
    return c ? `${Math.round(c.chance * 100)}%` : ''
  }

  if (done)
    return (
      <DecisionCardFrame tag="Decision" note="you picked" question={p.question} status={status}>
        <OptionRow mark={<Check className="h-3.5 w-3.5" />} text={done.option} picked aside={<span className="font-ui text-[11px] text-dim">{optionRollLabel(done.roll)}</span>} />
        {done.overridden && <span className="font-ui text-[11px] text-accent">You chose the rolling character</span>}
        {done.check && (done.check.forced ? <span className="font-ui text-[12px] text-dim">You made it {done.check.passed ? 'pass' : 'fail'}.</span> : <RollRow roll={done.check} />)}
      </DecisionCardFrame>
    )

  return (
    <DecisionCardFrame tag="Decision" note="you pick" question={p.question} status={status} onClose={open ? onClose : undefined}>
      {p.options.map((o, i) => (
        <OptionRow
          key={i}
          mark={i + 1}
          text={o.text}
          picked={picked === i}
          onClick={open ? () => pick(i) : undefined}
          aside={
            <span className="flex items-baseline gap-3 font-ui text-[11px]">
              <span className="text-dim">{optionRollLabel(o.roll)}</span>
              <span className="w-10 text-right font-bold text-ink">{chance(o.roll)}</span>
            </span>
          }
        />
      ))}
      {p.own && open && (
        <div className="flex gap-1.5">
          <Input value={own} placeholder="Something else…" onChange={(e) => setOwn(e.target.value)} onFocus={() => own.trim() && pick(OWN)} className="flex-1" />
          <Button size="sm" disabled={!own.trim()} onClick={() => pick(OWN)}>
            Use this
          </Button>
        </div>
      )}
      {open && picked !== null && (
        <div className="flex flex-col gap-3 border-t border-line/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <OptionRollFields roll={roll} targets={targets} onChange={setRoll} />
            <span className="flex-1" />
            {roll.type !== 'none' && <span className="font-ui text-[18px] font-bold text-accent">{chance(roll)}</span>}
          </div>
          {roll.type === 'check' && (
            <WhoRolls
              label="Who makes this check"
              people={rollers}
              value={sheet}
              onPick={(s) => setSheet(s)}
              empty="No characters available."
            />
          )}
          {roll.type === 'none' ? (
            <div className="flex justify-end gap-1.5">
              <ActionBar
                items={[
                  { label: 'Choose', disabled: sending, onSelect: () => void send(null) },
                  ...(onClose ? [{ label: 'Close', disabled: sending, onSelect: onClose }] : [])
                ]}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <ActionBar
                items={rollItems({
                  ready,
                  sending,
                  onRoll: () => void send(null),
                  onPass: () => void send(true),
                  onFail: () => void send(false),
                  onClose
                })}
                className="grid-cols-4"
              />
              {!ready && <span className="text-[12px] text-dim">{ROLL_TOOLTIP_NO_CHAR}</span>}
            </div>
          )}
        </div>
      )}
    </DecisionCardFrame>
  )
}
