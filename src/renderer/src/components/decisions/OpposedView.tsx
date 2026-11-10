import { useState, type ReactNode } from 'react'
import { Dices } from 'lucide-react'
import { BASE } from '@shared/actions'
import { opposedChance, rollOpposed, sideBonus, type OpposedAnswer, type OpposedProps, type OpposedRoll, type OpposedSide, type OpposedWinner } from '@shared/opposedCheck'
import { Button, NumberField, Segmented } from '../ui'
import { useCheckTargets } from '../play/useCheckTargets'
import { cn } from '../../lib/cn'
import { DecisionCardFrame } from './DecisionCardFrame'
import { OpposedSideFields } from './OpposedSideFields'

function RollLine({ side, roll, won }: { side: OpposedSide; roll: OpposedRoll; won: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5 border px-2 py-1.5 font-mono text-[12px]', won ? 'border-ok/45 bg-ok/[0.05]' : 'border-line/60')}>
      <span className="min-w-0 flex-1 truncate text-white/90">
        {side.name} · {roll.label}
      </span>
      <span className="text-dim">
        <b className="text-accent">{roll.roll}</b> {roll.bonus < 0 ? '−' : '+'} <b className="text-white">{Math.abs(roll.bonus)}</b> = <b className="text-white">{roll.total}</b>
      </span>
    </div>
  )
}

export function OpposedView({ p, done, open, status, onAnswer, onClose, editable = false }: { p: OpposedProps; done: OpposedAnswer | null; open: boolean; status?: ReactNode; onAnswer: (value: OpposedAnswer) => Promise<void>; onClose?: () => void; editable?: boolean }) {
  const [a, setA] = useState(p.a)
  const [b, setB] = useState(p.b)
  const [dc, setDc] = useState(p.dc)
  const [sending, setSending] = useState(false)
  const aTargets = useCheckTargets(a.sheet)
  const bTargets = useCheckTargets(b.sheet)
  const aBonus = sideBonus(a, aTargets)
  const bBonus = sideBonus(b, bTargets)

  const send = async (force: OpposedWinner | null) => {
    if (sending) return
    setSending(true)
    const value = rollOpposed({ question: p.question, a, b, dc }, aBonus, bBonus, force)
    await onAnswer(value)
    setSending(false)
  }

  if (done) {
    const won = done.winner === 'a' ? done.a : done.b
    return (
      <DecisionCardFrame tag="Opposed check" question={p.question} status={status}>
        {done.aRoll && <RollLine side={done.a} roll={done.aRoll} won={done.winner === 'a'} />}
        {done.bRoll ? <RollLine side={done.b} roll={done.bRoll} won={done.winner === 'b'} /> : done.dc !== null && !done.forced && <span className="font-mono text-[12px] text-dim">against DC {done.dc}</span>}
        <span className="font-mono text-[12px] text-white">
          {won.name} wins{done.forced ? ' (your call)' : ''}: {won.does}
        </span>
        {won.action && (
          <span className="font-mono text-[10px] text-accent">
            In-game action: {won.action}
          </span>
        )}
      </DecisionCardFrame>
    )
  }

  return (
    <DecisionCardFrame tag="Opposed check" question={p.question} status={status} onClose={open ? onClose : undefined}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-2">
        <OpposedSideFields title="tries" side={a} targets={aTargets} onChange={setA} editable={editable} />
        <div className="flex min-w-0 flex-col gap-2">
          <Segmented
            value={dc === null ? 'roll' : 'dc'}
            options={[
              { value: 'roll', label: `${b.name} rolls` },
              { value: 'dc', label: 'Fixed DC' }
            ]}
            onChange={(v) => setDc(v === 'dc' ? (dc ?? BASE) : null)}
          />
          {dc === null ? (
            <OpposedSideFields title="against" side={b} targets={bTargets} onChange={setB} editable={editable} />
          ) : (
            <div className="flex items-center gap-2 border border-line/60 p-2.5">
              <span className="font-mono text-[11px] text-dim">DC</span>
              <NumberField value={dc} onChange={(v) => setDc(v ?? 0)} className="w-20" />
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2.5">
          <span className="font-mono text-[18px] font-bold text-accent">{Math.round(opposedChance(aBonus.bonus, bBonus.bonus, dc) * 100)}%</span>
          <span className="font-mono text-[11px] text-dim">{a.name} wins · {dc === null ? `ties go to ${b.name}` : `meeting DC ${dc} wins`}</span>
          <span className="flex-1" />
          <Button size="sm" variant="primary" icon={<Dices />} disabled={sending} onClick={() => void send(null)}>
            Roll
          </Button>
          <Button size="sm" disabled={sending} onClick={() => void send('a')}>
            {a.name} wins
          </Button>
          <Button size="sm" disabled={sending} onClick={() => void send('b')}>
            {b.name} wins
          </Button>
        </div>
      )}
    </DecisionCardFrame>
  )
}
