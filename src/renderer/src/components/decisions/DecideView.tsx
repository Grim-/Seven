import { useState } from 'react'
import { Check, Dices, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PickAnswer, PickDecisionProps } from '@shared/pickDecision'
import { NO_ROLL, checkOf, optionRollLabel, rollCheck, type OptionRoll } from '@shared/storyRolls'
import { Button, Input } from '../ui'
import { useCheckTargets } from '../play/useCheckTargets'
import { RollRow } from '../play/RollRow'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { DecisionCardFrame } from './DecisionCardFrame'
import { OptionRow } from './OptionRow'
import { OptionRollFields } from './OptionRollFields'

const OWN = -1

export function DecideView({ p, done, open, status, onAnswer }: { p: PickDecisionProps; done: PickAnswer | null; open: boolean; status?: ReactNode; onAnswer: (value: PickAnswer) => Promise<void> }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [own, setOwn] = useState('')
  const [sheet, setSheet] = useState(p.character)
  const [roll, setRoll] = useState<OptionRoll>(NO_ROLL)
  const [sending, setSending] = useState(false)
  const targets = useCheckTargets(sheet)

  const pick = (index: number) => {
    setPicked(index)
    setRoll(index === OWN ? NO_ROLL : p.options[index].roll)
  }

  const send = async (force: boolean | null) => {
    if (picked === null || sending) return
    setSending(true)
    const option = picked === OWN ? own.trim() : p.options[picked].text
    const value: PickAnswer = { option, own: picked === OWN, character: roll.type === 'check' ? sheet : null, roll, check: rollCheck(roll, targets, force) }
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
        <OptionRow mark={<Check className="h-3.5 w-3.5" />} text={done.option} picked aside={<span className="font-mono text-[11px] text-dim">{optionRollLabel(done.roll)}</span>} />
        {done.check && (done.check.forced ? <span className="font-mono text-[12px] text-dim">You made it {done.check.passed ? 'pass' : 'fail'}.</span> : <RollRow roll={done.check} />)}
      </DecisionCardFrame>
    )

  return (
    <DecisionCardFrame tag="Decision" note="you pick" question={p.question} status={status}>
      {p.options.map((o, i) => (
        <OptionRow
          key={i}
          mark={i + 1}
          text={o.text}
          picked={picked === i}
          onClick={open ? () => pick(i) : undefined}
          aside={
            <span className="flex items-baseline gap-3 font-mono text-[11px]">
              <span className="text-dim">{optionRollLabel(o.roll)}</span>
              <span className="w-10 text-right font-bold text-white">{chance(o.roll)}</span>
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
        <div className="flex flex-col gap-2 border-t border-line/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <OptionRollFields roll={roll} targets={targets} onChange={setRoll} />
            {roll.type === 'check' && <SheetSelect value={sheet} onChange={setSheet} className="w-44" />}
            <span className="flex-1" />
            {roll.type !== 'none' && <span className="font-mono text-[18px] font-bold text-accent">{chance(roll)}</span>}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {roll.type === 'none' ? (
              <Button size="sm" variant="primary" icon={<Check />} disabled={sending} onClick={() => void send(null)}>
                Choose
              </Button>
            ) : (
              <>
                <Button size="sm" variant="primary" icon={<Dices />} disabled={sending} onClick={() => void send(null)}>
                  Roll
                </Button>
                <Button size="sm" icon={<ThumbsUp />} disabled={sending} onClick={() => void send(true)}>
                  Pass
                </Button>
                <Button size="sm" icon={<ThumbsDown />} disabled={sending} onClick={() => void send(false)}>
                  Fail
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </DecisionCardFrame>
  )
}
