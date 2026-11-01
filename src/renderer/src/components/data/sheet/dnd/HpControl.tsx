import { useState } from 'react'
import { giveTempHp, heal, takeDamage, type DndStats } from '@shared/dnd'
import { InlineNumber } from '../../../ui'
import { cn } from '../../../../lib/cn'
import { DeathSaves } from './DeathSaves'

const ACTIONS = [
  { label: 'Damage', run: takeDamage, tone: 'hover:border-alert hover:text-alert' },
  { label: 'Heal', run: heal, tone: 'hover:border-ok hover:text-ok' },
  { label: 'Temp', run: giveTempHp, tone: 'hover:border-cyan hover:text-cyan' }
]

export function HpControl({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const [amount, setAmount] = useState('')
  const n = Math.max(0, Math.round(Number(amount)) || 0)
  const pct = Math.max(0, Math.min(100, (dnd.hp.cur / Math.max(1, dnd.hp.max)) * 100))
  const hp = (patch: Partial<DndStats['hp']>) => onChange({ hp: { ...dnd.hp, ...patch } })
  const apply = (run: (d: DndStats, n: number) => Partial<DndStats>) => {
    if (!n) return
    onChange(run(dnd, n))
    setAmount('')
  }
  return (
    <div className="flex min-w-0 flex-col justify-center gap-1.5 px-3 py-2">
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-soft">HP</span>
        <InlineNumber value={dnd.hp.cur} min={0} max={dnd.hp.max} title="Current" onSave={(cur) => hp({ cur })} className="text-[22px] font-bold leading-tight text-white" />
        <span className="text-dim">/</span>
        <InlineNumber value={dnd.hp.max} min={1} title="Max" onSave={(max) => hp({ max, cur: Math.min(dnd.hp.cur, max) })} className="text-[15px] text-dim" />
        <span className="flex items-baseline text-[13px] text-cyan">
          +<InlineNumber value={dnd.hp.temp} min={0} title="Temporary" onSave={(temp) => hp({ temp })} /> <span className="ml-1 text-[11px] text-dim">temp</span>
        </span>
        <div className="h-1 min-w-10 flex-1 self-center bg-white/10">
          <div className={cn('h-full', pct > 50 ? 'bg-ok' : pct > 25 ? 'bg-accent' : 'bg-alert')} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {dnd.hp.cur <= 0 ? (
        <DeathSaves dnd={dnd} onChange={onChange} />
      ) : (
        <div className="flex items-center gap-1">
          <input value={amount} inputMode="numeric" placeholder="0" onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="h-6 w-12 border border-line/40 bg-black/40 px-1.5 font-mono text-[12px] text-white outline-none focus:border-accent/60" />
          {ACTIONS.map((a) => (
            <button key={a.label} disabled={!n} onClick={() => apply(a.run)} className={cn('h-6 border border-line/40 px-2 text-[11.5px] text-dim disabled:opacity-40', a.tone)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
