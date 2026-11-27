import { useState } from 'react'
import { Dices } from 'lucide-react'
import type { ReactNode } from 'react'
import type { RolledAnswer, RolledDecisionProps } from '@shared/rolledDecision'
import { rollDie } from '@shared/storyRolls'
import { Button } from '../ui'
import { DecisionCardFrame } from './DecisionCardFrame'
import { OptionRow } from './OptionRow'

export function RolledView({ p, done, open, status, onAnswer, onClose }: { p: RolledDecisionProps; done: RolledAnswer | null; open: boolean; status?: ReactNode; onAnswer: (value: RolledAnswer) => Promise<void>; onClose?: () => void }) {
  const [sending, setSending] = useState(false)

  const roll = async () => {
    if (sending) return
    setSending(true)
    const face = rollDie(p.die)
    const value: RolledAnswer = { roll: face, option: p.options[face - 1] }
    await onAnswer(value)
    setSending(false)
  }

  return (
    <DecisionCardFrame tag="Rolled decision" note={`d${p.die} picks`} question={p.question} status={status} onClose={open ? onClose : undefined}>
      {p.options.map((o, i) => (
        <OptionRow key={i} mark={i + 1} text={o} picked={done?.roll === i + 1} />
      ))}
      <div className="flex items-center gap-3 border-t border-line/60 pt-2.5">
        {done && <span className="font-ui text-[12px] text-dim">d{p.die} rolled {done.roll}</span>}
        <span className="flex-1" />
        {open && (
          <Button size="sm" variant="primary" icon={<Dices />} disabled={sending} onClick={() => void roll()}>
            Roll d{p.die}
          </Button>
        )}
      </div>
    </DecisionCardFrame>
  )
}
